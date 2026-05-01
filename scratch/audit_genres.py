from sqlmodel import Session, select
from database import engine, MediaItem

def audit_genres():
    with Session(engine) as session:
        items = session.exec(select(MediaItem).where(MediaItem.type == "Movies")).all()
        
        # Parse scores
        scored = []
        for i in items:
            try:
                if i.numeric_rating and '/' in i.numeric_rating:
                    s = float(i.numeric_rating.split('/')[0])
                    scored.append((s, i))
            except:
                continue
        
        # Genre weighted totals
        genre_weights = {}
        for s, i in scored:
            if not i.genres or s < 5:
                continue
            
            weight = (s - 4) ** 3
            parts = [g.strip() for g in i.genres.split(",")]
            for p in parts:
                genre_weights[p] = genre_weights.get(p, 0) + weight
        
        # Sort genres
        sorted_genres = sorted(genre_weights.items(), key=lambda x: -x[1])
        
        print(f"Top 5 Genres by Cubic Weight:")
        for g, w in sorted_genres[:5]:
            print(f"- {g}: {w:.1f} pts")
            
        print("\nSignificant Comedy Entries:")
        comedy_items = [ (s, i) for s, i in scored if i.genres and "Comedy" in i.genres ]
        comedy_items.sort(key=lambda x: -x[0])
        for s, i in comedy_items[:10]:
            w = (s - 4) ** 3
            print(f"- {i.title} ({s}/10): {w:.1f} pts | All Genres: {i.genres}")

if __name__ == "__main__":
    audit_genres()
