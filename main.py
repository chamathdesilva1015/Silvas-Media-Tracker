import asyncio
import os
from dotenv import load_dotenv
load_dotenv() # Load env vars as early as possible
from fastapi import FastAPI, Depends, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from sqlalchemy import text

from pydantic import BaseModel
from typing import List, Optional

from database import engine, create_db_and_tables, MediaItem, RatingHistory, PassedSuggestion, Recommendation
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
    
    # Self-healing migration for all potential missing columns
    with Session(engine) as session:
        for table_name in ["mediaitem", "media_item"]:
            # Check if table exists
            try:
                session.exec(text(f"SELECT id FROM {table_name} LIMIT 1"))
            except Exception:
                continue # Table doesn't exist under this name
                
            # Attempt to add all potential new columns
            new_columns = [
                ("backdrop_url", "VARCHAR"),
                ("director", "VARCHAR"),
                ("runtime", "INTEGER"),
                ("content_rating", "VARCHAR"),
                ("genres", "VARCHAR"),
                ("tmdb_id", "INTEGER"),
                ("enrichment_attempts", "INTEGER DEFAULT 0"),
                ("is_manual_rating", "BOOLEAN DEFAULT FALSE"),
                ("numeric_rating", "VARCHAR"),
                ("overview", "TEXT")
            ]
            
            for col_name, col_type in new_columns:
                try:
                    # Check if column exists first to avoid unnecessary errors
                    session.exec(text(f"SELECT {col_name} FROM {table_name} LIMIT 1"))
                except Exception:
                    # After an error, the transaction is often poisoned in Postgres.
                    # We should rollback to ensure the next ALTER TABLE can run.
                    session.rollback()
                    print(f"[!] {col_name} missing in {table_name}. Attempting migration...")
                    try:
                        session.exec(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                        session.commit()
                        print(f"[+] Successfully added {col_name} to {table_name}")
                    except Exception as e:
                        print(f"[!] Migration failed for {col_name} in {table_name}: {e}")
                        session.rollback()



    # Launch enrichment in the background — site is immediately usable
    asyncio.create_task(run_enrichment())



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
    # Error-Proof Duplicate Check (Case-insensitive)
    stmt = select(MediaItem).where(
        MediaItem.type == item.type,
        MediaItem.release_year == item.release_year
    )
    existing = session.exec(stmt).all()
    if any(e.title.lower() == item.title.lower() for e in existing):
        raise HTTPException(
            status_code=400, 
            detail=f"This piece of media ('{item.title}' {item.release_year or ''}) already exists in your tracker."
        )
        
    # Ensure rating fields are synchronized
    if item.rating and not item.numeric_rating:
        item.numeric_rating = item.rating
    if item.numeric_rating and not item.rating:
        item.rating = f"{item.numeric_rating}/10" if "/10" not in str(item.numeric_rating) else str(item.numeric_rating)
        
    session.add(item)
    session.commit()
    session.refresh(item)

    # Auto-enrich if it's a valid type
    if item.type in ["Movies", "TV Series", "Anime", "Manga"]:
        background_tasks.add_task(run_enrichment, category=item.type)

    return item

class ReviewPayload(BaseModel):
    title: str
    type: str
    review: Optional[str] = None

@app.post("/api/media/review")
def update_review(payload: ReviewPayload, session: Session = Depends(get_session), _: None = Depends(check_readonly)):

    
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
    return {"ok": True, "title": item.title, "rating": item.rating}

# --- Metadata Sync & Fix Endpoints (v219) ---

@app.post("/api/media/refresh/{item_id}")
async def refresh_item_metadata(item_id: int, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """Force re-run enrichment for a single specific item."""
    item = session.get(MediaItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Deep Reset
    item.enrichment_attempts = 0
    item.tmdb_id = None
    item.genres = None
    item.director = None
    item.cover_url = None
    session.add(item)
    session.commit()
    
    # Trigger enrichment runner (this is async)
    # Note: run_enrichment normally loops over everything, but we can call it.
    # For efficiency, we just let the background task handle it or we could make a targeted version.
    await run_enrichment(category=item.type)
    
    session.refresh(item)
    return {"ok": True, "item": item}

class LinkPayload(BaseModel):
    item_id: int
    ext_id: int # TMDB or MAL ID


@app.get("/api/media/preview")
def preview_metadata(type: str, title: Optional[str] = "", year: Optional[str] = "", ext_id: Optional[str] = "", session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """Pre-fetches metadata for an item before it is saved, validating against duplicates."""
    try:
        print(f"[*] PREVIEW: type={type}, title='{title}', year={year}, ext_id={ext_id}")
        from tmdb_helper import TMDB_API_KEY
        print(f"[*] TMDB_API_KEY loaded: {'Yes (Length: ' + str(len(TMDB_API_KEY)) + ')' if TMDB_API_KEY else 'No'}")
        data = {}
        target_ext_id = int(ext_id) if ext_id else None

        if type == "Anime":
            from jikan_helper import search_anime, get_anime_details
            if not target_ext_id and title:
                target_ext_id = search_anime(title)
            if target_ext_id:
                data = get_anime_details(target_ext_id)
        elif type == "Manga":
            from jikan_helper import search_manga, get_manga_details
            if not target_ext_id and title:
                target_ext_id = search_manga(title)
            if target_ext_id:
                data = get_manga_details(target_ext_id)
        elif type == "Movies":
            from tmdb_helper import search_movie, get_movie_details
            y = int(year) if year else None
            if not target_ext_id and title:
                target_ext_id = search_movie(title, y)
            if target_ext_id:
                data = get_movie_details(target_ext_id)
        elif type == "TV Series":
            from tmdb_helper import search_tmdb, get_tv_details
            y = int(year) if year else None
            if not target_ext_id and title:
                target_ext_id = search_tmdb(title, y, media_type="tv")
            if target_ext_id:
                data = get_tv_details(target_ext_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid media type")

        if not data:
            raise HTTPException(status_code=404, detail="Could not find a match for that title/ID.")

        # Expert Duplicate detection
        canonical_title = data.get("title", "")
        target_id = data.get("tmdb_id")
        
        # Check by ID first (most reliable)
        if target_id:
            existing_by_id = session.exec(select(MediaItem).where(
                MediaItem.type == type,
                MediaItem.tmdb_id == target_id
            )).first()
            if existing_by_id:
                data["duplicate_warning"] = True
                return data

        # Fallback to Title/Year check
        existing = session.exec(select(MediaItem).where(
            MediaItem.type == type,
            MediaItem.release_year == data.get("release_year")
        )).all()
        
        is_duplicate = any(item.title.lower() == canonical_title.lower() for item in existing)
        
        data["duplicate_warning"] = is_duplicate
        return data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
@app.get("/api/media/fetch-metadata")
def fetch_metadata(type: str, ext_id: str, _: None = Depends(check_readonly)):
    """Fetches metadata for autofill in the UI."""
    try:
        if type == "Anime":
            from jikan_helper import get_anime_details
            data = get_anime_details(int(ext_id))
            return data
        elif type == "Manga":
            from jikan_helper import get_manga_details
            data = get_manga_details(int(ext_id))
            return data
        elif type == "Movies":
            from tmdb_helper import get_movie_details
            data = get_movie_details(int(ext_id))
            return data
        elif type == "TV Series":
            from tmdb_helper import get_tv_details
            data = get_tv_details(int(ext_id))
            return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    raise HTTPException(status_code=400, detail="Invalid media type")

@app.post("/api/media/link")
async def link_metadata_manually(payload: LinkPayload, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """Force-link an item to a specific ID and fetch its details."""
    item = session.get(MediaItem, payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    from tmdb_helper import get_tmdb_details
    from jikan_helper import get_manga_details, get_anime_details

    if item.type == "Manga":
        details = get_manga_details(payload.ext_id)
    elif item.type == "Anime":
        # Anime IDs come from MyAnimeList — use Jikan, not TMDB
        details = get_anime_details(payload.ext_id)
    else:
        media_type = "movie" if item.type == "Movies" else "tv"
        details = get_tmdb_details(payload.ext_id, media_type)

    if not details:
        raise HTTPException(status_code=400, detail="Could not retrieve details for that ID.")

    # Ensure no ID overwrites an already entered entry
    stmt = select(MediaItem).where(
        MediaItem.tmdb_id == payload.ext_id,
        MediaItem.type == item.type,
        MediaItem.id != item.id
    )
    existing_match = session.exec(stmt).first()
    if existing_match:
        raise HTTPException(status_code=400, detail=f"This ID is already linked to another {item.type} entry: '{existing_match.title}'.")

    # Apply details
    if details.get("title"): item.title = details["title"]
    if details.get("release_year"): item.release_year = details["release_year"]
    if details.get("genres"): item.genres = details["genres"]
    if details.get("poster_url"): item.cover_url = details["poster_url"]
    if details.get("director"): item.director = details["director"]
    if details.get("runtime"): item.runtime = details["runtime"]
    if details.get("content_rating"): item.content_rating = details["content_rating"]
    item.tmdb_id = payload.ext_id
    
    session.add(item)
    session.commit()
    return {"ok": True, "item": item}

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

    return {"ok": True, "is_liked": new_liked, "updated_count": len(related)}

@app.post("/api/media/update/{item_id}")
async def update_media_item(item_id: int, payload: dict, background_tasks: BackgroundTasks, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """Unified update for Rating, Title, or Year. Triggers re-enrichment if Title/Year changes."""
    item = session.get(MediaItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    needs_reenrich = False
    if "rating" in payload:
        try:
            new_score_val = float(payload["rating"])
            new_score = str(new_score_val).strip()
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid numeric rating provided.")
            
        # Ensure /10 suffix
        new_rating = new_score if new_score.endswith("/10") else f"{new_score}/10"
        
        # Cascade to all rows with same normalized title/type AND YEAR (Completed + Rankings)
        target_norm = normalize_title(item.title)
        target_year = item.release_year
        all_related = session.exec(select(MediaItem).where(MediaItem.type == item.type)).all()
        related = [r for r in all_related if normalize_title(r.title) == target_norm and r.release_year == target_year]
        
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
    else:
        # If updating via API, rating is now mandatory
        if not item.rating and not item.numeric_rating:
             raise HTTPException(status_code=400, detail="A rating is required for this entry.")
    
    if "title" in payload and payload["title"] != item.title:
        item.title = payload["title"]
        needs_reenrich = True
        
    if "release_year" in payload:
        try:
            new_year = int(payload["release_year"])
            if new_year != item.release_year:
                item.release_year = new_year
                needs_reenrich = True
        except (ValueError, TypeError):
            pass # Invalid year format, skip

    if needs_reenrich:
        # Reset metadata to force fresh match
        item.enrichment_attempts = 0
        item.tmdb_id = None
        item.genres = None
        item.director = None
        item.cover_url = None
        background_tasks.add_task(run_enrichment, category=item.type)

    session.add(item)
    session.commit()
    session.refresh(item)
    return {"ok": True, "item": item, "needs_reenrich": needs_reenrich}

# --- Metadata Sync & Fix Endpoints (v219) ---

class ReorderRequest(BaseModel):
    category: str
    item_ids: list[int] # Ordered list of primary IDs

@app.post("/api/rankings/reorder")
def reorder_rankings(request: ReorderRequest, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """
    Atomic update for rankings in a category.
    Takes a list of IDs in order (#1, #2, #3...).
    Strictly ID-based to prevent title collisions or duplicate ranks.
    """
    category = request.category
    new_order_ids = request.item_ids

    # 1. Fetch all items in this category to perform a clean sweep
    all_cat_items = session.exec(select(MediaItem).where(MediaItem.type == category)).all()
    
    # 2. Reset ALL items in this category first (remove any '#' ranks)
    for item in all_cat_items:
        r_str = str(item.rating or "")
        nr_str = str(item.numeric_rating or "")
        
        if item.is_ranking or r_str.startswith('#') or nr_str.startswith('#'):
            item.is_ranking = False
            # If the rating was a rank, try to restore the numeric score if possible
            if r_str.startswith('#'):
                # Fallback to numeric_rating if it's not a rank, otherwise clear to default
                item.rating = item.numeric_rating if item.numeric_rating and not str(item.numeric_rating).startswith('#') else "—/10"
            if nr_str.startswith('#'):
                item.numeric_rating = None
            
        session.add(item)

    # 3. Apply new rankings sequentially to the EXACT IDs provided
    # This ensures only ONE entry per rank and no missing numbers
    for i, mid in enumerate(new_order_ids):
        item = session.get(MediaItem, mid)
        if item:
            rank_str = f"#{i + 1}"
            item.is_ranking = True
            
            # IMPORTANT: Preserve the original score before overwriting 'rating'
            original_rating = str(item.rating or "").strip()
            current_nr = str(item.numeric_rating or "").strip()
            
            # If numeric_rating is missing/invalid, try to salvage from the current rating
            if not current_nr or current_nr.startswith('#'):
                if original_rating and not original_rating.startswith('#'):
                    item.numeric_rating = original_rating
                else:
                    # Fallback to finding a sibling
                    sibling = session.exec(
                        select(MediaItem).where(
                            MediaItem.type == item.type,
                            MediaItem.title == item.title,
                            MediaItem.is_ranking == False
                        )
                    ).first()
                    if sibling:
                        nr = str(sibling.numeric_rating or sibling.rating or "").strip()
                        item.numeric_rating = nr if nr and not nr.startswith('#') else None
                    else:
                        item.numeric_rating = None

            # Store rank in 'rating' field (the primary display field)
            item.rating = rank_str
            session.add(item)

    session.commit()

    return {"ok": True, "count": len(new_order_ids)}

@app.post("/api/media/delete/{item_id}")
@app.post("/api/media/delete/{item_id}/") # Trailing slash support
def delete_media(item_id: str, session: Session = Depends(get_session), _: None = Depends(check_readonly)):

    try:
        # Cast to int manually to handle potential stringified IDs
        actual_id = int(item_id)
    except ValueError:

        raise HTTPException(status_code=400, detail="Invalid ID format")

    item = session.get(MediaItem, actual_id)
    if not item:

        raise HTTPException(status_code=404, detail="Item not found")
    
    if item.source != "manual":

        raise HTTPException(status_code=403, detail="Only manually added entries can be deleted.")
    
    session.delete(item)
    session.commit()

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

    # Favorite Genre (Movies, TV Series, Anime, Manga) - "Volume-Weighted Passion" Model (v120/v204/v215/v217)
    favorite_genre = None
    if category.lower() in ["movies", "tv series", "anime", "manga"] and scored_items:
        genre_data = {} # {name: [(score, item)]}
        for s, i in scored_items:
            if not i.genres: continue
            parts = [g.strip() for g in i.genres.split(",")]
            for p in parts:
                if p not in genre_data: genre_data[p] = []
                genre_data[p].append((s, i))
        
        genre_scores = []
        for g_name, items_list in genre_data.items():
            v = len(items_list)
            if v < 1: continue
            
            # 1. Total Cubic Passion: Sum of (Rating - 4.5)^3
            total_passion = 0
            for s, i in items_list:
                weight = max(0, (s - 4.5)) ** 3
                if i.is_liked:
                    weight *= 1.25 # 25% Bonus for personal favorites
                if has_real_review(i.review):
                    weight *= 1.10 # 10% Review Bonus
                total_passion += weight
            
            # 2. Confidence Filter: (1 - 1/v)
            confidence = (1.0 - (1.0 / v))
            
            final_score = total_passion * confidence
            # Get top 10 items for this genre as examples
            sorted_m = sorted(items_list, key=lambda x: x[0], reverse=True)
            examples = [i.title for s, i in sorted_m[:10]]
            genre_scores.append((g_name, final_score, examples))
            
        if genre_scores:
            genre_scores.sort(key=lambda x: x[1], reverse=True)
            favorite_genre = [
                {"name": g, "score": round(s, 1), "examples": ex} 
                for g, s, ex in genre_scores[:10]
            ]

    # Favorite Directors/Creators/Authors (Movies, TV Series, Anime, Manga)
    favorite_directors = []
    if category.lower() in ["movies", "tv series", "anime", "manga"] and scored_items:
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
                    weight *= 1.10
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
            "item": most_recent,
            "display_date": most_recent.date_added.strftime("%b %d, %Y")
        },
        "favorite_genres": favorite_genre,
        "favorite_directors": favorite_directors
    }



import random
import traceback
from tmdb_helper import get_tmdb_recommendations, get_movie_details, get_tv_details
from jikan_helper import get_jikan_recommendations, get_anime_details, get_manga_details

@app.get("/api/suggestions")
def get_suggestions(category: Optional[str] = None, mode: str = "balanced", session: Session = Depends(get_session)):
    """
    Generates 3 rich media suggestions based on the user's high-rated and liked items.
    Tuning modes: balanced, safe, adventure, hidden
    """
    try:
        # 1. Fetch items
        query = select(MediaItem).where(MediaItem.tmdb_id != None)
        if category and category != 'The Hub':
            query = query.where(MediaItem.type == category)
            
        all_items = session.exec(query).all()
        
        def parse_score(item):
            for field in [item.numeric_rating, item.rating]:
                if not field: continue
                try: return float(field)
                except ValueError: pass
                if "/10" in field:
                    try: return float(field.split("/")[0].strip())
                    except ValueError: pass
            return 0

        # 2. Identify potential seeds
        liked_seeds = []
        top_seeds = []
        good_seeds = []
        
        tracked_titles = {normalize_title(i.title) for i in all_items}
        tracked_ids = {(i.type, i.tmdb_id) for i in all_items if i.tmdb_id}
        
        # Also fetch passed suggestions
        try:
            passed_items = session.exec(select(PassedSuggestion)).all()
            for p in passed_items:
                tracked_ids.add((p.type, p.tmdb_id))
        except Exception as pe:
            print(f"Error fetching passed list: {pe}")

        for item in all_items:
            score = parse_score(item)
            if item.is_liked:
                liked_seeds.append(item)
            elif score >= 8.5:
                top_seeds.append(item)
            elif score >= 7.0:
                good_seeds.append(item)
                
        # --- Tuning Logic: Seed Selection ---
        if mode == "safe":
            # Focus exclusively on absolute favorites
            seeds = liked_seeds * 5 + top_seeds * 2
        elif mode == "adventure":
            # Broaden the horizon, including more "good" but not necessarily "best" items
            seeds = liked_seeds + top_seeds + good_seeds * 3
        else: # balanced & hidden
            seeds = liked_seeds * 3 + top_seeds * 2 + good_seeds
                
        if not seeds:
            return []
            
        # 3. Pick distinct seeds and fetch in a loop until we have up to 6 picks
        unique_seeds_dict = {s.id: s for s in seeds}
        unique_seeds_list = list(unique_seeds_dict.values())
        
        final_picks = []
        picked_keys = set() # Track (type, tmdb_id) to prevent duplicates
        major_attempts = 0
        used_seeds = set()
        
        # Aim for 6 suggestions, try hard up to 6 times
        while len(final_picks) < 6 and major_attempts < 6:
            major_attempts += 1
            
            available_seeds = [s for s in seeds if s.id not in used_seeds]
            if not available_seeds:
                available_seeds = seeds  # fallback if all used
                
            chosen_seeds = []
            attempts = 0
            batch_size = min(20, len(unique_seeds_list))
            
            while len(chosen_seeds) < batch_size and attempts < 100:
                pick = random.choice(available_seeds)
                if pick not in chosen_seeds:
                    chosen_seeds.append(pick)
                    used_seeds.add(pick.id)
                attempts += 1
            
            # 4. Pool recommendations
            pool = {}
            for seed in chosen_seeds:
                recs = []
                try:
                    if seed.type in ["Anime", "Manga"]:
                        recs = get_jikan_recommendations(seed.tmdb_id, "anime" if seed.type == "Anime" else "manga", limit=40)
                    elif seed.type in ["Movies", "TV Series"]:
                        recs = get_tmdb_recommendations(seed.tmdb_id, "movie" if seed.type == "Movies" else "tv", limit=40)
                except Exception as e:
                    print(f"Error fetching recs for seed {seed.title}: {e}")
                    continue
                    
                for r in recs:
                    norm_title = normalize_title(r.get("title", ""))
                    if not r.get("tmdb_id") or norm_title in tracked_titles or (r["type"], r["tmdb_id"]) in tracked_ids:
                        continue
                        
                    # Skip if already picked in a previous loop iteration or current pool
                    pool_key = (r["type"], r["tmdb_id"])
                    if pool_key in picked_keys:
                        continue
                        
                    if pool_key not in pool:
                        pool[pool_key] = {"item": r, "seeds": set()}
                    pool[pool_key]["seeds"].add((seed.title, seed.rating or "N/A"))
                    
            if not pool:
                continue
                
            # 5. Sort by overlaps or popularity
            needed = 6 - len(final_picks)
            groups = {}
            for data in pool.values():
                count = len(data["seeds"])
                if count not in groups: groups[count] = []
                groups[count].append(data)
                
            sorted_counts = sorted(groups.keys(), reverse=True)
            for count in sorted_counts:
                group_items = groups[count]
                random.shuffle(group_items)
                for data in group_items:
                    if (data["item"]["type"], data["item"]["tmdb_id"]) not in picked_keys:
                        final_picks.append(data)
                        picked_keys.add((data["item"]["type"], data["item"]["tmdb_id"]))
                        if len(final_picks) >= 6: break
                if len(final_picks) >= 6: break
                    
        # Ensure we have at least 4 if possible, but no more than 6
        if len(final_picks) > 6:
            final_picks = final_picks[:6]
        
        # (The user wants minimum 4, if we have less than 4 here, we just return what we have as we tried our best)

                
        # 6. Fetch rich details
        results = []
        def format_seed(s): return f"{s[0]} ({s[1]})"

        for data in final_picks:
            item = data["item"]
            seeds_info = list(data["seeds"])
            
            if len(seeds_info) == 1:
                reason = f"Because you liked {format_seed(seeds_info[0])}"
            elif len(seeds_info) == 2:
                reason = f"Because you liked {format_seed(seeds_info[0])} and {format_seed(seeds_info[1])}"
            else:
                reason = f"Because you liked {format_seed(seeds_info[0])}, {format_seed(seeds_info[1])}, and {len(seeds_info)-2} more"
                
            details = {}
            try:
                if item["type"] == "Anime":
                    details = get_anime_details(item["tmdb_id"])
                elif item["type"] == "Manga":
                    details = get_manga_details(item["tmdb_id"])
                elif item["type"] == "Movies":
                    details = get_movie_details(item["tmdb_id"])
                elif item["type"] == "TV Series":
                    details = get_tv_details(item["tmdb_id"])
            except Exception as e:
                print(f"Error fetching details for suggestion {item.get('title')}: {e}")
                
            results.append({
                "title": details.get("title") or item["title"],
                "release_year": details.get("release_year") or item["release_year"],
                "cover_url": details.get("cover_url") or item["cover_url"],
                "type": item["type"],
                "tmdb_id": item["tmdb_id"],
                "reason": reason,
                "director": details.get("director"),
                "genres": details.get("genres"),
                "overview": details.get("overview")
            })
            
        return results
    except Exception as e:
        print("--- SUGGESTION ENGINE ERROR ---")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

class PassRequest(BaseModel):
    type: str
    tmdb_id: int
    title: str

@app.post("/api/suggestions/pass")
def pass_suggestion(req: PassRequest, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """
    Logs a suggestion as 'passed' so it won't be recommended again.
    """
    existing = session.exec(
        select(PassedSuggestion).where(
            PassedSuggestion.type == req.type,
            PassedSuggestion.tmdb_id == req.tmdb_id
        )
    ).first()
    
    if not existing:
        new_pass = PassedSuggestion(type=req.type, tmdb_id=req.tmdb_id, title=req.title)
        session.add(new_pass)
        session.commit()
        
    return {"status": "success", "message": "Suggestion passed."}

@app.get("/api/suggestions/passed")
def get_passed_suggestions(session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """
    Returns all passed suggestions for management.
    """
    passed = session.exec(select(PassedSuggestion).order_by(PassedSuggestion.passed_at.desc())).all()
    return passed

@app.delete("/api/suggestions/passed/{pass_id}")
def delete_passed_suggestion(pass_id: int, session: Session = Depends(get_session), _: None = Depends(check_readonly)):
    """
    Removes a suggestion from the passed list.
    """
    p = session.get(PassedSuggestion, pass_id)
    if not p:
        raise HTTPException(status_code=404, detail="Passed suggestion not found")
    session.delete(p)
    session.commit()
    return {"status": "success", "message": "Suggestion un-passed."}

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

@app.get("/api/recommendations/{item_id}")
def get_item_recommendations(item_id: int, session: Session = Depends(get_session)):
    """Fetches similar media recommendations for a specific library item."""
    item = session.get(MediaItem, item_id)
    if not item or not item.tmdb_id:
        return []
    
    try:
        if item.type in ["Anime", "Manga"]:
            return get_jikan_recommendations(item.tmdb_id, "anime" if item.type == "Anime" else "manga", limit=6)
        else:
            return get_tmdb_recommendations(item.tmdb_id, "movie" if item.type == "Movies" else "tv", limit=6)
    except Exception as e:
        print(f"Error fetching recommendations for {item.title}: {e}")
        return []

@app.get("/api/search/multi")
def search_multi(title: str, type: str, year: Optional[int] = None):
    """Searches for media items across APIs returning multiple results."""
    if type == "Movies":
        from tmdb_helper import search_tmdb_multi
        return search_tmdb_multi(title, year, "movie")
    elif type == "TV Series":
        from tmdb_helper import search_tmdb_multi
        return search_tmdb_multi(title, year, "tv")
    elif type == "Anime":
        from jikan_helper import search_jikan_multi
        return search_jikan_multi(title, "anime")
    elif type == "Manga":
        from jikan_helper import search_jikan_multi
        return search_jikan_multi(title, "manga")
    return []

@app.post("/api/recommendations/submit")
def submit_recommendation(rec: Recommendation, session: Session = Depends(get_session)):
    """Saves a recommendation."""
    session.add(rec)
    session.commit()
    return {"status": "success"}

# Mount static directory to serve frontend (CSS, JS, index.html)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
