import asyncio
import aiohttp
from sqlmodel import Session, select
from database import engine, MediaItem
from enrich_data import get_anime_manga_data, GOLDEN_LIST, GENRE_BLACKLIST

async def global_refresh():
    async with aiohttp.ClientSession() as session:
        with Session(engine) as db_session:
            # 1. Refresh Manga and Anime (the most likely to be inaccurate)
            statement = select(MediaItem).where(MediaItem.type.in_(["Manga", "Anime"]))
            items = db_session.exec(statement).all()
            
            print(f"Refreshing {len(items)} entries (Manga/Anime)...")
            for item in items:
                print(f"  Enriching: {item.title}...")
                data = await get_anime_manga_data(session, item.title, item.type)
                
                if data and data.get("genres") is not None:
                    print(f"    -> Updated: {data['genres']}")
                    item.genres = data["genres"]
                    db_session.add(item)
                    db_session.commit()
                else:
                    print(f"    [!] No data for {item.title}")
                
                await asyncio.sleep(0.5) # Rate limit safety

            # 2. Cleanup Movies and TV (Strip manual artifacts)
            statement2 = select(MediaItem).where(MediaItem.type.in_(["Movies", "TV Series"]))
            other_items = db_session.exec(statement2).all()
            for item in other_items:
                if not item.genres: continue
                # Strip "Manga - ", "Movies - ", etc.
                new_val = item.genres
                if " - " in new_val:
                    new_val = new_val.split(" - ")[-1]
                
                # Strip Award Winning
                for b in GENRE_BLACKLIST:
                    if b in new_val:
                        new_val = new_val.replace(b, "").strip(" /-,")
                
                if new_val != item.genres:
                    print(f"  Cleaning {item.type}: {item.title} ({item.genres} -> {new_val})")
                    item.genres = new_val
                    db_session.add(item)
                    db_session.commit()

            print("Global Refresh Complete.")

if __name__ == "__main__":
    asyncio.run(global_refresh())
