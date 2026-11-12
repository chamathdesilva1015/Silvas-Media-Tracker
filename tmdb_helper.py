import os
import requests
from typing import List, Optional, Tuple

from dotenv import load_dotenv
load_dotenv()
TMDB_API_KEY = os.environ.get("TMDB_API_KEY")
TMDB_ACCESS_TOKEN = os.environ.get("TMDB_ACCESS_TOKEN")
BASE_URL = "https://api.themoviedb.org/3"

def get_tmdb_headers():
    if TMDB_ACCESS_TOKEN:
        return {"Authorization": f"Bearer {TMDB_ACCESS_TOKEN}", "accept": "application/json"}
    return {"accept": "application/json"}

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
        "query": title.strip(),
    }
    if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        params["api_key"] = TMDB_API_KEY
    
    # TMDB uses 'primary_release_year' for movies and 'first_air_date_year' for TV
    if year:
        if media_type == "movie":
            params["primary_release_year"] = year
        else:
            params["first_air_date_year"] = year
            
    print(f"[*] TMDB Search URL: {url} with params: {params}")
    
    try:
        headers = get_tmdb_headers()
        response = requests.get(url, params=params, headers=headers)
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
                
        if not best_id and results:
            # Fallback: Just pick the first result if we found anything at all
            best_id = results[0]["id"]
            print(f"[*] TMDB: No perfect match for '{title}'. Falling back to first result: {best_id}")

        if not best_id and year:
            print(f"[*] TMDB: No good match with year {year}. Retrying without year...")
            return search_tmdb(title, year=None, media_type=media_type)

        return best_id
    except Exception as e:
        print(f"TMDB Search Error for '{title}' ({media_type}): {e}")
    
    return None

def search_tmdb_multi(title: str, year: Optional[int] = None, media_type: str = "movie") -> List[dict]:
    """
    Searches for media items and returns a list of results.
    Refined with fuzzy matching for better relevance.
    """
    if not TMDB_API_KEY:
        return []
    
    endpoint = "movie" if media_type == "movie" else "tv"
    url = f"{BASE_URL}/search/{endpoint}"
    
    params = {
        "query": title.strip(),
    }
    if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        params["api_key"] = TMDB_API_KEY
    
    if year:
        if media_type == "movie":
            params["primary_release_year"] = year
        else:
            params["first_air_date_year"] = year
            
    try:
        headers = get_tmdb_headers()
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        results = data.get("results", [])
        from thefuzz import fuzz

        formatted_results = []
        for r in results:
            r_title = r.get("name" if media_type == "tv" else "title", "")
            r_year = (r.get("first_air_date" if media_type == "tv" else "release_date", ""))[:4]
            
            score = fuzz.token_sort_ratio(title.lower(), r_title.lower())
            
            # Boost exact matches
            if title.lower() == r_title.lower():
                score += 100
                
            # Boost year matches if year was provided
            if year and r_year == str(year):
                score += 50

            formatted_results.append({
                "tmdb_id": r.get("id"),
                "title": r_title,
                "release_year": r_year,
                "cover_url": f"https://image.tmdb.org/t/p/w500{r.get('poster_path')}" if r.get('poster_path') else None,
                "overview": r.get("overview"),
                "fuzz_score": score
            })
            
        # Sort by fuzzy score descending
        formatted_results.sort(key=lambda x: x["fuzz_score"], reverse=True)
        
        # Clean up
        for fr in formatted_results:
            del fr["fuzz_score"]
            
        return formatted_results[:10]
    except Exception as e:
        print(f"TMDB Multi Search Error for '{title}' ({media_type}): {e}")
        return []

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
        "append_to_response": append_val,
    }
    if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        params["api_key"] = TMDB_API_KEY
    
    try:
        headers = get_tmdb_headers()
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # --- Genres ---
        genres = [g["name"] for g in data.get("genres", [])]
        genres_str = ", ".join(genres) if genres else None
        
        # --- Posters & Backdrops ---
        poster_path = data.get("poster_path")
        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        
        backdrop_path = data.get("backdrop_path")
        backdrop_url = f"https://image.tmdb.org/t/p/original{backdrop_path}" if backdrop_path else None

        
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
            "backdrop_url": backdrop_url,
            "overview": data.get("overview"),
            "total_seasons": data.get("number_of_seasons"),
            "total_episodes": data.get("number_of_episodes")
        }
    except Exception as e:
        print(f"TMDB Details Error for {media_type} ID {tmdb_id}: {e}")
    
    return {}

def get_tmdb_recommendations(tmdb_id: int, media_type: str = "movie", limit: int = 5) -> List[dict]:
    """
    Fetches recommendations for a specific movie or TV show.
    TMDB returns up to 20 per page — we fetch page 1 and page 2 for a richer pool.
    """
    if not TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        return []
        
    endpoint = "movie" if media_type == "movie" else "tv"
    url = f"{BASE_URL}/{endpoint}/{tmdb_id}/recommendations"
    
    params = {}
    if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        params["api_key"] = TMDB_API_KEY
        
    try:
        headers = get_tmdb_headers()
        results = []
        for page in range(1, 3):  # Fetch 2 pages (up to 40 results)
            params["page"] = page
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            page_results = data.get("results", [])
            if not page_results:
                break
            for r in page_results:
                if len(results) >= limit:
                    break
                title = r.get("title") or r.get("name")
                release_year = (r.get("release_date") or r.get("first_air_date", ""))[:4]
                poster_path = r.get("poster_path")
                cover_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
                if title and cover_url:
                    results.append({
                        "title": title,
                        "release_year": release_year,
                        "cover_url": cover_url,
                        "tmdb_id": r.get("id"),
                        "type": "Movies" if media_type == "movie" else "TV Series",
                        "popularity": r.get("popularity", 0)
                    })
            if len(results) >= limit:
                break
        return results
    except Exception as e:
        print(f"TMDB Recommendations Error for {media_type} ID {tmdb_id}: {e}")
        return []

def get_tmdb_similar(tmdb_id: int, media_type: str = "movie", limit: int = 20) -> List[dict]:
    """
    Fetches similar media for a specific movie or TV show.
    """
    if not TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        return []
        
    endpoint = "movie" if media_type == "movie" else "tv"
    url = f"{BASE_URL}/{endpoint}/{tmdb_id}/similar"
    
    params = {}
    if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        params["api_key"] = TMDB_API_KEY
        
    try:
        headers = get_tmdb_headers()
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for r in data.get("results", [])[:limit]:
            title = r.get("title") or r.get("name")
            release_year = (r.get("release_date") or r.get("first_air_date", ""))[:4]
            poster_path = r.get("poster_path")
            cover_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
            
            if title and cover_url:
                results.append({
                    "title": title,
                    "release_year": release_year,
                    "cover_url": cover_url,
                    "tmdb_id": r.get("id"),
                    "type": "Movies" if media_type == "movie" else "TV Series",
                    "popularity": r.get("popularity", 0)
                })
        return results
    except Exception as e:
        print(f"TMDB Similar Error for {media_type} ID {tmdb_id}: {e}")
        return []

def get_tmdb_discover(media_type: str = "movie", year_min: Optional[int] = None, year_max: Optional[int] = None, genre_ids: Optional[List[int]] = None, limit: int = 20, page: int = 1) -> List[dict]:
    """
    Discovers movies or TV shows filtered by year range and genres (OR logic).
    """
    if not TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        return []

    endpoint = "movie" if media_type == "movie" else "tv"
    url = f"{BASE_URL}/discover/{endpoint}"

    params = {
        "sort_by": "popularity.desc",
        "vote_count.gte": 40,
        "page": page,
    }
    if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
        params["api_key"] = TMDB_API_KEY

    if media_type == "movie":
        if year_min:
            params["primary_release_date.gte"] = f"{year_min}-01-01"
        if year_max:
            params["primary_release_date.lte"] = f"{year_max}-12-31"
    else:
        if year_min:
            params["first_air_date.gte"] = f"{year_min}-01-01"
        if year_max:
            params["first_air_date.lte"] = f"{year_max}-12-31"

    if genre_ids:
        params["with_genres"] = "|".join(str(gid) for gid in genre_ids)

    try:
        headers = get_tmdb_headers()
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()

        results = []
        for r in data.get("results", [])[:limit]:
            title = r.get("title") or r.get("name")
            release_year = (r.get("release_date") or r.get("first_air_date", ""))[:4]
            poster_path = r.get("poster_path")
            cover_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None

            if title and cover_url:
                results.append({
                    "title": title,
                    "release_year": release_year,
                    "cover_url": cover_url,
                    "tmdb_id": r.get("id"),
                    "type": "Movies" if media_type == "movie" else "TV Series",
                    "popularity": r.get("popularity", 0)
                })
        return results
    except Exception as e:
        print(f"TMDB Discover Error for {media_type}: {e}")
        return []

# Legacy Aliases for safety (though only enrich_data.py uses them currently)
def search_movie(title: str, year: Optional[int] = None) -> Optional[int]:
    return search_tmdb(title, year, "movie")

def get_movie_details(tmdb_id: int) -> dict:
    return get_tmdb_details(tmdb_id, "movie")

def get_tv_details(tmdb_id: int) -> dict:
    return get_tmdb_details(tmdb_id, "tv")

def fetch_external_ratings(title: str, tmdb_id: Optional[int] = None, release_year: Optional[int] = None) -> dict:
    """
    Fetches 4 external ratings for a movie:
    - IMDb (x.x/10)
    - Rotten Tomatoes Critics (Tomatometer %)
    - Rotten Tomatoes Audience (Popcorn %)
    - Letterboxd (x.x/5)
    """
    ratings = {
        "imdb_rating": None,
        "rt_critics_score": None,
        "rt_audience_score": None,
        "letterboxd_rating": None
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    # 1. IMDb via TMDB external_ids + OMDb / Agregarr
    imdb_id = None
    if tmdb_id:
        try:
            tmdb_headers = get_tmdb_headers()
            params = {}
            if TMDB_API_KEY and not TMDB_ACCESS_TOKEN:
                params["api_key"] = TMDB_API_KEY
            ext_res = requests.get(f"{BASE_URL}/movie/{tmdb_id}/external_ids", headers=tmdb_headers, params=params, timeout=5)
            if ext_res.status_code == 200:
                imdb_id = ext_res.json().get("imdb_id")
        except Exception as e:
            print(f"[Ratings] TMDB external_ids error for {tmdb_id}: {e}")

    if imdb_id:
        # Check OMDb first if user configured OMDB_API_KEY
        omdb_key = os.environ.get("OMDB_API_KEY")
        if omdb_key:
            try:
                omdb_res = requests.get(f"http://www.omdbapi.com/?i={imdb_id}&apikey={omdb_key}", timeout=5)
                if omdb_res.status_code == 200:
                    d = omdb_res.json()
                    ir = d.get("imdbRating")
                    if ir and ir != "N/A":
                        ratings["imdb_rating"] = str(ir)
                    for r_entry in d.get("Ratings", []):
                        if r_entry.get("Source") == "Rotten Tomatoes":
                            ratings["rt_critics_score"] = r_entry.get("Value")
            except Exception as e:
                print(f"[Ratings] OMDb fetch error: {e}")

        # If still no IMDb rating, query free Agregarr ratings proxy
        if not ratings["imdb_rating"]:
            try:
                ag_res = requests.get(f"https://api.agregarr.org/api/ratings?id={imdb_id}", timeout=5)
                if ag_res.status_code == 200:
                    arr = ag_res.json()
                    if arr and isinstance(arr, list) and len(arr) > 0:
                        r_val = arr[0].get("rating")
                        if r_val is not None:
                            ratings["imdb_rating"] = f"{float(r_val):.1f}"
            except Exception as e:
                print(f"[Ratings] Agregarr error: {e}")

    # 2. Letterboxd via TMDB ID redirect & JSON-LD
    if tmdb_id:
        try:
            lb_res = requests.get(f"https://letterboxd.com/tmdb/{tmdb_id}/", headers=headers, allow_redirects=True, timeout=6)
            if lb_res.status_code == 200:
                import re, json
                ld_matches = re.findall(r'<script type=\"application/ld\+json\">(.*?)</script>', lb_res.text, re.DOTALL)
                for m in ld_matches:
                    clean = m.strip()
                    if clean.startswith("/* <![CDATA[ */"):
                        clean = clean[len("/* <![CDATA[ */"):]
                    if clean.endswith("/* ]]> */"):
                        clean = clean[:-len("/* ]]> */")]
                    try:
                        d = json.loads(clean)
                        if "aggregateRating" in d and "ratingValue" in d["aggregateRating"]:
                            val = float(d["aggregateRating"]["ratingValue"])
                            ratings["letterboxd_rating"] = f"{val:.1f}"
                            break
                    except Exception:
                        pass
        except Exception as e:
            print(f"[Ratings] Letterboxd error for TMDB {tmdb_id}: {e}")

    # 3. Rotten Tomatoes (Critics & Audience)
    if title:
        import re
        t_clean = title.lower().replace("&", "and")
        t_clean = re.sub(r"[^\w\s]", "", t_clean).strip()
        slug = re.sub(r"\s+", "_", t_clean)

        candidates = [slug]
        if release_year:
            candidates.append(f"{slug}_{release_year}")

        for c in candidates:
            try:
                rt_res = requests.get(f"https://www.rottentomatoes.com/m/{c}", headers=headers, timeout=6)
                if rt_res.status_code == 200:
                    # Critics
                    if not ratings["rt_critics_score"]:
                        c_m = re.search(r'\"criticsScore\":\{.*?\"scorePercent\":\"(.*?)\"', rt_res.text)
                        if c_m:
                            c_val = c_m.group(1).strip()
                            ratings["rt_critics_score"] = c_val if c_val.endswith("%") else f"{c_val}%"
                        else:
                            ld_m = re.search(r'\"name\":\"Tomatometer\".*?\"ratingValue\":\"(\d+)\"', rt_res.text)
                            if ld_m:
                                ratings["rt_critics_score"] = f"{ld_m.group(1)}%"

                    # Audience
                    if not ratings["rt_audience_score"]:
                        a_m = re.search(r'\"audienceScore\":\{.*?\"scorePercent\":\"(.*?)\"', rt_res.text)
                        if a_m:
                            a_val = a_m.group(1).strip()
                            ratings["rt_audience_score"] = a_val if a_val.endswith("%") else f"{a_val}%"
                        else:
                            tag_m = re.search(r'data-[a-zA-Z0-9_\-\"]*=\"audienceScore\"[^>]*>\s*(\d+%)\s*<', rt_res.text)
                            if tag_m:
                                ratings["rt_audience_score"] = tag_m.group(1).strip()

                    if ratings["rt_critics_score"] or ratings["rt_audience_score"]:
                        break
            except Exception as e:
                print(f"[Ratings] RT scrape error for candidate '{c}': {e}")

    return ratings
