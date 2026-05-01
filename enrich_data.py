import asyncio
from typing import Optional, Callable
from sqlmodel import Session, select
from database import engine, MediaItem
from tmdb_helper import search_movie, get_movie_details

async def run_enrichment(log_func: Optional[Callable] = None, category: Optional[str] = None):
    """
    Main enrichment loop.
    Iterates through movies with missing genres and attempts to fill them from TMDB.
    Only processes 'Movies' category as per user requirement.
    """
    def log(msg):
        if log_func:
            log_func(msg)
        print(msg)

    # User explicitly requested Movies ONLY
    target_category = category if category == "Movies" else "Movies"
    if category and category != "Movies":
        log(f"Enrichment skipped for {category}. (Movies only enrichment enabled)")
        return {"status": "skipped", "message": "Movies only"}

    log(f"Starting Movie Enrichment...")
    
    with Session(engine) as session:
        # Select items that are Movies and haven't failed too many times
        # We process if genres are missing OR look like generic placeholders
        statement = select(MediaItem).where(
            MediaItem.type == "Movies",
            MediaItem.enrichment_attempts < 5
        ).where(
            (MediaItem.genres == None) | 
            (MediaItem.genres == "") | 
            (MediaItem.genres == "documentary") | 
            (MediaItem.genres.contains("Imported"))
        )
        
        items = session.exec(statement).all()
        
        if not items:
            log("No movies found requiring enrichment.")
            return {"status": "complete", "enriched_count": 0}

        log(f"Found {len(items)} movies to enrich.")
        enriched_count = 0
        
        for item in items:
            log(f"Processing: {item.title} ({item.release_year or '????'})")
            
            try:
                # 1. Search for TMDB ID (Primary search with year)
                tmdb_id = search_movie(item.title, item.release_year)
                
                # Fallback: If not found with year, try without year
                if not tmdb_id and item.release_year:
                    log(f"  [.] Not found with year. Trying title-only search...")
                    tmdb_id = search_movie(item.title)

                if not tmdb_id:
                    log(f"  [!] Not found on TMDB after fallback. Skipping.")
                    item.enrichment_attempts += 1
                    session.add(item)
                    session.commit()
                    continue
                
                # 2. Get details
                genres, poster_url = get_movie_details(tmdb_id)
                
                if genres:
                    item.genres = genres
                    item.tmdb_id = tmdb_id
                    # Update cover if not already set manually
                    if poster_url and (not item.cover_url or "discordapp" in item.cover_url):
                        item.cover_url = poster_url
                    
                    session.add(item)
                    session.commit()
                    enriched_count += 1
                    log(f"  [+] Enriched: {genres}")
                else:
                    log(f"  [!] No genre data found. Skipping.")
                    item.enrichment_attempts += 1
                    session.add(item)
                    session.commit()
                
                # Polite rate limiting
                await asyncio.sleep(0.2)

            except Exception as e:
                log(f"  [Error] {str(e)}")
                item.enrichment_attempts += 1
                session.add(item)
                session.commit()

        log(f"Enrichment complete. {enriched_count} items updated.")
        return {"status": "complete", "enriched_count": enriched_count}
