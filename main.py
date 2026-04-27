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

from database import engine, create_db_and_tables, MediaItem
from discord_sync import run_sync
from enrich_data import run_enrichment

app = FastAPI(title="Silva's Media Tracker API")

# Automation state — defined early so startup hook and background task can reference it
automation_status = {
    "sync":   {"running": False, "last_result": None, "logs": []},
    "enrich": {"running": False, "last_result": None, "logs": []},
}

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

# Mount static directory to serve frontend (CSS, JS, index.html)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
