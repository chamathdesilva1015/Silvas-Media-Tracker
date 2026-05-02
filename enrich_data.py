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

    # Process either a specific category or both Movies/TV Series
    valid_categories = ["Movies", "TV Series"]
    if category and category not in valid_categories:
        log(f"Enrichment skipped for {category}. (TMDB only supports Movies/TV)")
        return {"status": "skipped", "message": "Unsupported category"}

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
        
        for item in items:
            media_type_flag = "movie" if item.type == "Movies" else "tv"
            log(f"Processing {item.type}: {item.title} ({item.release_year or '????'})")
            
            try:
                # 1. Search for TMDB ID
                tmdb_id = item.tmdb_id or search_tmdb(item.title, item.release_year, media_type_flag)
                
                # Fallback: title-only search
                if not tmdb_id and item.release_year:
                    log(f"  [.] Not found with year. Trying title-only search...")
                    tmdb_id = search_tmdb(item.title, media_type=media_type_flag)

                if not tmdb_id:
                    log(f"  [!] Not found on TMDB after fallback. Skipping.")
                    item.enrichment_attempts += 1
                    session.add(item)
                    session.commit()
                    continue
                
                # 2. Get full details
                details = get_tmdb_details(tmdb_id, media_type_flag)
                
                if not details:
                    log(f"  [!] No data returned from TMDB. Skipping.")
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
                
                label = "Director" if media_type_flag == "movie" else "Creator"
                log(f"  [+] Enriched: {details.get('genres')} | {label}: {details.get('director')} | {details.get('runtime')}min | {details.get('content_rating')}")
                
                await asyncio.sleep(0.2)

            except Exception as e:
                log(f"  [Error] {str(e)}")
                item.enrichment_attempts += 1
                session.add(item)
                session.commit()

        log(f"Enrichment complete. {enriched_count} items updated.")
        return {"status": "complete", "enriched_count": enriched_count}
