import asyncio
import os
from fastapi import FastAPI, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from database import engine, create_db_and_tables, MediaItem, RatingHistory
from enrich_data import run_enrichment

app = FastAPI(title="Silva's Media Tracker API")

# Automation state — defined early so startup hook and background task can reference it
automation_status = {
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
        if request.headers.get("x-admin-key") == "9745":
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

    # Launch enrichment in the background — site is immediately usable
    asyncio.create_task(run_enrichment(category="Movies"))


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
def create_media(item: MediaItem, background_tasks: BackgroundTasks, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
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

    # Auto-enrich if it's a Movie
    if item.type == "Movies":
        background_tasks.add_task(run_enrichment, category="Movies")

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

class RatingUpdateRequest(BaseModel):
    rating: str

@app.post("/api/media/update-rating/{item_id}")
@app.post("/api/media/update-rating/{item_id}/")
def update_rating(item_id: int, request: RatingUpdateRequest, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    item = session.get(MediaItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    try:
        score_val = float(request.rating.strip())
        # Snap to nearest 0.5
        rounded_val = round(score_val * 2) / 2
        new_rating = f"{rounded_val}/10" if rounded_val == int(rounded_val) else f"{rounded_val}/10"
        
        # Clean display: if it's 8.0/10, make it 8/10
        if rounded_val == int(rounded_val):
            new_rating = f"{int(rounded_val)}/10"
        else:
            new_rating = f"{rounded_val}/10"
    except ValueError:
        # Fallback if parsing fails
        new_rating = request.rating.strip()
        if not new_rating.endswith("/10"):
            new_rating = f"{new_rating}/10"

    target_norm = normalize_title(item.title)
    all_related = session.exec(
        select(MediaItem).where(MediaItem.type == item.type)
    ).all()
    related = [r for r in all_related if normalize_title(r.title) == target_norm]

    for r in related:
        # Log to history
        old_r = r.rating or ""
        if old_r != new_rating:
            session.add(RatingHistory(
                media_item_id=r.id,
                title=r.title,
                media_type=r.type,
                old_rating=old_r,
                new_rating=new_rating,
            ))
        
        # If it's a ranking, we preserve the #N prefix in 'rating' but update 'numeric_rating'
        if (r.rating or "").startswith("#"):
            r.numeric_rating = new_rating
        else:
            r.rating = new_rating
            r.numeric_rating = new_rating
            
        r.is_manual_rating = True
        session.add(r)

    session.commit()
    print(f"[DEBUG] UPDATED RATING for '{item.title}' -> {new_rating} ({len(related)} rows, MANUALLY PROTECTED)")
    return {"ok": True, "rating": new_rating, "updated_count": len(related)}

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
        for field in [item.numeric_rating, item.rating]:
            if not field: continue
            # Try parsing raw number
            try:
                return float(field)
            except ValueError:
                pass
            # Try parsing "X/10"
            if "/10" in field:
                try:
                    return float(field.split("/")[0].strip())
                except ValueError:
                    pass
        return None

    scores = [s for s in (parse_score(i) for i in items) if s is not None]
    total = len(items)

    # Average score
    avg_score = round(sum(scores) / len(scores), 1) if scores else None

    # Score distribution — buckets from 0 to 10 in 0.5 increments
    dist = {str(i/2.0) if i/2.0 != int(i/2.0) else str(int(i/2.0)): 0 for i in range(21)}
    for s in scores:
        bucket = str(int(s)) if s == int(s) else str(round(s * 2) / 2)
        dist[bucket] = dist.get(bucket, 0) + 1

    # Half-Decade breakdown (e.g., 2010-2014, 2015-2019)
    decades = {}
    for item in items:
        if item.release_year:
            start_year = (item.release_year // 5) * 5
            label = f"{start_year}-{start_year+4}"
            decades[label] = decades.get(label, 0) + 1

    # Highest and lowest rated
    scored_items = [(parse_score(i), i) for i in items if parse_score(i) is not None]
    highest = max(scored_items, key=lambda x: x[0]) if scored_items else None
    lowest  = min(scored_items, key=lambda x: x[0]) if scored_items else None
    avg_score = round(sum(s for s, i in scored_items) / len(scored_items), 1) if scored_items else 0
    
    # Average Release Year
    years = [i.release_year for i in items if i.release_year]
    avg_year = int(sum(years) / len(years)) if years else 0

    # Reviews
    def has_real_review(r):
        if not r or not isinstance(r, str): return False
        r = r.strip().lower()
        if r == "": return False
        if r.startswith("imported from discord"): return False
        if r.startswith("imported from letterboxd"): return False
        return True
    
    with_reviews = sum(1 for i in items if has_real_review(i.review))

    # Rankings
    in_rankings = sum(1 for i in items if i.is_ranking)

    # Total likes & Like Ratio
    total_likes = sum(1 for i in items if i.is_liked)
    like_ratio = int(round(total / total_likes)) if total_likes > 0 else 0
    
    hof_items = sorted(
        [(parse_score(i), i) for i in items if parse_score(i) is not None and parse_score(i) >= 9.0],
        key=lambda x: x[0], reverse=True
    )
    hall_of_fame = len(hof_items)
    hall_of_fame_items = [
        {"title": i.title, "score": s, "year": i.release_year}
        for s, i in hof_items
    ]

    # Most recently added (by date_added)
    most_recent = max(items, key=lambda i: i.date_added)

    # Favorite Genre (Movies ONLY) - "Volume-Weighted Passion" Model (v120)
    favorite_genre = None
    if category.lower() == "movies" and scored_items:
        genre_data = {} # {name: [(score, item)]}
        for s, i in scored_items:
            if not i.genres: continue
            parts = [g.strip() for g in i.genres.split(",")]
            for p in parts:
                if p not in genre_data: genre_data[p] = []
                genre_data[p].append((s, i))
        
        genre_scores = []
        for g_name, items in genre_data.items():
            v = len(items)
            if v < 1: continue
            
            # 1. Total Cubic Passion: Sum of (Rating - 4.5)^3
            # A 25% "Passion Bonus" is applied if the movie is Liked
            total_passion = 0
            for s, i in items:
                weight = max(0, (s - 4.5)) ** 3
                if i.is_liked:
                    weight *= 1.25 # 25% Bonus for personal favorites
                if has_real_review(i.review):
                    weight *= 1.10 # 10% Review Bonus (User requested slight bonus)
                total_passion += weight
            
            # 2. Confidence Filter: (1 - 1/v)
            confidence = (1.0 - (1.0 / v))
            
            final_score = total_passion * confidence
            # Get top 10 movies for this genre as examples
            sorted_m = sorted(items, key=lambda x: x[0], reverse=True)
            examples = [i.title for s, i in sorted_m[:10]]
            genre_scores.append((g_name, final_score, examples))
            
        if genre_scores:
            genre_scores.sort(key=lambda x: x[1], reverse=True)
            favorite_genre = [
                {"name": g, "score": round(s, 1), "examples": ex} 
                for g, s, ex in genre_scores[:10]
            ]

    # Favorite Directors (Movies ONLY) - Same Passion-Volume Model
    favorite_directors = []
    if category.lower() == "movies" and scored_items:
        dir_data = {} # {name: [(score, item)]}
        for s, i in scored_items:
            if not i.director: continue
            d = i.director.strip()
            if d not in dir_data: dir_data[d] = []
            dir_data[d].append((s, i))
            
        dir_scores = []
        for d_name, items_list in dir_data.items():
            v = len(items_list)
            if v < 1: continue
            
            total_passion = 0
            for s, i in items_list:
                weight = max(0, (s - 4.5)) ** 3
                if i.is_liked:
                    weight *= 1.25
                if has_real_review(i.review):
                    weight *= 1.10 # 10% Review Bonus
                total_passion += weight
            
            confidence = (1.0 - (1.0 / v))
            final_score = total_passion * confidence
            dir_scores.append((d_name, final_score, items_list))
            
        if dir_scores:
            dir_scores.sort(key=lambda x: x[1], reverse=True)
            top_dirs = dir_scores[:10]
            
            for d_name, score, items_list in top_dirs:
                if score <= 0: continue
                # Get top 10 movies as examples
                sorted_movies = sorted(items_list, key=lambda x: x[0], reverse=True)
                examples = [i.title for s, i in sorted_movies[:10]]
                favorite_directors.append({
                    "name": d_name,
                    "score": round(score, 1),
                    "examples": examples
                })

    return {
        "total": total,
        "avg_score": avg_score,
        "avg_year": avg_year,
        "score_distribution": dist,
        "decade_breakdown": decades,
        "highest_rated": {"title": highest[1].title, "score": highest[1].numeric_rating or highest[1].rating} if highest else None,
        "lowest_rated":  {"title": lowest[1].title,  "score": lowest[1].numeric_rating or lowest[1].rating}  if lowest  else None,
        "with_reviews": with_reviews,
        "total_likes": total_likes,
        "like_ratio": like_ratio,
        "hall_of_fame": hall_of_fame,
        "hall_of_fame_items": hall_of_fame_items,
        "in_rankings": in_rankings,
        "most_recent": {
            "title": most_recent.title,
            "date": most_recent.date_added.strftime("%b %d, %Y"),
        },
        "favorite_genres": favorite_genre,
        "favorite_directors": favorite_directors
    }



@app.post("/api/automation/enrich")
async def trigger_enrich(category: Optional[str] = None):
    async def log_generator():
        q = asyncio.Queue()
        def log_enrich(msg):
            q.put_nowait(msg)
            
        async def run():
            try:
                await run_enrichment(log_func=log_enrich, category=category)
            except Exception as e:
                log_enrich(f"[System] Critical Error: {str(e)}")
            finally:
                q.put_nowait(None)
                
        asyncio.create_task(run())
        
        while True:
            msg = await q.get()
            if msg is None:
                break
            yield msg + "\n"
            
    return StreamingResponse(log_generator(), media_type="text/plain")

# Mount static directory to serve frontend (CSS, JS, index.html)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
