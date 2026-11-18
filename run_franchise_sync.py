from sqlmodel import Session, select
from database import engine, MediaItem
from jikan_helper import check_anime_franchise_eligibility, guess_anime_branch
from main import bump_data_version
import time

def run_sync():
    with Session(engine) as session:
        animes = session.exec(select(MediaItem).where(MediaItem.type == "Anime")).all()
        print(f"Total anime entries in DB: {len(animes)}")

        updated = 0
        standalones = 0
        errors = 0

        for a in animes:
            mal_id = int(a.tmdb_id) if a.tmdb_id and str(a.tmdb_id).isdigit() else None
            
            # If already has franchise, verify or keep
            if a.anime_franchise:
                continue

            # It's currently standalone in DB (like Apothecary Diaries, Frieren, etc.)
            elig = check_anime_franchise_eligibility(mal_id=mal_id, title=a.title)
            
            if elig is None:
                # Rate limit or API error
                print(f"[!] API error / rate limit for '{a.title}' - skipping")
                errors += 1
                time.sleep(2)
                continue

            if elig.get("has_franchise"):
                f_name = elig.get("franchise_name") or a.title
                print(f"[+] PROMOTED TO FRANCHISE -> '{a.title}' -> Franchise: '{f_name}' ({elig.get('relations_count')} in-universe relations)")
                a.anime_franchise = f_name
                session.add(a)
                updated += 1
            else:
                # Confirmed zero animated relations (e.g. Orb, Tomodachi Game)
                standalones += 1

            # Rate limit politeness: 0.7s sleep ensures max ~80 req/min (under AniList's 90 limit)
            time.sleep(0.7)

        print(f"\n[SUMMARY]:")
        print(f"  Promoted to Franchise: {updated}")
        print(f"  Confirmed Standalone: {standalones}")
        print(f"  Errors/Skipped: {errors}")

        if updated > 0:
            bump_data_version(session)
            session.commit()
            print("[✓] Successfully committed to database and bumped sync version!")

if __name__ == "__main__":
    run_sync()

