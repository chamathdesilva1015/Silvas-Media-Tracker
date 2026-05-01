from sqlmodel import Session, select, create_engine
from database import MediaItem
import os

engine = create_engine('postgresql://postgres.jpnehzldhxjswpjqlkbg:Chamath%400928%21@aws-1-us-east-2.pooler.supabase.com:6543/postgres')

def has_review(r):
    if not r or not isinstance(r, str): return False
    r = r.strip().lower()
    if r == "" or r.startswith("imported from discord") or r.startswith("imported from letterboxd"):
        return False
    return True

def parse_score(i):
    val = i.numeric_rating
    if val is None:
        val = i.rating
    
    if val is None: return 0
    
    if isinstance(val, (int, float)):
        return float(val)
        
    if isinstance(val, str):
        if "/" in val:
            try:
                return float(val.split("/")[0])
            except:
                return 0
        try:
            return float(val)
        except:
            return 0
    return 0

with Session(engine) as session:
    items = session.exec(select(MediaItem).where(MediaItem.director == "Christopher Nolan")).all()
    total_passion = 0
    print(f"Fact Check: Christopher Nolan ({len(items)} items found)\n")
    
    for i in items:
        s = parse_score(i)
        weight = max(0, (s - 4.5)) ** 3
        liked_bonus = 1.25 if i.is_liked else 1.0
        review_bonus = 1.10 if has_review(i.review) else 1.0
        
        movie_pts = weight * liked_bonus * review_bonus
        total_passion += movie_pts
        
        print(f"- {i.title}")
        print(f"  Score: {s}/10 | Base Weight: {weight:.1f}")
        print(f"  Liked: {i.is_liked} (x{liked_bonus}) | Reviewed: {has_review(i.review)} (x{review_bonus})")
        print(f"  Total for movie: {movie_pts:.1f}\n")

    confidence = (1.0 - (1.0 / len(items))) if len(items) > 0 else 0
    final = total_passion * confidence
    
    print("-" * 30)
    print(f"Sum of Passion Weights: {total_passion:.1f}")
    print(f"Confidence Multiplier (1 - 1/{len(items)}): {confidence:.3f}")
    print(f"Calculated Final Score: {final:.1f}")
