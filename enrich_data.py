import asyncio
from typing import Optional, Callable
from sqlmodel import Session, select
from database import engine, MediaItem
from tmdb_helper import search_tmdb, get_tmdb_details

async def run_enrichment(log_func: Optional[Callable] = None, category: Optional[str] = None):
    """
    Main enrichment loop.
    Iterates through movies/tv with missing genres OR missing metadata
    and attempts to fill them from TMDB.
    """
    def log(msg):
        if log_func:
            log_func(msg)
        print(msg)

    # Process all categories (Movies, TV Series, Anime, Manga)
    valid_categories = ["Movies", "TV Series", "Anime", "Manga"]
    target_categories = [category] if category else valid_categories
    log(f"Starting Media Enrichment for: {', '.join(target_categories)}...")
    
    with Session(engine) as session:
        # Select items that need enrichment
        statement = select(MediaItem).where(
            MediaItem.type.in_(target_categories),
            MediaItem.enrichment_attempts < 5
        ).where(
            (MediaItem.genres == None) | 
            (MediaItem.genres == "") | 
            (MediaItem.genres == "documentary") | 
            (MediaItem.genres.contains("Imported")) |
            (MediaItem.director == None)
        )
        
        items = session.exec(statement).all()
        
        if not items:
            log("No items found requiring enrichment.")
            return {"status": "complete", "enriched_count": 0}

        log(f"Found {len(items)} items to enrich.")
        enriched_count = 0
        
        from jikan_helper import search_manga, get_manga_details

        for item in items:
            log(f"Processing {item.type}: {item.title} ({item.release_year or '????'})")
            
            try:
                details = None
                tmdb_id = item.tmdb_id
                
                # BRANCH: Manga (Jikan/MAL) vs Others (TMDB)
                if item.type == "Manga":
                    if not tmdb_id:
                        tmdb_id = search_manga(item.title)
                    if tmdb_id:
                        details = get_manga_details(tmdb_id)
                else:
                    media_type_flag = "movie" if item.type == "Movies" else "tv"
                    if not tmdb_id:
                        tmdb_id = search_tmdb(item.title, item.release_year, media_type_flag)
                        if not tmdb_id and item.release_year:
                            log(f"  [.] Not found with year. Trying title-only search...")
                            tmdb_id = search_tmdb(item.title, media_type=media_type_flag)
                    
                    if tmdb_id:
                        details = get_tmdb_details(tmdb_id, media_type_flag)

                if not tmdb_id or not details:
                    log(f"  [!] Not found on any source. Skipping.")
                    item.enrichment_attempts += 1
                    session.add(item)
                    session.commit()
                    continue
                
                # 3. Write data to DB
                if details.get("genres"):
                    item.genres = details["genres"]
                    item.tmdb_id = tmdb_id
                
                if details.get("poster_url") and (not item.cover_url or "discordapp" in item.cover_url):
                    item.cover_url = details["poster_url"]
                
                if details.get("director"):
                    item.director = details["director"]
                if details.get("runtime"):
                    item.runtime = details["runtime"]
                if details.get("content_rating"):
                    item.content_rating = details["content_rating"]
                    
                session.add(item)
                session.commit()
                enriched_count += 1
                
                label = "Author" if item.type == "Manga" else ("Director" if item.type == "Movies" else "Creator")
                log(f"  [+] Enriched: {details.get('genres')} | {label}: {details.get('director')} | {details.get('runtime', 'N/A')}min | {details.get('content_rating')}")
                
                await asyncio.sleep(0.5 if item.type == "Manga" else 0.2) # Be kinder to Jikan

            except Exception as e:
                log(f"  [Error] {str(e)}")
                item.enrichment_attempts += 1
                session.add(item)
                session.commit()

        log(f"Enrichment complete. {enriched_count} items updated.")
        return {"status": "complete", "enriched_count": enriched_count}

if __name__ == "__main__":
    asyncio.run(run_enrichment())
