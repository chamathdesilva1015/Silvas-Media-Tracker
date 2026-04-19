from sqlmodel import Session, select
from database import engine, MediaItem
import re

def fix_manga():
    with Session(engine) as session:
        # 1. Fix "My Wife Is From A Thousand Years Ago"
        # Search by title containing "thousand years ago"
        q1 = select(MediaItem).where(MediaItem.title.like("%Thousand Years Ago%"))
        wives = session.exec(q1).all()
        for w in wives:
            print(f"Fixing: {w.title}...")
            w.genres = "Manhwa (Webtoon) - Romance/Fantasy"
            session.add(w)

        # 2. Fix "ReLIFE"
        q2 = select(MediaItem).where(MediaItem.title == "ReLIFE")
        relifes = session.exec(q2).all()
        for r in relifes:
            print(f"Fixing: {r.title}...")
            r.genres = "Manga (Webtoon) - Romance/Slice of Life"
            session.add(r)

        # 3. Fix "Tokyo Ghoul" (Ensure no Novel)
        q3 = select(MediaItem).where(MediaItem.title == "Tokyo Ghoul")
        ghouls = session.exec(q3).all()
        for g in ghouls:
            if "Novel" in (g.genres or ""):
                print(f"Fixing: {g.title} (removing Novel tag)...")
                g.genres = "Manga - Action/Horror"
                session.add(g)

        # 4. Global Purge of "Award Winning"
        q4 = select(MediaItem).where(MediaItem.genres.like("%Award Winning%"))
        awards = session.exec(q4).all()
        for a in awards:
            print(f"Cleaning Award Winning from: {a.title}...")
            # Remove "Award Winning" and handle slashes/spaces
            new_genres = a.genres.replace("Award Winning", "").replace("  ", " ").strip(" -/")
            # Fix potential double slashes like "Action / / Slice of Life"
            new_genres = re.sub(r'[/-]{2,}', '/', new_genres).strip(" /")
            a.genres = new_genres
            session.add(a)

        session.commit()
        print("Manga Accuracy Fixes Complete.")

if __name__ == "__main__":
    fix_manga()
