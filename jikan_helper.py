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
    # Retry on 429 (rate limit) and 504 (gateway timeout) with backoff
    for attempt in range(4):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=15)
            if response.status_code == 429:
                wait = 3 * (attempt + 1)
                time.sleep(wait)
                continue
            if response.status_code == 504:
                wait = 2 * (attempt + 1)
                time.sleep(wait)
                continue
            return response
        except requests.exceptions.Timeout:
            if attempt == 3:
                raise
            time.sleep(2)
        except requests.exceptions.RequestException as e:
            if attempt == 3:
                raise e
            time.sleep(1)
    return requests.get(url, params=params, headers=headers, timeout=15)


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
            titles_to_check = []
            for title_obj in r.get("titles", []):
                titles_to_check.append(title_obj.get("title", ""))
                
            if not titles_to_check:
                titles_to_check.append(r.get("title", ""))
                if r.get("title_english"):
                    titles_to_check.append(r.get("title_english"))
                if r.get("title_japanese"):
                    titles_to_check.append(r.get("title_japanese"))
            
            for t in titles_to_check:
                if not t: continue
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
            if r.get("type") == "Movie":
                continue
                
            titles_to_check = []
            for title_obj in r.get("titles", []):
                titles_to_check.append(title_obj.get("title", ""))
                
            if not titles_to_check:
                titles_to_check.append(r.get("title", ""))
                if r.get("title_english"):
                    titles_to_check.append(r.get("title_english"))
                if r.get("title_japanese"):
                    titles_to_check.append(r.get("title_japanese"))
            
            for t in titles_to_check:
                if not t: continue
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

def _parse_manga_data(data: dict, mal_id: int) -> dict:
    """Parses a Jikan manga data dict into our internal format."""
    genres_list = data.get("genres", []) + data.get("explicit_genres", []) + data.get("themes", []) + data.get("demographics", [])
    genres = ", ".join([g["name"] for g in genres_list]) if genres_list else None
    poster_url = data.get("images", {}).get("webp", {}).get("large_image_url")
    authors_list = data.get("authors", [])
    author = authors_list[0]["name"] if authors_list else None
    if author and "," in author:
        parts = author.split(",")
        author = f"{parts[1].strip()} {parts[0].strip()}"
    return {
        "title": data.get("title_english") or data.get("title"),
        "release_year": str(data.get("published", {}).get("prop", {}).get("from", {}).get("year", "")) or None,
        "genres": genres,
        "cover_url": poster_url,
        "director": author,
        "tmdb_id": mal_id,
        "content_rating": None,
        "overview": data.get("synopsis"),
        "manga_status": data.get("status"),
        "total_chapters": data.get("chapters")
    }


def get_manga_details(mal_id: int) -> Dict:
    """
    Fetches genres, poster, and author for a manga.
    Falls back from /full to base endpoint on 504.
    """
    if mal_id in MANGA_CACHE:
        return MANGA_CACHE[mal_id]

    for endpoint_suffix in ("/full", ""):
        url = f"{BASE_URL}/manga/{mal_id}{endpoint_suffix}"
        try:
            response = _jikan_get(url)
            response.raise_for_status()
            data = response.json().get("data", {})
            result = _parse_manga_data(data, mal_id)
            MANGA_CACHE[mal_id] = result
            return result
        except Exception as e:
            print(f"Jikan Manga Details Error for ID {mal_id} ({endpoint_suffix or 'base'}): {e}")
            if endpoint_suffix == "":
                break  # Both endpoints failed
            time.sleep(1)  # Brief pause before fallback
    return {}

def _parse_anime_data(data: dict, mal_id: int) -> dict:
    """Parses a Jikan anime data dict into our internal format."""
    genres_list = data.get("genres", []) + data.get("explicit_genres", []) + data.get("themes", []) + data.get("demographics", [])
    genres = ", ".join([g["name"] for g in genres_list]) if genres_list else None
    poster_url = data.get("images", {}).get("webp", {}).get("large_image_url")
    studios = data.get("studios", [])
    studio = studios[0]["name"] if studios else None
    release_year = None
    aired = data.get("aired", {}).get("prop", {}).get("from", {})
    if aired.get("year"):
        release_year = str(aired["year"])
    return {
        "title": data.get("title_english") or data.get("title"),
        "release_year": release_year,
        "genres": genres,
        "cover_url": poster_url,
        "director": studio,
        "tmdb_id": mal_id,
        "content_rating": data.get("rating"),
        "overview": data.get("synopsis"),
        "anime_type": data.get("type")
    }


def get_anime_details(mal_id: int) -> dict:
    """
    Fetches genres, poster, director, and year for an anime using Jikan (MAL).
    Falls back from /full to base endpoint on failure.
    """
    if mal_id in ANIME_CACHE:
        return ANIME_CACHE[mal_id]

    for endpoint_suffix in ("/full", ""):
        url = f"{BASE_URL}/anime/{mal_id}{endpoint_suffix}"
        try:
            response = _jikan_get(url)
            response.raise_for_status()
            data = response.json().get("data", {})
            result = _parse_anime_data(data, mal_id)
            ANIME_CACHE[mal_id] = result
            return result
        except Exception as e:
            print(f"Jikan Anime Details Error for ID {mal_id} ({endpoint_suffix or 'base'}): {e}")
            if endpoint_suffix == "":
                break  # Both endpoints failed
            time.sleep(1)  # Brief pause before trying fallback
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
        
        results = []
        for r in candidates:
            entry = r.get("entry", {})
            rec_id = entry.get("mal_id")
            if not rec_id:
                continue
                
            # Keep it basic to avoid heavy API load during recommendation gathering
            # Rich details will be fetched later for top candidates
            results.append({
                "title": entry.get("title", ""),
                "cover_url": entry.get("images", {}).get("webp", {}).get("large_image_url"),
                "tmdb_id": rec_id,
                "type": "Anime" if media_type == "anime" else "Manga",
                # The votes count returned by Jikan can act as popularity
                "popularity": r.get("votes", 0)
            })
            
        return results
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
                
        # Filter out movies for Anime (anime movies belong under 'Movies' category)
        if media_type == "anime":
            results = [r for r in results if r.get("type") != "Movie"]
            
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
            titles_to_check = []
            for title_obj in r.get("titles", []):
                titles_to_check.append(title_obj.get("title", ""))
                
            if not titles_to_check:
                titles_to_check.append(r.get("title", ""))
                if r.get("title_english"):
                    titles_to_check.append(r.get("title_english"))
                if r.get("title_japanese"):
                    titles_to_check.append(r.get("title_japanese"))
            
            best_score = 0
            for t in titles_to_check:
                if not t: continue
                score = fuzz.token_sort_ratio(title.lower(), t.lower())
                # Boost exact matches
                if title.lower() == t.lower():
                    score += 100
                if score > best_score:
                    best_score = score

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
