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
        response = requests.get(url, params=params)
        if response.status_code == 429:
            time.sleep(1) # Rate limit hit
            response = requests.get(url, params=params)
            
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
            "title": data.get("title_english") or data.get("title"),
            "release_year": str(data.get("published", {}).get("prop", {}).get("from", {}).get("year", "")) or None,
            "genres": genres,
            "cover_url": poster_url,
            "director": author, # Store in director field for consistency
            "tmdb_id": mal_id,   # Use mal_id as tmdb_id for internal tracking
            "content_rating": data.get("status"), # Use status as a pseudo-rating (e.g. "Finished")
        }
    except Exception as e:
        print(f"Jikan Details Error for ID {mal_id}: {e}")
    return {}

def get_anime_details(mal_id: int) -> dict:
    """
    Fetches genres, poster, director, and year for an anime using Jikan (MAL).
    """
    url = f"{BASE_URL}/anime/{mal_id}/full"
    
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
        
        # --- Studio / Director (use studio name as director field) ---
        studios = data.get("studios", [])
        studio = studios[0]["name"] if studios else None
        
        # --- Year ---
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
        }
    except Exception as e:
        print(f"Jikan Anime Details Error for ID {mal_id}: {e}")
    return {}
