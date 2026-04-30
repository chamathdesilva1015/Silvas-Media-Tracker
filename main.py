import asyncio
import os
from fastapi import FastAPI, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from database import engine, create_db_and_tables, MediaItem, RatingHistory, AuditQueue, EternalBlacklist
from discord_sync import run_sync
from enrich_data import run_enrichment
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

app = FastAPI(title="Silva's Media Tracker API")

# Automation state — defined early so startup hook and background task can reference it
automation_status = {
    "sync":   {"running": False, "last_result": None, "logs": []},
    "enrich": {"running": False, "last_result": None, "logs": []},
}

audit_status = {"running": False, "last_result": None, "logs": []}

# Add CORS middleware for local network/browser compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_session():
    with Session(engine) as session:
        yield session

def check_readonly(request: Request):
    # Detect Vercel environment automatically
    if os.environ.get("VERCEL") == "1":
        if request.headers.get("x-admin-key") == "Dn1h7M55!":
            return # Unlock for valid admin
        raise HTTPException(status_code=403, detail="Action disabled in public read-only mode.")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"\n[!] VALIDATION ERROR ON ENDPOINT {request.url}")
    print(f"[!] Invalid payload details: {exc.errors()}")
    print(f"[!] Raw body: {exc.body}")
    return JSONResponse(
        status_code=422,
        content={"detail": "Invalid payload format.", "errors": exc.errors()},
    )

@app.on_event("startup")
async def on_startup():
    create_db_and_tables()
    # Run Score Cross-Linker synchronously (fast, DB-only)
    try:
        from health_check import run_score_crosslink
        with Session(engine) as session:
            items = session.exec(select(MediaItem)).all()
            fixed, _ = run_score_crosslink(session, items, auto_fix=True)
            if fixed:
                session.commit()
                print(f"[Startup] Score Cross-Linker: linked {fixed} missing scores.")
    except Exception as e:
        print(f"[Startup] Score Cross-Linker skipped: {e}")

    # Launch Discord sync in the background — site is immediately usable
    # while data refreshes from Discord in the background.
    asyncio.create_task(_background_sync())

    # Start the Retroactive Auditor Scheduler (3 AM daily)
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _scheduled_audit_scan,
        CronTrigger(hour=3, minute=0),
        id="retroactive_audit_job"
    )
    scheduler.start()


async def _scheduled_audit_scan():
    """Background task for the daily 3 AM audit scan."""
    print("[Scheduler] Starting daily 3 AM Retroactive Audit scan...")
    audit_status["running"] = True
    audit_status["logs"] = ["[System] Scheduled daily scan started at 3 AM..."]
    try:
        from audit_engine import run_full_audit
        result = run_full_audit(log=lambda m: audit_status["logs"].append(m))
        audit_status["last_result"] = {"added": result, "type": "scheduled"}
        print(f"[Scheduler] Daily audit complete: {result} items added.")
    except Exception as e:
        print(f"[Scheduler] Daily audit error: {e}")
        audit_status["logs"].append(f"[ERROR] {e}")
        audit_status["last_result"] = {"error": str(e), "type": "scheduled"}
    finally:
        audit_status["running"] = False


async def _background_sync():
    """Runs a full Discord sync every time the server starts."""
    automation_status["sync"]["running"] = True
    automation_status["sync"]["logs"] = ["[System] Auto-sync started on launch..."]

    def log_sync(msg):
        print(msg)  # visible in terminal
        automation_status["sync"]["logs"].append(msg)

    try:
        res = await run_sync(log_func=log_sync, category=None)
        automation_status["sync"]["last_result"] = res
        print(f"[Startup] Discord sync complete: {res}")
    except Exception as e:
        print(f"[Startup] Discord sync error: {e}")
        automation_status["sync"]["last_result"] = {"status": "error", "message": str(e)}
    finally:
        automation_status["sync"]["running"] = False


# Suppress Chromium/Brave devtools probe (harmless, just noisy)
@app.get("/.well-known/appspecific/com.chrome.devtools.json")
def devtools_probe():
    return Response(content="{}", media_type="application/json")


@app.get("/api/media", response_model=List[MediaItem])
def read_media(session: Session = Depends(get_session)):
    media = session.exec(select(MediaItem).order_by(MediaItem.date_added.desc())).all()
    return media

@app.delete("/api/media/{item_id}")
def delete_media_item(item_id: int, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    item = session.get(MediaItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    session.delete(item)
    session.commit()
    return {"status": "success", "message": "Item deleted"}

@app.post("/api/media", response_model=MediaItem)
def create_media(item: MediaItem, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    # Error-Proof Duplicate Check
    stmt = select(MediaItem).where(
        MediaItem.title == item.title,
        MediaItem.type == item.type,
        MediaItem.release_year == item.release_year
    )
    existing = session.exec(stmt).first()
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"This piece of media ('{item.title}' {item.release_year or ''}) already exists in your tracker."
        )
        
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

class ReviewPayload(BaseModel):
    title: str
    type: str
    review: Optional[str] = None

@app.post("/api/media/review")
def update_review(payload: ReviewPayload, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    print(f"\n[DEBUG] RECEIVED REVIEW UPDATE FOR: {payload.title} ({payload.type})")
    
    # We want to match all entries with the same exact title (case-insensitive) and exact type.
    # We update both Completed rows and Rankings rows seamlessly!
    target_items = session.exec(
        select(MediaItem).where(
            MediaItem.type == payload.type
        )
    ).all()
    
    # Case-insensitive manual filter for robustness against Discord case variations
    target_items = [item for item in target_items if item.title.lower() == payload.title.lower()]
    
    if not target_items:
        raise HTTPException(status_code=404, detail="No matching media items found.")
        
    for item in target_items:
        # Determine strict nullification if empty string provided
        if not payload.review or payload.review.strip() == "":
            item.review = None
        else:
            item.review = payload.review
        session.add(item)
        
    session.commit()
    return {"ok": True, "updated_count": len(target_items)}

def normalize_title(title: str) -> str:
    """Universal normalizer for semantic identity matching."""
    if not title: return ""
    import string
    t = title.lower().strip()
    # Remove common prefixes
    for prefix in ["the ", "a ", "an "]:
        if t.startswith(prefix):
            t = t[len(prefix):]
            break
    # Remove punctuation & collapse whitespace
    t = "".join(char for char in t if char not in string.punctuation)
    return " ".join(t.split())

@app.post("/api/media/like/{item_id}")
def toggle_like(item_id: str, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """Toggle is_liked on an item, then cascade to all rows with same normalized title+type."""
    try:
        actual_id = int(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item = session.get(MediaItem, actual_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Flip the value
    new_liked = not item.is_liked
    target_norm = normalize_title(item.title)

    # Cascade across all rows with the same NORMALIZED title and type
    all_related = session.exec(
        select(MediaItem).where(MediaItem.type == item.type)
    ).all()
    related = [r for r in all_related if normalize_title(r.title) == target_norm]

    for r in related:
        r.is_liked = new_liked
        session.add(r)

    session.commit()
    print(f"[DEBUG] TOGGLED LIKE for '{item.title}' (Norm: '{target_norm}') -> {new_liked} ({len(related)} rows)")
    return {"ok": True, "is_liked": new_liked, "updated_count": len(related)}

@app.post("/api/media/delete/{item_id}")
@app.post("/api/media/delete/{item_id}/") # Trailing slash support
def delete_media(item_id: str, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    print(f"\n[DEBUG] RECEIVED DELETE REQUEST FOR ID: {item_id}")
    try:
        # Cast to int manually to handle potential stringified IDs
        actual_id = int(item_id)
    except ValueError:
        print(f"[DEBUG] INVALID ID TYPE: {item_id}")
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item = session.get(MediaItem, actual_id)
    if not item:
        print(f"[DEBUG] ITEM NOT FOUND: {actual_id}")
        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.source != "manual":
        print(f"[DEBUG] REJECTED: ATTEMPTED TO DELETE NON-MANUAL ITEM: {actual_id}")
        raise HTTPException(status_code=403, detail="Only manually added entries can be deleted.")
    
    session.delete(item)
    session.commit()
    print(f"[DEBUG] SUCCESS: DELETED ITEM {actual_id} ({item.title})")
    return {"ok": True}

@app.get("/api/history/{item_id}")
def get_rating_history(item_id: int, session: Session = Depends(get_session)):
    """Returns all rating change records for a given MediaItem ID, newest first."""
    rows = session.exec(
        select(RatingHistory)
        .where(RatingHistory.media_item_id == item_id)
        .order_by(RatingHistory.changed_at.desc())
    ).all()
    return [
        {
            "old_rating": r.old_rating,
            "new_rating": r.new_rating,
            "changed_at": r.changed_at.strftime("%b %d, %Y"),
        }
        for r in rows
    ]

@app.get("/api/stats/{category}")
def get_category_stats(category: str, session: Session = Depends(get_session)):
    """Returns aggregated stats for a specific media category."""
    # Fetch all items for this category (completed + rankings)
    items = session.exec(
        select(MediaItem).where(MediaItem.type.ilike(category))
    ).all()

    if not items:
        return {"total": 0}

    # Helper: extract numeric score from 'X/10' or 'X.Y/10'
    def parse_score(item):
        score_str = item.numeric_rating or (item.rating if "/" in (item.rating or "") else None)
        if score_str and "/10" in score_str:
            try:
                return float(score_str.split("/")[0].strip())
            except ValueError:
                return None
        return None

    scores = [s for s in (parse_score(i) for i in items) if s is not None]
    total = len(items)

    # Average score
    avg_score = round(sum(scores) / len(scores), 1) if scores else None

    # Score distribution — buckets from 1 to 10
    dist = {}
    for s in scores:
        bucket = str(int(s)) if s == int(s) else str(round(s * 2) / 2)
        dist[bucket] = dist.get(bucket, 0) + 1

    # Decade breakdown
    decades = {}
    for item in items:
        if item.release_year:
            decade = f"{(item.release_year // 10) * 10}s"
            decades[decade] = decades.get(decade, 0) + 1

    # Highest and lowest rated
    scored_items = [(parse_score(i), i) for i in items if parse_score(i) is not None]
    highest = max(scored_items, key=lambda x: x[0]) if scored_items else None
    lowest  = min(scored_items, key=lambda x: x[0]) if scored_items else None

    # Reviews
    def has_real_review(r):
        if not r: return False
        r = r.strip().lower()
        return len(r) > 10 and not r.startswith("imported from discord")
    
    with_reviews = sum(1 for i in items if has_real_review(i.review))

    # Rankings
    in_rankings = sum(1 for i in items if i.is_ranking)

    # Most recently added (by date_added)
    most_recent = max(items, key=lambda i: i.date_added)

    return {
        "total": total,
        "avg_score": avg_score,
        "score_distribution": dist,
        "decade_breakdown": decades,
        "highest_rated": {"title": highest[1].title, "score": highest[1].numeric_rating or highest[1].rating} if highest else None,
        "lowest_rated":  {"title": lowest[1].title,  "score": lowest[1].numeric_rating or lowest[1].rating}  if lowest  else None,
        "with_reviews": with_reviews,
        "in_rankings": in_rankings,
        "most_recent": {
            "title": most_recent.title,
            "date": most_recent.date_added.strftime("%b %d, %Y"),
        },
    }

@app.post("/api/automation/sync")
async def trigger_sync(background_tasks: BackgroundTasks, category: Optional[str] = None):
    if automation_status["sync"]["running"]:
        return {"ok": False, "message": "Sync already in progress"}
    
    automation_status["sync"]["running"] = True
    automation_status["sync"]["logs"] = [f"[System] Starting Discord Sync for {category or 'All Categories'}..."]
    
    def log_sync(msg):
        automation_status["sync"]["logs"].append(msg)
    
    async def run_sync_task():
        try:
            res = await run_sync(log_func=log_sync, category=category)
            automation_status["sync"]["last_result"] = res
        except Exception as e:
            log_sync(f"[System] Critical Error: {str(e)}")
            automation_status["sync"]["last_result"] = {"status": "error", "message": str(e)}
        finally:
            automation_status["sync"]["running"] = False
            
    background_tasks.add_task(run_sync_task)
    return {"ok": True, "message": "Sync started"}

@app.post("/api/automation/enrich")
async def trigger_enrich(background_tasks: BackgroundTasks, category: Optional[str] = None):
    if automation_status["enrich"]["running"]:
        return {"ok": False, "message": "Enrichment already in progress"}
    
    automation_status["enrich"]["running"] = True
    automation_status["enrich"]["logs"] = [f"[System] Starting Magic Auto-Fill for {category or 'All Categories'}..."]

    def log_enrich(msg):
        automation_status["enrich"]["logs"].append(msg)
    
    async def run_enrich_task():
        try:
            res = await run_enrichment(log_func=log_enrich, category=category)
            automation_status["enrich"]["last_result"] = res
        except Exception as e:
            log_enrich(f"[System] Critical Error: {str(e)}")
            automation_status["enrich"]["last_result"] = {"status": "error", "message": str(e)}
        finally:
            automation_status["enrich"]["running"] = False
            
    background_tasks.add_task(run_enrich_task)
    return {"ok": True, "message": "Data enrichment started"}

@app.get("/api/automation/status")
def get_automation_status():
    return {
        "sync": {k: v for k, v in automation_status["sync"].items() if k != "logs"},
        "enrich": {k: v for k, v in automation_status["enrich"].items() if k != "logs"}
    }

@app.get("/api/automation/logs/{task}")
def get_automation_logs(task: str):
    if task not in automation_status:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Return all logs and clear them (destructive read for the frontend)
    logs = list(automation_status[task]["logs"])
    automation_status[task]["logs"] = []
    return {"logs": logs}

# ─── RETROACTIVE AUDITOR ENDPOINTS (Admin-only, PC-only feature) ─────────────────

@app.get("/api/audit/queue")
def get_audit_queue(
    page: int = 1,
    limit: int = 20,
    source: Optional[str] = None,
    session: Session = Depends(get_session),
    _: None = Depends(check_readonly),
):
    """Return paginated audit queue items, sorted by TMDB popularity (highest first)."""
    stmt = select(AuditQueue)
    if source:
        stmt = stmt.where(AuditQueue.scan_source == source)
    stmt = stmt.order_by(AuditQueue.popularity.desc())
    all_items = session.exec(stmt).all()
    total = len(all_items)
    start = (page - 1) * limit
    items = all_items[start : start + limit]
    return {
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
        "items": [
            {
                "id": i.id,
                "tmdb_id": i.tmdb_id,
                "title": i.title,
                "release_year": i.release_year,
                "scan_source": i.scan_source,
                "reason": i.reason,
                "popularity": round(i.popularity, 1),
                "queued_at": i.queued_at.strftime("%b %d, %Y"),
            }
            for i in items
        ],
    }


class AuditConfirmPayload(BaseModel):
    rating: str = "7/10"          # e.g. "8/10"
    review: Optional[str] = None


@app.post("/api/audit/confirm/{tmdb_id}")
def confirm_audit_item(
    tmdb_id: int,
    payload: AuditConfirmPayload,
    session: Session = Depends(get_session),
    _: None = Depends(check_readonly),
):
    """Confirm a movie from the audit queue — permanently logs it to MediaItem as source='retroactive_audit'."""
    item = session.exec(select(AuditQueue).where(AuditQueue.tmdb_id == tmdb_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in audit queue.")

    # Check it isn't already logged
    existing = session.exec(
        select(MediaItem).where(MediaItem.title == item.title, MediaItem.type == "Movies")
    ).first()
    if existing:
        # Already exists — just remove from queue silently
        session.delete(item)
        session.commit()
        return {"status": "already_logged", "message": f"'{item.title}' already exists in your tracker."}

    # Validate rating format
    import re
    if not re.match(r'^\d+(\.\d+)?/10$|^#\d+$', payload.rating):
        raise HTTPException(status_code=422, detail="Rating must be in format '7/10' or '#1'.")

    new_entry = MediaItem(
        title=item.title,
        release_year=item.release_year,
        type="Movies",
        rating=payload.rating,
        review=payload.review,
        source="retroactive_audit",
        discord_id=None,
    )
    session.add(new_entry)
    session.delete(item)
    session.commit()
    return {"status": "logged", "title": item.title, "rating": payload.rating}


@app.post("/api/audit/reject/{tmdb_id}")
def reject_audit_item(
    tmdb_id: int,
    session: Session = Depends(get_session),
    _: None = Depends(check_readonly),
):
    """Reject a movie — removes from audit queue and adds to EternalBlacklist."""
    item = session.exec(select(AuditQueue).where(AuditQueue.tmdb_id == tmdb_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in audit queue.")

    # Check not already blacklisted
    already = session.exec(select(EternalBlacklist).where(EternalBlacklist.tmdb_id == tmdb_id)).first()
    if not already:
        session.add(EternalBlacklist(tmdb_id=tmdb_id, title=item.title))

    session.delete(item)
    session.commit()
    return {"status": "rejected", "title": item.title}


@app.get("/api/audit/status")
def get_audit_status(session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """Returns queue size and scan-source breakdown."""
    all_items = session.exec(select(AuditQueue)).all()
    sources = {}
    for i in all_items:
        sources[i.scan_source] = sources.get(i.scan_source, 0) + 1
    return {
        "total": len(all_items),
        "by_source": sources,
        "running": audit_status["running"],
    }


@app.post("/api/audit/run")
def trigger_audit_scan(
    request: Request,
    background_tasks: BackgroundTasks,
    _: None = Depends(check_readonly),
):
    """Trigger all four audit scanners in the background. Admin-only."""
    if audit_status["running"]:
        return {"status": "already_running", "message": "An audit scan is already in progress."}

    def _run():
        import threading
        audit_status["running"] = True
        audit_status["logs"] = []
        try:
            from audit_engine import run_full_audit
            result = run_full_audit(log=lambda m: audit_status["logs"].append(m))
            audit_status["last_result"] = {"added": result}
        except Exception as e:
            audit_status["logs"].append(f"[ERROR] {e}")
            audit_status["last_result"] = {"error": str(e)}
        finally:
            audit_status["running"] = False

    background_tasks.add_task(_run)
    return {"status": "started", "message": "Audit scan started in the background."}


# Mount static directory to serve frontend (CSS, JS, index.html)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
