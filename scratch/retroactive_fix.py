from sqlmodel import Session, select
from database import engine, MediaItem
import os

def fix_data():
    with Session(engine) as session:
        print("Starting Retroactive Data Fix...")

        # 1. Fix X2 (ID 1195 matched to Documentary ID 447133)
        # Correct TMDB ID for X2 (2003) is 36658
        x2 = session.exec(select(MediaItem).where(MediaItem.title == "X2")).first()
        if x2 and x2.tmdb_id == 447133:
            print(f"Fixing X2 (ID {x2.id}): Redirecting to correct X-Men TMDB record...")
            x2.tmdb_id = 36658
            x2.genres = "Adventure, Action, Science Fiction"
            x2.cover_url = "https://image.tmdb.org/t/p/w500/mX3LzXj6eI3YwGjJ77mZpTzP2Z.jpg" # X2 Poster
            session.add(x2)
            print("  [OK] X2 Fixed.")

        # 2. Fix Sinister Duplication (ID 1122 vs 1197)
        # We merge 1197 (Discord) into 1122 (Manual) and delete 1197
        sin_manual = session.get(MediaItem, 1122)
        sin_discord = session.get(MediaItem, 1197)
        if sin_manual and sin_discord:
            print(f"Merging Sinister duplicates (ID {sin_discord.id} -> {sin_manual.id})...")
            sin_manual.discord_id = sin_discord.discord_id
            sin_manual.release_year = 2012 # Correct year
            sin_manual.enrichment_attempts = 0 # Re-trigger enrichment
            session.add(sin_manual)
            session.delete(sin_discord)
            print("  [OK] Sinister Merged.")

        # 3. Reset "He Sees You When You're Sleeping" (Failed enrichment)
        hsy = session.exec(select(MediaItem).where(MediaItem.title.ilike("%He Sees You%"))).first()
        if hsy:
            print(f"Resetting enrichment for '{hsy.title}'...")
            hsy.enrichment_attempts = 0
            session.add(hsy)
            print("  [OK] Reset complete.")

        session.commit()
        print("Done.")

if __name__ == "__main__":
    fix_data()
