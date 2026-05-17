import requests
import time
from typing import Optional, Dict, List
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://api.jikan.moe/v4"

ANIME_CACHE = {}
MANGA_CACHE = {}

def _jikan_get(url: str, params: Optional[Dict] = None) -> requests.Response:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    # Jikan's public API is rate limited. Retry on 429 with exponential backoff
    for attempt in range(3):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=8)
            if response.status_code == 429:
                time.sleep(2 * (attempt + 1))
                continue
            return response
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                raise e
            time.sleep(1)
    return requests.get(url, params=params, headers=headers, timeout=8)


def search_manga(title: str) -> Optional[int]:
    """
    Searches for a manga and returns its MyAnimeList (MAL) ID.
    """
    url = f"{BASE_URL}/manga"
    params = {"q": title, "limit": 5}
    
    try:
        response = _jikan_get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("data", [])
        if not results:
            return None
            
        from thefuzz import fuzz
        
        # Match by title similarity
        best_match = None
        highest_score = 0
        
        for r in results:
            api_title = r.get("title", "")
            # Check primary title and English title
            titles_to_check = [api_title]
            if r.get("title_english"):
                titles_to_check.append(r["title_english"])
            
            for t in titles_to_check:
                score = fuzz.token_sort_ratio(t.lower(), title.lower())
                if score > highest_score:
                    highest_score = score
                    best_match = r
        
        # Threshold: 70% similarity to avoid "Tonegawa" vs "Tonikawa"
        if best_match and highest_score > 70:
            return best_match["mal_id"]
        
        return None
    except Exception as e:
        print(f"Jikan Search Error for '{title}': {e}")
    return None

def search_anime(title: str) -> Optional[int]:
    """
    Searches for an anime and returns its MyAnimeList (MAL) ID.
    """
    url = f"{BASE_URL}/anime"
    params = {"q": title, "limit": 5}
    
    try:
        response = _jikan_get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("data", [])
        if not results:
            return None
            
        from thefuzz import fuzz
        
        # Match by title similarity
        best_match = None
        highest_score = 0
        
        for r in results:
            api_title = r.get("title", "")
            # Check primary title and English title
            titles_to_check = [api_title]
            if r.get("title_english"):
                titles_to_check.append(r["title_english"])
            
            for t in titles_to_check:
                score = fuzz.token_sort_ratio(t.lower(), title.lower())
                if score > highest_score:
                    highest_score = score
                    best_match = r
        
        # Threshold: 70% similarity
        if best_match and highest_score > 70:
            return best_match["mal_id"]
        
        return None
    except Exception as e:
        print(f"Jikan Anime Search Error for '{title}': {e}")
    return None

def get_manga_details(mal_id: int) -> Dict:
    """
    Fetches genres, poster, and author for a manga.
    """
    if mal_id in MANGA_CACHE:
        return MANGA_CACHE[mal_id]
        
    url = f"{BASE_URL}/manga/{mal_id}/full"
    
    try:
        response = _jikan_get(url)
        response.raise_for_status()
        data = response.json().get("data", {})
        
        # --- Genres ---
        genres_list = data.get("genres", []) + data.get("explicit_genres", []) + data.get("themes", []) + data.get("demographics", [])
        genres = ", ".join([g["name"] for g in genres_list]) if genres_list else None
        
        # --- Poster ---
        poster_url = data.get("images", {}).get("webp", {}).get("large_image_url")
        
        # --- Author ---
        authors_list = data.get("authors", [])
        author = authors_list[0]["name"] if authors_list else None
        # Jikan often returns "Lastname, Firstname", let's flip it if comma exists
        if author and "," in author:
            parts = author.split(",")
            author = f"{parts[1].strip()} {parts[0].strip()}"
            
        result = {
            "title": data.get("title_english") or data.get("title"),
            "release_year": str(data.get("published", {}).get("prop", {}).get("from", {}).get("year", "")) or None,
            "genres": genres,
            "cover_url": poster_url,
            "director": author, # Store in director field for consistency
            "tmdb_id": mal_id,   # Use mal_id as tmdb_id for internal tracking
            "content_rating": None,
            "overview": data.get("synopsis"),
            "manga_status": data.get("status"),
            "total_chapters": data.get("chapters")
        }
        MANGA_CACHE[mal_id] = result
        return result
    except Exception as e:
        print(f"Jikan Details Error for ID {mal_id}: {e}")
    return {}

def get_anime_details(mal_id: int) -> dict:
    """
    Fetches genres, poster, director, and year for an anime using Jikan (MAL).
    """
    if mal_id in ANIME_CACHE:
        return ANIME_CACHE[mal_id]
        
    url = f"{BASE_URL}/anime/{mal_id}/full"
    
    try:
        response = _jikan_get(url)
        response.raise_for_status()
        data = response.json().get("data", {})
        
        # --- Genres ---
        genres_list = data.get("genres", []) + data.get("explicit_genres", []) + data.get("themes", []) + data.get("demographics", [])
        genres = ", ".join([g["name"] for g in genres_list]) if genres_list else None
        
        # --- Poster ---
        poster_url = data.get("images", {}).get("webp", {}).get("large_image_url")
        
        # --- Studio / Director (use studio name as director field) ---
        studios = data.get("studios", [])
        studio = studios[0]["name"] if studios else None
        
        # --- Year ---
        release_year = None
        aired = data.get("aired", {}).get("prop", {}).get("from", {})
        if aired.get("year"):
            release_year = str(aired["year"])
        
        result = {
            "title": data.get("title_english") or data.get("title"),
            "release_year": release_year,
            "genres": genres,
            "cover_url": poster_url,
            "director": studio,
            "tmdb_id": mal_id,
            "content_rating": data.get("rating"),
            "overview": data.get("synopsis")
        }
        ANIME_CACHE[mal_id] = result
        return result
    except Exception as e:
        print(f"Jikan Anime Details Error for ID {mal_id}: {e}")
    return {}

def get_jikan_recommendations(mal_id: int, media_type: str = "anime", limit: int = 5) -> List[dict]:
    """
    Fetches recommendations for a specific anime or manga.
    Enriches with details to provide English translated titles, release years, and other rich metadata.
    """
    endpoint = "anime" if media_type == "anime" else "manga"
    url = f"{BASE_URL}/{endpoint}/{mal_id}/recommendations"
    
    try:
        response = _jikan_get(url)
        response.raise_for_status()
        data = response.json()
        
        candidates = data.get("data", [])[:limit]
        
        def enrich_entry(r):
            entry = r.get("entry", {})
            rec_id = entry.get("mal_id")
            romaji_title = entry.get("title")
            poster_url = entry.get("images", {}).get("webp", {}).get("large_image_url")
            
            if not rec_id:
                return None
                
            details = {}
            try:
                if media_type == "anime":
                    details = get_anime_details(rec_id)
                else:
                    details = get_manga_details(rec_id)
            except Exception as e:
                print(f"Jikan enrichment error for ID {rec_id}: {e}")
                
            # Fallback to TMDB if Jikan details failed for Anime
            if not details and media_type == "anime" and romaji_title:
                try:
                    from tmdb_helper import search_tmdb, get_tv_details, get_tmdb_details
                    tmdb_id = search_tmdb(romaji_title, media_type="tv")
                    if tmdb_id:
                        details = get_tv_details(tmdb_id)
                    if not details:
                        tmdb_id = search_tmdb(romaji_title, media_type="movie")
                        if tmdb_id:
                            details = get_tmdb_details(tmdb_id, media_type="movie")
                except Exception as tmdb_e:
                    print(f"TMDB fallback error in enrichment for '{romaji_title}': {tmdb_e}")
            
            english_title = details.get("title") if details else None
            return {
                "title": english_title or romaji_title,
                "release_year": details.get("release_year") if details else None,
                "cover_url": details.get("cover_url") if (details and details.get("cover_url")) else poster_url,
                "tmdb_id": rec_id,
                "type": "Anime" if media_type == "anime" else "Manga",
                "genres": details.get("genres") if details else None,
                "director": details.get("director") if details else None,
                "overview": details.get("overview") if details else None
            }

        # Enrich in parallel using a ThreadPool to stay efficient and respect rate limits
        with ThreadPoolExecutor(max_workers=3) as executor:
            enriched_results = list(executor.map(enrich_entry, candidates))
            
        return [er for er in enriched_results if er is not None]
    except Exception as e:
        print(f"Jikan Recommendations Error for {media_type} ID {mal_id}: {e}")
        return []

def search_jikan_multi(title: str, media_type: str = "anime") -> List[dict]:
    """
    Searches for media items and returns a list of results.
    Refined with fuzzy matching for better relevance.
    """
    url = f"{BASE_URL}/{media_type}"
    params = {"q": title, "limit": 15}
    
    try:
        response = _jikan_get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("data", [])
        
        # FALLBACK: If no results, try a laxer search with a shorter query
        if not results and " " in title:
            words = title.split()
            # Use the first 2 words if title is long, otherwise just the first word
            shorter_title = " ".join(words[:2]) if len(words) > 2 else words[0]
            if shorter_title and shorter_title.lower() != title.lower():
                print(f"Laxing search: No results for '{title}', trying '{shorter_title}'")
                params["q"] = shorter_title
                response = _jikan_get(url, params=params)
                response.raise_for_status()
                data = response.json()
                results = data.get("data", [])
        from thefuzz import fuzz
        
        formatted_results = []
        for r in results:
            # Determine Year
            year = ""
            if media_type == "manga":
                year = str(r.get("published", {}).get("prop", {}).get("from", {}).get("year", "") or "")
            else:
                year = str(r.get("aired", {}).get("prop", {}).get("from", {}).get("year", "") or "")
                
            # Title Matching
            eng_title = r.get("title_english") or ""
            jap_title = r.get("title") or ""
            
            score_eng = fuzz.token_sort_ratio(title.lower(), eng_title.lower()) if eng_title else 0
            score_jap = fuzz.token_sort_ratio(title.lower(), jap_title.lower()) if jap_title else 0
            best_score = max(score_eng, score_jap)

            # Boost exact matches
            if title.lower() == eng_title.lower() or title.lower() == jap_title.lower():
                best_score += 100

            formatted_results.append({
                "tmdb_id": r.get("mal_id"),
                "title": r.get("title_english") or r.get("title"),
                "release_year": year,
                "cover_url": r.get("images", {}).get("webp", {}).get("large_image_url"),
                "overview": r.get("synopsis"),
                "fuzz_score": best_score
            })
        
        # Sort by fuzzy score descending
        formatted_results.sort(key=lambda x: x["fuzz_score"], reverse=True)
        
        # Remove score from output
        for fr in formatted_results:
            del fr["fuzz_score"]
            
        return formatted_results[:10]
    except Exception as e:
        print(f"Jikan Multi Search Error for '{title}' ({media_type}): {e}")
        return []
