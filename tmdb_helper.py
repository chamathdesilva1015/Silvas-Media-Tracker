import os
import requests
from typing import List, Optional, Tuple

from dotenv import load_dotenv
load_dotenv()
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
BASE_URL = "https://api.themoviedb.org/3"

def search_tmdb(title: str, year: Optional[int] = None, media_type: str = "movie") -> Optional[int]:
    """
    Searches for a media item and returns its TMDB ID.
    media_type: "movie" or "tv"
    """
    if not TMDB_API_KEY:
        return None
    
    endpoint = "movie" if media_type == "movie" else "tv"
    url = f"{BASE_URL}/search/{endpoint}"
    
    params = {
        "api_key": TMDB_API_KEY,
        "query": title,
    }
    
    # TMDB uses 'primary_release_year' for movies and 'first_air_date_year' for TV
    if year:
        if media_type == "movie":
            params["primary_release_year"] = year
        else:
            params["first_air_date_year"] = year
            
    print(f"[*] TMDB Search URL: {url} with params: {params}")
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("results", [])
        if not results:
            print(f"[!] TMDB: No results found for query: {title} ({media_type})")
            return None
            
        print(f"[*] TMDB: Found {len(results)} results for '{title}'. Comparing...")
        best_id = None
        best_score = -1
        
        for r in results[:5]:
            score = 0
            # TV uses 'name', Movie uses 'title'
            r_title = r.get("name" if media_type == "tv" else "title", "").lower()
            # TV uses 'first_air_date', Movie uses 'release_date'
            r_release = r.get("first_air_date" if media_type == "tv" else "release_date", "")
            r_pop = r.get("popularity", 0)
            
            # 1. Title Match
            if r_title == title.lower():
                score += 100
            elif title.lower() in r_title:
                score += 20
                
            # 2. Year Match
            if year and r_release and r_release.startswith(str(year)):
                score += 50
                
            # 3. Popularity
            score += min(r_pop, 50)
            
            if score > best_score:
                best_score = score
                best_id = r["id"]
                
        if not best_id and year:
            print(f"[*] TMDB: No good match with year {year}. Retrying without year...")
            return search_tmdb(title, year=None, media_type=media_type)

        return best_id
    except Exception as e:
        print(f"TMDB Search Error for '{title}' ({media_type}): {e}")
    
    return None

def get_tmdb_details(tmdb_id: int, media_type: str = "movie") -> dict:
    """
    Fetches genres, poster, director/creator, runtime, and content_rating.
    media_type: "movie" or "tv"
    """
    if not TMDB_API_KEY:
        return {}
    
    endpoint = "movie" if media_type == "movie" else "tv"
    url = f"{BASE_URL}/{endpoint}/{tmdb_id}"
    
    # TV uses content_ratings, Movie uses releases
    append_val = "credits,releases" if media_type == "movie" else "credits,content_ratings"
    
    params = {
        "api_key": TMDB_API_KEY,
        "append_to_response": append_val,
    }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # --- Genres ---
        genres = [g["name"] for g in data.get("genres", [])]
        genres_str = ", ".join(genres) if genres else None
        
        # --- Poster ---
        poster_path = data.get("poster_path")
        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        
        # --- Runtime ---
        runtime = None
        if media_type == "movie":
            runtime = data.get("runtime")
        else:
            # TV often has a list of episode runtimes, take the average
            runtimes = data.get("episode_run_time", [])
            if runtimes:
                runtime = sum(runtimes) // len(runtimes)
        
        # --- Director / Creator ---
        director = None
        if media_type == "movie":
            crew = data.get("credits", {}).get("crew", [])
            for person in crew:
                if person.get("job") == "Director":
                    director = person.get("name")
                    break
        else:
            # For TV, we use "Created By"
            creators = data.get("created_by", [])
            if creators:
                director = creators[0].get("name")
        
        # --- Content Rating ---
        content_rating = None
        if media_type == "movie":
            countries = data.get("releases", {}).get("countries", [])
            for c in countries:
                if c.get("iso_3166_1") == "US" and c.get("certification"):
                    content_rating = c["certification"]
                    break
        else:
            # TV content ratings
            ratings = data.get("content_ratings", {}).get("results", [])
            for r in ratings:
                if r.get("iso_3166_1") == "US" and r.get("rating"):
                    content_rating = r["rating"]
                    break
        
        return {
            "tmdb_id": tmdb_id,
            "title": data.get("title") or data.get("name"),
            "release_year": (data.get("release_date") or data.get("first_air_date", ""))[:4],
            "genres": genres_str,
            "cover_url": poster_url,
            "director": director,
            "runtime": runtime,
            "content_rating": content_rating,
        }
    except Exception as e:
        print(f"TMDB Details Error for {media_type} ID {tmdb_id}: {e}")
    
    return {}

# Legacy Aliases for safety (though only enrich_data.py uses them currently)
def search_movie(title: str, year: Optional[int] = None) -> Optional[int]:
    return search_tmdb(title, year, "movie")

def get_movie_details(tmdb_id: int) -> dict:
    return get_tmdb_details(tmdb_id, "movie")
