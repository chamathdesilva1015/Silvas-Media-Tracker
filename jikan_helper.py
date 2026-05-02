import requests
import time
from typing import Optional, Dict

BASE_URL = "https://api.jikan.moe/v4"

def search_manga(title: str) -> Optional[int]:
    """
    Searches for a manga and returns its MyAnimeList (MAL) ID.
    """
    url = f"{BASE_URL}/manga"
    params = {"q": title, "limit": 5}
    
    try:
        response = requests.get(url, params=params)
        if response.status_code == 429:
            time.sleep(1) # Rate limit hit
            response = requests.get(url, params=params)
            
        response.raise_for_status()
        data = response.json()
        
        results = data.get("data", [])
        if not results:
            return None
            
        # Match by title similarity
        for r in results:
            if r.get("title", "").lower() == title.lower():
                return r["mal_id"]
        
        # Fallback to first result
        return results[0]["mal_id"]
    except Exception as e:
        print(f"Jikan Search Error for '{title}': {e}")
    return None

def get_manga_details(mal_id: int) -> Dict:
    """
    Fetches genres, poster, and author for a manga.
    """
    url = f"{BASE_URL}/manga/{mal_id}/full"
    
    try:
        response = requests.get(url)
        if response.status_code == 429:
            time.sleep(1)
            response = requests.get(url)
            
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
            
        return {
            "genres": genres,
            "poster_url": poster_url,
            "director": author, # Store in director field for consistency
            "tmdb_id": mal_id,   # Use mal_id as tmdb_id for internal tracking
            "content_rating": data.get("status"), # Use status as a pseudo-rating (e.g. "Finished")
        }
    except Exception as e:
        print(f"Jikan Details Error for ID {mal_id}: {e}")
    return {}
