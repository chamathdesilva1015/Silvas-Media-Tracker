from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import List, Optional

from database import engine, create_db_and_tables, MediaItem

app = FastAPI(title="Silva's Media Tracker API")

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
def on_startup():
    create_db_and_tables()

@app.get("/api/media", response_model=List[MediaItem])
def read_media(session: Session = Depends(get_session)):
    media = session.exec(select(MediaItem).order_by(MediaItem.date_added.desc())).all()
    return media

@app.post("/api/media", response_model=MediaItem)
def create_media(item: MediaItem, session: Session = Depends(get_session)):
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

class ReviewPayload(BaseModel):
    title: str
    type: str
    review: Optional[str] = None

@app.post("/api/media/review")
def update_review(payload: ReviewPayload, session: Session = Depends(get_session)):
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

@app.post("/api/media/like/{item_id}")
def toggle_like(item_id: str, session: Session = Depends(get_session)):
    """Toggle is_liked on an item, then cascade to all rows with same title+type."""
    try:
        actual_id = int(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ID format")

    item = session.get(MediaItem, actual_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Flip the value
    new_liked = not item.is_liked

    # Cascade across all rows with the same title and type (Completed + Rankings)
    all_related = session.exec(
        select(MediaItem).where(MediaItem.type == item.type)
    ).all()
    related = [r for r in all_related if r.title.lower() == item.title.lower()]

    for r in related:
        r.is_liked = new_liked
        session.add(r)

    session.commit()
    print(f"[DEBUG] TOGGLED LIKE for '{item.title}' ({item.type}) -> {new_liked} ({len(related)} rows)")
    return {"ok": True, "is_liked": new_liked, "updated_count": len(related)}

@app.post("/api/media/delete/{item_id}")
@app.post("/api/media/delete/{item_id}/") # Trailing slash support
def delete_media(item_id: str, session: Session = Depends(get_session)):
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

# Mount static directory to serve frontend (CSS, JS, index.html)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
