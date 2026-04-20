import asyncio
import aiohttp
import re
import os
from sqlmodel import Session, select
from database import engine, MediaItem
from typing import Optional

# API Endpoints
JIKAN_BASE = "https://api.jikan.moe/v4"
TVMAZE_BASE = "https://api.tvmaze.com"
WIKIPEDIA_SEARCH = "https://en.wikipedia.org/w/api.php"

# Source of truth manual overrides for high-priority items
MANUAL_METADATA_OVERRIDES = {
    "A Silent Voice": {"genres": "Romance/Drama"},
    "Haikyu!!": {"genres": "Sports"},
    "Solo Leveling": {"genres": "Action/Adventure"},
    "Tokyo Ghoul": {"genres": "Action/Horror"},
    "ReLIFE": {"genres": "Romance/Slice of Life"}
}

# Meta-tags that often appear in MAL genre lists but aren't useful categories
GENRE_BLACKLIST = {
    "Award Winning", "Demographics", "Shounen", "Seinen", "Shoujo", "Josei", 
    "Kids", "Unknown", "Adult Cast", "Themes"
}

# Mapping of specific themes/sub-genres to main categories
GENRE_MAP = {
    "Romantic Subtext": "Romance",
    "Team Sports": "Sports",
    "Combat Sports": "Sports",
    "Martial Arts": "Action",
    "Gore": "Horror"
}

# Core defining genres (High Priority)
PRIMARY_GENRES = [
    "Romance", "Drama", "Action", "Fantasy", "Adventure", "Comedy", 
    "Horror", "Sci-Fi", "Sports", "Mystery", "Thriller", 
    "Supernatural", "Psychological", "Crime", "Western", "War", 
    "Documentary", "Animation", "Musical", "History", "Biography"
]

# Secondary settings/themes (Lower Priority)
SUPPORTING_THEMES = [
    "Slice of Life", "School"
]

# Fallback complements to ensure exactly 2 genres for Movies
GENRE_COMPLEMENTS = {
    "Action": "Adventure",
    "Animation": "Comedy",
    "Horror": "Thriller",
    "Comedy": "Drama",
    "Drama": "Thriller",
    "Sci-Fi": "Action",
    "Fantasy": "Adventure",
    "Crime": "Drama",
    "Mystery": "Thriller",
    "War": "Drama",
    "Documentary": "History",
    "Sports": "Drama",
    "Musical": "Comedy",
    "Western": "Action",
    "Thriller": "Action",
    "Adventure": "Action",
    "History": "Drama",
    "Biography": "Drama",
    "Psychological": "Thriller",
    "Supernatural": "Horror",
    "Romance": "Drama"
}

async def fetch_json(session, url, params=None):
    headers = {"User-Agent": "SilvasMediaTracker/1.0 (https://github.com/cdesilva/media-tracker; silva@example.com)"}
    try:
        async with session.get(url, params=params, headers=headers, timeout=10) as response:
            if response.status == 429:
                print(f"[!] Rate limited on {url}, waiting 10s...")
                await asyncio.sleep(10)
                return await fetch_json(session, url, params)
            if response.status != 200:
                return None
            return await response.json()
    except Exception as e:
        print(f"[!] Error fetching {url}: {e}")
        return None

def clean_title(title: str) -> str:
    """Removes special characters, subtitles, and trailing years that might confuse APIs."""
    # Remove trailing parenthetical year (e.g., "(2002)")
    title = re.sub(r'\s*\(\d{4}\)\s*$', '', title)
    # Remove everything after a colon or dash (often subtitles)
    title = re.split(r'[:\-–—]', title)[0]
    # Remove punctuation like ! ? .
    title = re.sub(r'[!?.]', '', title)
    return title.strip()

async def get_anime_manga_data(session, title, type_):
    """Fetches release year and genres from Jikan (MyAnimeList) API."""
    # Check manual overrides first
    if title in MANUAL_METADATA_OVERRIDES:
        print(f"[+] Using manual override for {title}")
        override = MANUAL_METADATA_OVERRIDES[title]
        return {"year": override.get("year"), "genres": override.get("genres")}

    endpoint = "/anime" if type_ == "Anime" else "/manga"
    
    # Try with original title first, fetching more results to avoid Season 2/Sequel bias
    data = await fetch_json(session, f"{JIKAN_BASE}{endpoint}", params={"q": title, "limit": 5})
    
    # If failed, try with cleaned title
    if not data or not data.get('data'):
        cleaned = clean_title(title)
        if cleaned != title:
            data = await fetch_json(session, f"{JIKAN_BASE}{endpoint}", params={"q": cleaned, "limit": 5})
    
    if not data or not data.get('data'):
        # Last ditch: search for just the alphabet characters
        last_ditch = re.sub(r'[^a-zA-Z0-9 ]', '', title)
        data = await fetch_json(session, f"{JIKAN_BASE}{endpoint}", params={"q": last_ditch, "limit": 5})

    if not data or not data.get('data'):
        return {"year": None, "genres": None}
    
    # Iterate through results to find the first one with a year (prefers Season 1 over upcoming sequels)
    results = data['data']
    
    def extract_info(item):
        info = {"year": None, "genres": None}
        # Get year
        info["year"] = item.get('year')
        if not info["year"]:
            date_field = 'aired' if type_ == "Anime" else 'published'
            date_str = item.get(date_field, {}).get('from')
            if date_str:
                m = re.search(r'(\d{4})', date_str)
                if m: info["year"] = int(m.group(1))
        
        # Combine Genres, Themes, and Demographics, but filter out blacklisted tags
        raw_tags = []
        for key in ['genres', 'themes', 'demographics']:
            raw_tags.extend([g.get('name') for g in item.get(key, []) if g.get('name')])
            
        # Clean and deduplicate while preserving order
        mapped_tags = []
        for tag in raw_tags:
            if tag in GENRE_BLACKLIST:
                continue
            # Map aliases
            mapped = GENRE_MAP.get(tag, tag)
            if mapped not in mapped_tags:
                mapped_tags.append(mapped)

        # Separate into Primary and Supporting
        primaries = [t for t in mapped_tags if t in PRIMARY_GENRES]
        supporting = [t for t in mapped_tags if t in SUPPORTING_THEMES]
        
        # Sort primaries by their order in PRIMARY_GENRES
        primaries.sort(key=lambda t: PRIMARY_GENRES.index(t))
        
        # Final Selection: Max 2 tags
        # Rule 1: Always prioritize Sports to #1 if it's there
        if "Sports" in primaries:
            primaries.remove("Sports")
            primaries.insert(0, "Sports")
            
        final_tags = []
        # Add up to 2 primaries
        final_tags.extend(primaries[:2])
        
        # If we have space, add supporting themes
        if len(final_tags) < 2:
            for s in supporting:
                if s not in final_tags:
                    final_tags.append(s)
                    if len(final_tags) == 2: break

        if final_tags:
            info["genres"] = "/".join(final_tags[:2])
        else:
            info["genres"] = ""
            
        return info

    # Sort results: Prioritize Manga/Manhwa over Novels if in Manga section
    manga_types = ["Manga", "Manhwa", "Manhua", "One-shot", "Doujinshi"]
    def get_priority(item):
        itype = item.get('type')
        if type_ == "Manga":
            if itype in manga_types: return 0
            if itype in ["Novel", "Light Novel"]: return 2
            return 1
        return 0

    results.sort(key=get_priority)

    # 1. Try to find an exact title match with a year
    for item in results:
        titles_to_check = [t.get('title', '').lower() for t in item.get('titles', [])]
        if title.lower() in titles_to_check:
            return extract_info(item)

    # 2. Fallback: Take the best priority result
    return extract_info(results[0])

async def enrich_tv_series(session, title):
    """Fetches release year and primary genre from TVmaze API."""
    data = await fetch_json(session, f"{TVMAZE_BASE}/singlesearch/shows", params={"q": title})
    if not data:
        data = await fetch_json(session, f"{TVMAZE_BASE}/singlesearch/shows", params={"q": clean_title(title)})
        
    result = {"year": None, "genre": None}
    if data:
        if data.get('premiered'):
            match = re.search(r'(\d{4})', data['premiered'])
            if match:
                result["year"] = int(match.group(1))
        
        # Pull official primary genre
        genres = data.get('genres', [])
        if genres:
            result["genre"] = genres[0] # Pick the primary genre
            
    return result

async def get_movie_data(session, title):
    """Fetches release year and exactly 2 genres from Wikipedia categories and intro."""
    search_queries = [f"{title} film", f"{clean_title(title)} film", f"{title} movie", title]
    
    result = {"year": None, "genres": None}
    
    for query in search_queries:
        # Search for exact page title
        params = {"action": "query", "list": "search", "srsearch": query, "format": "json"}
        search_data = await fetch_json(session, WIKIPEDIA_SEARCH, params=params)
        
        if not search_data or not search_data.get('query', {}).get('search'):
            continue

        best_page = search_data['query']['search'][0]['title']
        
        # Get extract AND categories
        params = {
            "action": "query", "prop": "extracts|categories", "exintro": "", 
            "explaintext": "", "cllimit": "max", "titles": best_page, "format": "json", "redirects": 1
        }
        page_data = await fetch_json(session, WIKIPEDIA_SEARCH, params=params)
        
        if not page_data: continue
        
        pages = page_data.get('query', {}).get('pages', {})
        extract = ""
        categories = []
        for p_id in pages:
            extract = pages[p_id].get('extract', '')
            categories = [c.get('title', '') for c in pages[p_id].get('categories', [])]
            break
            
        if not extract: continue
        
        # Extract Year from extract
        m_year = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', extract)
        if m_year: result["year"] = int(m_year.group(1))
        
            
        if result["year"]:
            return result
                
    return result

async def verify_item(session, item: MediaItem):
    print(f"[*] Enriching: {item.title} ({item.type})...")
    
    updates = {}
    
    if item.type == "Anime":
        data = await get_anime_manga_data(session, item.title, "Anime")
        if data["year"]: updates["release_year"] = data["year"]
    elif item.type == "Manga":
        data = await get_anime_manga_data(session, item.title, "Manga")
        if data["year"]: updates["release_year"] = data["year"]
    elif item.type == "TV Series":
        tv_data = await enrich_tv_series(session, item.title)
        if tv_data["year"]: updates["release_year"] = tv_data["year"]
    elif item.type == "Movies":
        movie_data = await get_movie_data(session, item.title)
        if movie_data["year"]: updates["release_year"] = movie_data["year"]
    
    if updates:
        for k, v in updates.items():
            print(f"    [+] {k}: {v}")
        return updates
    else:
        print(f"    [?] Nothing new found.")
        return None

async def run_enrichment(log_func=print, category=None):
    log_func("=== Silva's Media Tracker: Data Enrichment Utility ===\n")
    
    async with aiohttp.ClientSession(headers={"User-Agent": "SilvasMediaTracker/1.0"}) as session:
        with Session(engine) as db_session:
            # We target items missing EITHER year OR genres, prioritizing those with fewer attempts
            query = select(MediaItem).where(
                (MediaItem.release_year == None)
            ).where(
                MediaItem.enrichment_attempts < 3
            )
            
            # Application of Category Filter
            if category:
                query = query.where(MediaItem.type.ilike(category))
            
            items_to_enrich = db_session.exec(query.order_by(MediaItem.enrichment_attempts.asc())).all()
            
            total = len(items_to_enrich)
            if total == 0:
                log_func("[Auto-Fill] Everything is already enriched! (or marked unfindable)")
                return {"status": "success", "updated": 0}
                
            log_func(f"[Auto-Fill] Found {total} items needing data. Starting magic...")
            
            enriched_count = 0
            
            for index, item in enumerate(items_to_enrich):
                current_num = index + 1
                log_func(f"[{current_num}/{total}] Searching for: {item.title}...")
                
                # Increment attempts
                item.enrichment_attempts += 1
                db_session.add(item)
                db_session.commit() # Save attempt count immediately in case of crash/timeout
                
                updates = {}
                
                if item.type == "Anime":
                    anime_data = await get_anime_manga_data(session, item.title, "Anime")
                    if anime_data["year"]: updates["release_year"] = anime_data["year"]
                elif item.type == "Manga":
                    manga_data = await get_anime_manga_data(session, item.title, "Manga")
                    if manga_data["year"]: updates["release_year"] = manga_data["year"]
                elif item.type == "TV Series":
                    tv_data = await enrich_tv_series(session, item.title)
                    if tv_data["year"]: updates["release_year"] = tv_data["year"]
                elif item.type == "Movies":
                    movie_data = await get_movie_data(session, item.title)
                    if movie_data["year"]: updates["release_year"] = movie_data["year"]
                
                if updates:
                    for k, v in updates.items():
                        log_func(f"    [+] {k}: {v}")
                    
                    for field, value in updates.items():
                        setattr(item, field, value)
                    db_session.add(item)
                    enriched_count += 1
                else:
                    log_func(f"    [?] Nothing new found.")
                
                # Delay to respect rate limits
                if item.type in ["Anime", "Manga"]:
                    await asyncio.sleep(1.5)
                else:
                    await asyncio.sleep(0.5)

            db_session.commit()
    
    return {"status": "success", "updated": results["updated"]}

if __name__ == "__main__":
    asyncio.run(run_enrichment())
