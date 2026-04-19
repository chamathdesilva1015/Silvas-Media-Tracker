import asyncio
import aiohttp
from sqlmodel import Session, select
from database import engine, MediaItem
from enrich_data import get_anime_manga_data

async def refresh_manga():
    async with aiohttp.ClientSession() as session:
        with Session(engine) as db_session:
            # Select all items categorized as 'Manga'
            statement = select(MediaItem).where(MediaItem.type == "Manga")
            manga_items = db_session.exec(statement).all()
            
            print(f"Found {len(manga_items)} Manga entries to refresh.")
            
            for item in manga_items:
                print(f"Refining: {item.title}...")
                data = await get_anime_manga_data(session, item.title, "Manga")
                
                if data and data.get("genres"):
                    print(f"  -> Old: {item.genres}")
                    print(f"  -> New: {data['genres']}")
                    item.genres = data["genres"]
                    # Also update year if missing
                    if not item.release_year and data.get("year"):
                        item.release_year = data["year"]
                    
                    db_session.add(item)
                    db_session.commit()
                    print(f"  [+] Updated.")
                else:
                    print(f"  [!] No enrichment found for {item.title}")
                
                # Jikan Rate limit avoidance
                await asyncio.sleep(1.0) 

if __name__ == "__main__":
    asyncio.run(refresh_manga())
