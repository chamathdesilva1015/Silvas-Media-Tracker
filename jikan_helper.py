import requests
import time
from typing import Optional, Dict, List

BASE_URL = "https://api.jikan.moe/v4"

ANIME_CACHE = {}
MANGA_CACHE = {}

def search_manga(title: str) -> Optional[int]:
    """
    Searches for a manga and returns its MyAnimeList (MAL) ID.
    """
    url = f"{BASE_URL}/manga"
    params = {"q": title, "limit": 5}
    
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 429:
            time.sleep(1) # Rate limit hit
            response = requests.get(url, params=params, timeout=5)
            
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
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 429:
            time.sleep(1) # Rate limit hit
            response = requests.get(url, params=params, timeout=5)
            
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
        response = requests.get(url, timeout=5)
        if response.status_code == 429:
            time.sleep(1)
            response = requests.get(url, timeout=5)
            
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
        response = requests.get(url, timeout=5)
        if response.status_code == 429:
            time.sleep(1)
            response = requests.get(url, timeout=5)
            
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
    Jikan returns a list of recommendations from users, we just take the top ones.
    """
    endpoint = "anime" if media_type == "anime" else "manga"
    url = f"{BASE_URL}/{endpoint}/{mal_id}/recommendations"
    
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 429:
            time.sleep(1)
            response = requests.get(url, timeout=5)
            
        response.raise_for_status()
        data = response.json()
        
        results = []
        for r in data.get("data", [])[:limit]:
            entry = r.get("entry", {})
            title = entry.get("title")
            poster_url = entry.get("images", {}).get("webp", {}).get("large_image_url")
            
            if title and poster_url:
                results.append({
                    "title": title,
                    "release_year": None, # Jikan recommendations don't usually include year
                    "cover_url": poster_url,
                    "tmdb_id": entry.get("mal_id"),
                    "type": "Anime" if media_type == "anime" else "Manga"
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
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 429:
            time.sleep(1)
            response = requests.get(url, params=params, timeout=5)
            
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
