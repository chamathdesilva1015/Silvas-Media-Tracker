import os
import requests
from typing import List, Optional, Tuple

TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
BASE_URL = "https://api.themoviedb.org/3"

def search_movie(title: str, year: Optional[int] = None) -> Optional[int]:
    """Searches for a movie and returns its TMDB ID."""
    if not TMDB_API_KEY:
        return None
    
    url = f"{BASE_URL}/search/movie"
    params = {
        "api_key": TMDB_API_KEY,
        "query": title,
    }
    if year:
        params["year"] = year
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("results", [])
        if results:
            # First result is usually the best match
            return results[0]["id"]
    except Exception as e:
        print(f"TMDB Search Error for '{title}': {e}")
    
    return None

def get_movie_details(tmdb_id: int) -> Tuple[Optional[str], Optional[str]]:
    """Fetches genres and poster path for a given TMDB ID."""
    if not TMDB_API_KEY:
        return None, None
    
    url = f"{BASE_URL}/movie/{tmdb_id}"
    params = {
        "api_key": TMDB_API_KEY,
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        genres = [g["name"] for g in data.get("genres", [])]
        genres_str = ", ".join(genres) if genres else None
        
        poster_path = data.get("poster_path")
        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        
        return genres_str, poster_url
    except Exception as e:
        print(f"TMDB Details Error for ID {tmdb_id}: {e}")
    
    return None, None
