import asyncio
import aiohttp
import re
from sqlmodel import Session, select
from database import engine, MediaItem

# API Endpoints
JIKAN_BASE = "https://api.jikan.moe/v4"
TVMAZE_BASE = "https://api.tvmaze.com"
WIKIPEDIA_SEARCH = "https://en.wikipedia.org/w/api.php"

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
    title = re.sub(r'\s*\(\d{4}\)\s*$', '', title)
    title = re.split(r'[:\-–—]', title)[0]
    title = re.sub(r'[!?.]', '', title)
    return title.strip()

async def get_anime_manga_year(session, title, type_):
    """Fetches release year from Jikan (MyAnimeList) API."""
    endpoint = "/anime" if type_ == "Anime" else "/manga"
    
    data = await fetch_json(session, f"{JIKAN_BASE}{endpoint}", params={"q": title, "limit": 5})
    
    if not data or not data.get('data'):
        cleaned = clean_title(title)
        if cleaned != title:
            data = await fetch_json(session, f"{JIKAN_BASE}{endpoint}", params={"q": cleaned, "limit": 5})
    
    if not data or not data.get('data'):
        last_ditch = re.sub(r'[^a-zA-Z0-9 ]', '', title)
        data = await fetch_json(session, f"{JIKAN_BASE}{endpoint}", params={"q": last_ditch, "limit": 5})

    if not data or not data.get('data'):
        return None
    
    results = data['data']
    
    def extract_year(item):
        year = item.get('year')
        if not year:
            date_field = 'aired' if type_ == "Anime" else 'published'
            date_str = item.get(date_field, {}).get('from')
            if date_str:
                m = re.search(r'(\d{4})', date_str)
                if m: year = int(m.group(1))
        return year

    manga_types = ["Manga", "Manhwa", "Manhua", "One-shot", "Doujinshi"]
    def get_priority(item):
        itype = item.get('type')
        if type_ == "Manga":
            if itype in manga_types: return 0
            if itype in ["Novel", "Light Novel"]: return 2
            return 1
        return 0

    results.sort(key=get_priority)

    for item in results:
        titles_to_check = [t.get('title', '').lower() for t in item.get('titles', [])]
        if title.lower() in titles_to_check:
            return extract_year(item)

    return extract_year(results[0])

async def enrich_tv_series_year(session, title):
    """Fetches release year from TVmaze API."""
    data = await fetch_json(session, f"{TVMAZE_BASE}/singlesearch/shows", params={"q": title})
    if not data:
        data = await fetch_json(session, f"{TVMAZE_BASE}/singlesearch/shows", params={"q": clean_title(title)})
        
    if data and data.get('premiered'):
        match = re.search(r'(\d{4})', data['premiered'])
        if match:
            return int(match.group(1))
            
    return None

async def get_movie_year(session, title):
    """Fetches release year from Wikipedia intro."""
    search_queries = [f"{title} film", f"{clean_title(title)} film", f"{title} movie", title]
    
    for query in search_queries:
        params = {"action": "query", "list": "search", "srsearch": query, "format": "json"}
        search_data = await fetch_json(session, WIKIPEDIA_SEARCH, params=params)
        
        if not search_data or not search_data.get('query', {}).get('search'):
            continue

        best_page = search_data['query']['search'][0]['title']
        
        params = {
            "action": "query", "prop": "extracts", "exintro": "", 
            "explaintext": "", "titles": best_page, "format": "json", "redirects": 1
        }
        page_data = await fetch_json(session, WIKIPEDIA_SEARCH, params=params)
        
        if not page_data: continue
        
        pages = page_data.get('query', {}).get('pages', {})
        extract = ""
        for p_id in pages:
            extract = pages[p_id].get('extract', '')
            break
            
        if not extract: continue
        
        m_year = re.search(r'\b(1[89]\d{2}|20[0-2]\d)\b', extract)
        if m_year: 
            return int(m_year.group(1))
                
    return None

async def run_enrichment(log_func=print, category=None):
    log_func("=== Silva's Media Tracker: Release Year Auto-Fill Utility ===\n")
    
    async with aiohttp.ClientSession(headers={"User-Agent": "SilvasMediaTracker/1.0"}) as session:
        with Session(engine) as db_session:
            query = select(MediaItem).where(MediaItem.release_year == None).where(MediaItem.enrichment_attempts < 3)
            
            if category:
                query = query.where(MediaItem.type.ilike(category))
            
            items_to_enrich = db_session.exec(query.order_by(MediaItem.enrichment_attempts.asc())).all()
            
            total = len(items_to_enrich)
            if total == 0:
                log_func("[Auto-Fill] All release years already populated! (or unfindable)")
                return {"status": "success", "updated": 0}
                
            log_func(f"[Auto-Fill] Found {total} items missing release years. Starting search...")
            
            enriched_count = 0
            
            for index, item in enumerate(items_to_enrich):
                current_num = index + 1
                log_func(f"[{current_num}/{total}] Searching for: {item.title}...")
                
                item.enrichment_attempts += 1
                db_session.add(item)
                db_session.commit()
                
                found_year = None
                if item.type == "Anime":
                    found_year = await get_anime_manga_year(session, item.title, "Anime")
                elif item.type == "Manga":
                    found_year = await get_anime_manga_year(session, item.title, "Manga")
                elif item.type == "TV Series":
                    found_year = await enrich_tv_series_year(session, item.title)
                elif item.type == "Movies":
                    found_year = await get_movie_year(session, item.title)
                
                if found_year:
                    log_func(f"    [+] release_year: {found_year}")
                    item.release_year = found_year
                    db_session.add(item)
                    enriched_count += 1
                else:
                    log_func(f"    [?] No year found.")
                
                if item.type in ["Anime", "Manga"]:
                    await asyncio.sleep(1.5)
                else:
                    await asyncio.sleep(0.5)

            db_session.commit()
    
    return {"status": "success", "updated": enriched_count}

if __name__ == "__main__":
    asyncio.run(run_enrichment())
