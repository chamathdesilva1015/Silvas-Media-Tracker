import requests
import time
import re
from typing import Optional, Dict, List
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "https://api.jikan.moe/v4"
ANILIST_URL = "https://graphql.anilist.co"
KITSU_URL = "https://kitsu.io/api/edge"

ANIME_CACHE = {}
MANGA_CACHE = {}

def _jikan_get(url: str, params: Optional[Dict] = None) -> requests.Response:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
    }
    # Fast 3-second timeout and 1 fast retry so failures trigger the instant AniList/Kitsu fallbacks
    for attempt in range(2):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=3)
            if response.status_code == 200:
                return response
            if response.status_code in (429, 504):
                time.sleep(0.5)
                continue
            return response
        except (requests.exceptions.Timeout, requests.exceptions.RequestException):
            if attempt == 1:
                break
            time.sleep(0.3)
    return requests.Response()


# --- AniList Fallback Integration ---

def _anilist_post(query: str, variables: dict) -> Optional[dict]:
    try:
        response = requests.post(ANILIST_URL, json={"query": query, "variables": variables}, timeout=4)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"AniList API Error: {e}")
    return None

def _parse_anilist_media(media: dict) -> dict:
    t = media.get("title", {})
    title = t.get("english") or t.get("romaji") or t.get("native") or ""
    
    startDate = media.get("startDate", {}) or {}
    year = str(startDate.get("year", "")) if startDate.get("year") else None
    
    genres_list = media.get("genres", []) or []
    genres = ", ".join(genres_list) if genres_list else None
    
    cover_url = (media.get("coverImage") or {}).get("extraLarge")
    
    studios = (media.get("studios") or {}).get("nodes", [])
    studio = studios[0]["name"] if studios else None
    
    staff = (media.get("staff") or {}).get("nodes", [])
    author = staff[0]["name"]["full"] if (staff and staff[0].get("name")) else None
    
    director_or_author = studio or author
    
    mal_id = media.get("idMal") or media.get("id")
    
    fmt = media.get("format")
    anime_type = "Movie" if fmt == "MOVIE" else "TV"
    
    status_map = {
        "FINISHED": "Finished",
        "RELEASING": "Publishing",
        "NOT_YET_RELEASED": "Not yet published",
        "CANCELLED": "Cancelled",
        "HIATUS": "On Hiatus"
    }
    manga_status = status_map.get(media.get("status"), media.get("status"))
    
    overview = media.get("description")
    if overview:
        overview = re.sub(r'<[^>]+>', '', overview).strip()
        
    return {
        "title": title,
        "release_year": year,
        "genres": genres,
        "cover_url": cover_url,
        "director": director_or_author,
        "tmdb_id": mal_id,
        "content_rating": None,
        "overview": overview,
        "anime_type": anime_type,
        "manga_status": manga_status,
        "total_chapters": media.get("chapters")
    }

def _anilist_search_single(title: str, media_type: str = "ANIME") -> Optional[dict]:
    query = """
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 5) {
        media(search: $search, type: $type) {
          id
          idMal
          title { english romaji native }
          startDate { year }
          coverImage { extraLarge }
          genres
          description
          format
          status
          chapters
          studios(isMain: true) { nodes { name } }
          staff(perPage: 1) { nodes { name { full } } }
        }
      }
    }
    """
    res = _anilist_post(query, {"search": title, "type": media_type.upper()})
    if not res:
        return None
    results = res.get("data", {}).get("Page", {}).get("media", [])
    if not results:
        return None
        
    from thefuzz import fuzz
    best_match = None
    highest_score = 0
    
    for r in results:
        if media_type.upper() == "ANIME" and r.get("format") == "MOVIE":
            continue
            
        t_obj = r.get("title", {})
        titles_to_check = [t_obj.get("english"), t_obj.get("romaji"), t_obj.get("native")]
        for t in titles_to_check:
            if not t: continue
            score = fuzz.token_sort_ratio(t.lower(), title.lower())
            if score > highest_score:
                highest_score = score
                best_match = r
                
    if best_match and highest_score > 60:
        return _parse_anilist_media(best_match)
        
    if results:
        first = results[0]
        if media_type.upper() != "ANIME" or first.get("format") != "MOVIE":
            return _parse_anilist_media(first)
            
    return None

def _anilist_get_details(mal_id: int, media_type: str = "ANIME") -> dict:
    query = """
    query ($id: Int, $type: MediaType) {
      Media(idMal: $id, type: $type) {
        id
        idMal
        title { english romaji native }
        startDate { year }
        coverImage { extraLarge }
        genres
        description
        format
        status
        chapters
        studios(isMain: true) { nodes { name } }
        staff(perPage: 1) { nodes { name { full } } }
      }
    }
    """
    res = _anilist_post(query, {"id": mal_id, "type": media_type.upper()})
    if res and res.get("data", {}).get("Media"):
        return _parse_anilist_media(res["data"]["Media"])
        
    query_id = """
    query ($id: Int, $type: MediaType) {
      Media(id: $id, type: $type) {
        id
        idMal
        title { english romaji native }
        startDate { year }
        coverImage { extraLarge }
        genres
        description
        format
        status
        chapters
        studios(isMain: true) { nodes { name } }
        staff(perPage: 1) { nodes { name { full } } }
      }
    }
    """
    res2 = _anilist_post(query_id, {"id": mal_id, "type": media_type.upper()})
    if res2 and res2.get("data", {}).get("Media"):
        return _parse_anilist_media(res2["data"]["Media"])
        
    return {}

def _anilist_search_multi(title: str, media_type: str = "anime") -> List[dict]:
    type_str = "ANIME" if media_type == "anime" else "MANGA"
    query = """
    query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 10) {
        media(search: $search, type: $type) {
          id
          idMal
          title { english romaji native }
          startDate { year }
          coverImage { extraLarge }
          description
          format
        }
      }
    }
    """
    res = _anilist_post(query, {"search": title, "type": type_str})
    if not res:
        return []
    results = res.get("data", {}).get("Page", {}).get("media", [])
    
    from thefuzz import fuzz
    formatted_results = []
    
    for r in results:
        if type_str == "ANIME" and r.get("format") == "MOVIE":
            continue
            
        t_obj = r.get("title", {})
        main_title = t_obj.get("english") or t_obj.get("romaji") or t_obj.get("native") or ""
        year = str((r.get("startDate") or {}).get("year") or "")
        
        titles_to_check = [t_obj.get("english"), t_obj.get("romaji"), t_obj.get("native")]
        best_score = 0
        for t in titles_to_check:
            if not t: continue
            score = fuzz.token_sort_ratio(title.lower(), t.lower())
            if title.lower() == t.lower():
                score += 100
            if score > best_score:
                best_score = score
                
        overview = r.get("description")
        if overview:
            overview = re.sub(r'<[^>]+>', '', overview).strip()

        formatted_results.append({
            "tmdb_id": r.get("idMal") or r.get("id"),
            "title": main_title,
            "release_year": year,
            "cover_url": (r.get("coverImage") or {}).get("extraLarge"),
            "overview": overview,
            "fuzz_score": best_score
        })
        
    formatted_results.sort(key=lambda x: x["fuzz_score"], reverse=True)
    for fr in formatted_results:
        del fr["fuzz_score"]
        
    return formatted_results[:10]

def _anilist_recommendations(mal_id: int, media_type: str = "anime", limit: int = 5) -> List[dict]:
    type_str = "ANIME" if media_type == "anime" else "MANGA"
    query = """
    query ($id: Int, $type: MediaType) {
      Media(idMal: $id, type: $type) {
        recommendations(perPage: 10, sort: RATING_DESC) {
          nodes {
            rating
            mediaRecommendation {
              id
              idMal
              title { english romaji native }
              coverImage { extraLarge }
              format
            }
          }
        }
      }
    }
    """
    res = _anilist_post(query, {"id": mal_id, "type": type_str})
    if not res:
        return []
    nodes = res.get("data", {}).get("Media", {}).get("recommendations", {}).get("nodes", [])
    results = []
    for n in nodes:
        rec = n.get("mediaRecommendation")
        if not rec: continue
        rec_id = rec.get("idMal") or rec.get("id")
        if not rec_id: continue
        t_obj = rec.get("title", {})
        main_title = t_obj.get("english") or t_obj.get("romaji") or t_obj.get("native") or ""
        results.append({
            "title": main_title,
            "cover_url": (rec.get("coverImage") or {}).get("extraLarge"),
            "tmdb_id": rec_id,
            "type": "Anime" if media_type == "anime" else "Manga",
            "popularity": n.get("rating", 0)
        })
        if len(results) >= limit:
            break
    return results


# --- Kitsu Fallback Integration ---

def _kitsu_get(endpoint: str, params: Optional[dict] = None) -> Optional[dict]:
    headers = {
        "Accept": "application/vnd.api+json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MediaTracker/1.0"
    }
    url = f"{KITSU_URL}/{endpoint}" if not endpoint.startswith("http") else endpoint
    try:
        res = requests.get(url, params=params, headers=headers, timeout=5)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"Kitsu API Error ({endpoint}): {e}")
    return None

def _parse_kitsu_media(item: dict, mapping_dict: Optional[dict] = None, included_categories: Optional[dict] = None) -> dict:
    attr = item.get("attributes", {})
    kitsu_id = item.get("id")
    
    titles = attr.get("titles") or {}
    title = titles.get("en") or titles.get("en_jp") or attr.get("canonicalTitle") or titles.get("ja_jp") or ""
    
    start_date = attr.get("startDate") or ""
    release_year = start_date[:4] if len(start_date) >= 4 else None
    
    poster_img = attr.get("posterImage") or {}
    cover_url = poster_img.get("large") or poster_img.get("original") or poster_img.get("medium")
    
    subtype = attr.get("subtype") or ""
    anime_type = "Movie" if subtype.lower() == "movie" else "TV"
    
    status_raw = (attr.get("status") or "").lower()
    status_map = {
        "current": "Publishing",
        "finished": "Finished",
        "tba": "Not yet published",
        "unreleased": "Not yet published",
        "upcoming": "Not yet published"
    }
    manga_status = status_map.get(status_raw, attr.get("status"))
    
    genres = None
    if included_categories:
        cat_ids = [c.get("id") for c in item.get("relationships", {}).get("categories", {}).get("data", [])]
        cat_names = [included_categories[cid] for cid in cat_ids if cid in included_categories]
        if cat_names:
            genres = ", ".join(cat_names[:4])
            
    # Resolve MAL ID from mappings
    mal_id = None
    if mapping_dict:
        rel_maps = item.get("relationships", {}).get("mappings", {}).get("data", [])
        for rm in rel_maps:
            m_obj = mapping_dict.get(rm.get("id"))
            if m_obj:
                site = m_obj.get("attributes", {}).get("externalSite", "")
                if site in ("myanimelist/anime", "myanimelist/manga"):
                    try:
                        mal_id = int(m_obj.get("attributes", {}).get("externalId"))
                        break
                    except (ValueError, TypeError):
                        pass
                        
    if not mal_id:
        try:
            mal_id = int(kitsu_id)
        except (ValueError, TypeError):
            mal_id = kitsu_id
            
    content_rating = attr.get("ageRatingGuide") or attr.get("ageRating")
    overview = attr.get("synopsis") or attr.get("description")
    if overview:
        overview = re.sub(r'<[^>]+>', '', overview).strip()
        
    return {
        "title": title,
        "release_year": release_year,
        "genres": genres,
        "cover_url": cover_url,
        "director": None,
        "tmdb_id": mal_id,
        "kitsu_id": kitsu_id,
        "content_rating": content_rating,
        "overview": overview,
        "anime_type": anime_type,
        "manga_status": manga_status,
        "total_chapters": attr.get("chapterCount")
    }

def _kitsu_search_single(title: str, media_type: str = "anime") -> Optional[dict]:
    endpoint = "anime" if media_type.lower() == "anime" else "manga"
    params = {
        "filter[text]": title,
        "page[limit]": 5,
        "include": "mappings,categories"
    }
    data = _kitsu_get(endpoint, params=params)
    if not data or not data.get("data"):
        return None
        
    included = data.get("included", [])
    mapping_dict = {item["id"]: item for item in included if item.get("type") == "mappings"}
    cat_dict = {item["id"]: item.get("attributes", {}).get("title") for item in included if item.get("type") == "categories"}
    
    items = data.get("data", [])
    from thefuzz import fuzz
    best_match = None
    highest_score = 0
    
    for item in items:
        attr = item.get("attributes", {})
        if media_type.lower() == "anime" and (attr.get("subtype") or "").lower() == "movie":
            continue
        titles_to_check = [
            attr.get("canonicalTitle"),
            (attr.get("titles") or {}).get("en"),
            (attr.get("titles") or {}).get("en_jp"),
            (attr.get("titles") or {}).get("ja_jp")
        ]
        for t in titles_to_check:
            if not t: continue
            score = fuzz.token_sort_ratio(t.lower(), title.lower())
            if score > highest_score:
                highest_score = score
                best_match = item
                
    if best_match and highest_score > 60:
        return _parse_kitsu_media(best_match, mapping_dict, cat_dict)
        
    if items:
        first = items[0]
        if media_type.lower() != "anime" or (first.get("attributes", {}).get("subtype") or "").lower() != "movie":
            return _parse_kitsu_media(first, mapping_dict, cat_dict)
            
    return None

def _kitsu_get_details(media_id: int, media_type: str = "anime") -> dict:
    endpoint_type = "anime" if media_type.lower() == "anime" else "manga"
    headers = {"Accept": "application/vnd.api+json", "User-Agent": "Mozilla/5.0"}
    
    # Check if this ID is a MAL ID via mappings
    mal_site = "myanimelist/anime" if media_type.lower() == "anime" else "myanimelist/manga"
    map_res = _kitsu_get("mappings", params={"filter[externalSite]": mal_site, "filter[externalId]": str(media_id), "include": "item"})
    
    kitsu_item = None
    if map_res and map_res.get("included"):
        for inc in map_res.get("included", []):
            if inc.get("type") == endpoint_type:
                kitsu_item = inc
                break
                
    if not kitsu_item:
        # Try direct fetch by ID (assuming ID might be kitsu ID)
        direct_res = _kitsu_get(f"{endpoint_type}/{media_id}", params={"include": "categories"})
        if direct_res and direct_res.get("data"):
            kitsu_item = direct_res.get("data")
            cat_dict = {item["id"]: item.get("attributes", {}).get("title") for item in direct_res.get("included", []) if item.get("type") == "categories"}
            parsed = _parse_kitsu_media(kitsu_item, None, cat_dict)
            parsed["tmdb_id"] = media_id
            return parsed
            
    if kitsu_item:
        kid = kitsu_item.get("id")
        full_res = _kitsu_get(f"{endpoint_type}/{kid}", params={"include": "categories"})
        if full_res and full_res.get("data"):
            cat_dict = {item["id"]: item.get("attributes", {}).get("title") for item in full_res.get("included", []) if item.get("type") == "categories"}
            parsed = _parse_kitsu_media(full_res.get("data"), None, cat_dict)
            parsed["tmdb_id"] = media_id
            return parsed

    return {}

def _kitsu_search_multi(title: str, media_type: str = "anime") -> List[dict]:
    endpoint = "anime" if media_type.lower() == "anime" else "manga"
    params = {
        "filter[text]": title,
        "page[limit]": 12,
        "include": "mappings"
    }
    data = _kitsu_get(endpoint, params=params)
    if not data or not data.get("data"):
        return []
        
    included = data.get("included", [])
    mapping_dict = {item["id"]: item for item in included if item.get("type") == "mappings"}
    
    items = data.get("data", [])
    from thefuzz import fuzz
    formatted_results = []
    
    for item in items:
        attr = item.get("attributes", {})
        if media_type.lower() == "anime" and (attr.get("subtype") or "").lower() == "movie":
            continue
            
        titles = attr.get("titles") or {}
        main_title = titles.get("en") or titles.get("en_jp") or attr.get("canonicalTitle") or titles.get("ja_jp") or ""
        
        start_date = attr.get("startDate") or ""
        year = start_date[:4] if len(start_date) >= 4 else ""
        
        titles_to_check = [
            attr.get("canonicalTitle"),
            titles.get("en"),
            titles.get("en_jp"),
            titles.get("ja_jp")
        ]
        best_score = 0
        for t in titles_to_check:
            if not t: continue
            score = fuzz.token_sort_ratio(title.lower(), t.lower())
            if title.lower() == t.lower():
                score += 100
            if score > best_score:
                best_score = score
                
        overview = attr.get("synopsis") or attr.get("description")
        if overview:
            overview = re.sub(r'<[^>]+>', '', overview).strip()
            
        poster_img = attr.get("posterImage") or {}
        cover_url = poster_img.get("large") or poster_img.get("original") or poster_img.get("medium")
        
        # Resolve MAL ID
        mal_id = None
        rel_maps = item.get("relationships", {}).get("mappings", {}).get("data", [])
        for rm in rel_maps:
            m_obj = mapping_dict.get(rm.get("id"))
            if m_obj:
                site = m_obj.get("attributes", {}).get("externalSite", "")
                if site in ("myanimelist/anime", "myanimelist/manga"):
                    try:
                        mal_id = int(m_obj.get("attributes", {}).get("externalId"))
                        break
                    except (ValueError, TypeError):
                        pass
        if not mal_id:
            try:
                mal_id = int(item.get("id"))
            except (ValueError, TypeError):
                mal_id = item.get("id")

        formatted_results.append({
            "tmdb_id": mal_id,
            "title": main_title,
            "release_year": year,
            "cover_url": cover_url,
            "overview": overview,
            "fuzz_score": best_score
        })
        
    formatted_results.sort(key=lambda x: x["fuzz_score"], reverse=True)
    for fr in formatted_results:
        del fr["fuzz_score"]
        
    return formatted_results[:10]


# --- Public API Exported Functions ---

def search_manga(title: str) -> Optional[int]:
    """
    Searches for a manga and returns its MyAnimeList (MAL) ID.
    Falls back to AniList and Kitsu if Jikan fails or times out.
    """
    url = f"{BASE_URL}/manga"
    params = {"q": title, "limit": 5}
    
    try:
        response = _jikan_get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            results = data.get("data", [])
            if results:
                from thefuzz import fuzz
                best_match = None
                highest_score = 0
                for r in results:
                    titles_to_check = []
                    for title_obj in r.get("titles", []):
                        titles_to_check.append(title_obj.get("title", ""))
                    if not titles_to_check:
                        titles_to_check.append(r.get("title", ""))
                        if r.get("title_english"): titles_to_check.append(r.get("title_english"))
                        if r.get("title_japanese"): titles_to_check.append(r.get("title_japanese"))
                    for t in titles_to_check:
                        if not t: continue
                        score = fuzz.token_sort_ratio(t.lower(), title.lower())
                        if score > highest_score:
                            highest_score = score
                            best_match = r
                if best_match and highest_score > 70:
                    return best_match["mal_id"]
    except Exception as e:
        print(f"Jikan Manga Search Error for '{title}': {e}")
        
    print(f"Falling back to AniList for manga search '{title}'")
    ani_data = _anilist_search_single(title, "MANGA")
    if ani_data and ani_data.get("tmdb_id"):
        mal_id = ani_data["tmdb_id"]
        MANGA_CACHE[mal_id] = ani_data
        return mal_id
        
    print(f"Falling back to Kitsu for manga search '{title}'")
    kitsu_data = _kitsu_search_single(title, "manga")
    if kitsu_data and kitsu_data.get("tmdb_id"):
        mal_id = kitsu_data["tmdb_id"]
        MANGA_CACHE[mal_id] = kitsu_data
        return mal_id
        
    return None

def search_anime(title: str) -> Optional[int]:
    """
    Searches for an anime and returns its MyAnimeList (MAL) ID.
    Falls back to AniList and Kitsu if Jikan fails or times out.
    """
    url = f"{BASE_URL}/anime"
    params = {"q": title, "limit": 5}
    
    try:
        response = _jikan_get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            results = data.get("data", [])
            if results:
                from thefuzz import fuzz
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
                        if r.get("title_english"): titles_to_check.append(r.get("title_english"))
                        if r.get("title_japanese"): titles_to_check.append(r.get("title_japanese"))
                    for t in titles_to_check:
                        if not t: continue
                        score = fuzz.token_sort_ratio(t.lower(), title.lower())
                        if score > highest_score:
                            highest_score = score
                            best_match = r
                if best_match and highest_score > 70:
                    return best_match["mal_id"]
    except Exception as e:
        print(f"Jikan Anime Search Error for '{title}': {e}")
        
    print(f"Falling back to AniList for anime search '{title}'")
    ani_data = _anilist_search_single(title, "ANIME")
    if ani_data and ani_data.get("tmdb_id"):
        mal_id = ani_data["tmdb_id"]
        ANIME_CACHE[mal_id] = ani_data
        return mal_id
        
    print(f"Falling back to Kitsu for anime search '{title}'")
    kitsu_data = _kitsu_search_single(title, "anime")
    if kitsu_data and kitsu_data.get("tmdb_id"):
        mal_id = kitsu_data["tmdb_id"]
        ANIME_CACHE[mal_id] = kitsu_data
        return mal_id
        
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
    Fetches genres, poster, and author for a manga using Jikan (MAL).
    Falls back to AniList or Kitsu on failure/timeout.
    """
    if mal_id in MANGA_CACHE:
        return MANGA_CACHE[mal_id]

    for endpoint_suffix in ("/full", ""):
        url = f"{BASE_URL}/manga/{mal_id}{endpoint_suffix}"
        try:
            response = _jikan_get(url)
            if response.status_code == 200:
                data = response.json().get("data", {})
                result = _parse_manga_data(data, mal_id)
                if result and result.get("title"):
                    MANGA_CACHE[mal_id] = result
                    return result
        except Exception as e:
            print(f"Jikan Manga Details Error for ID {mal_id}: {e}")
            
    print(f"Falling back to AniList for manga details ID {mal_id}")
    ani_data = _anilist_get_details(mal_id, "MANGA")
    if ani_data and ani_data.get("title"):
        MANGA_CACHE[mal_id] = ani_data
        return ani_data

    print(f"Falling back to Kitsu for manga details ID {mal_id}")
    kitsu_data = _kitsu_get_details(mal_id, "manga")
    if kitsu_data and kitsu_data.get("title"):
        MANGA_CACHE[mal_id] = kitsu_data
        return kitsu_data

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
    Falls back to AniList or Kitsu on failure/timeout.
    """
    if mal_id in ANIME_CACHE:
        return ANIME_CACHE[mal_id]

    for endpoint_suffix in ("/full", ""):
        url = f"{BASE_URL}/anime/{mal_id}{endpoint_suffix}"
        try:
            response = _jikan_get(url)
            if response.status_code == 200:
                data = response.json().get("data", {})
                result = _parse_anime_data(data, mal_id)
                if result and result.get("title"):
                    ANIME_CACHE[mal_id] = result
                    return result
        except Exception as e:
            print(f"Jikan Anime Details Error for ID {mal_id}: {e}")

    print(f"Falling back to AniList for anime details ID {mal_id}")
    ani_data = _anilist_get_details(mal_id, "ANIME")
    if ani_data and ani_data.get("title"):
        ANIME_CACHE[mal_id] = ani_data
        return ani_data

    print(f"Falling back to Kitsu for anime details ID {mal_id}")
    kitsu_data = _kitsu_get_details(mal_id, "anime")
    if kitsu_data and kitsu_data.get("title"):
        ANIME_CACHE[mal_id] = kitsu_data
        return kitsu_data

    return {}

def get_jikan_recommendations(mal_id: int, media_type: str = "anime", limit: int = 5) -> List[dict]:
    """
    Fetches recommendations for a specific anime or manga.
    Falls back to AniList on failure/timeout.
    """
    endpoint = "anime" if media_type == "anime" else "manga"
    url = f"{BASE_URL}/{endpoint}/{mal_id}/recommendations"
    
    try:
        response = _jikan_get(url)
        if response.status_code == 200:
            data = response.json()
            candidates = data.get("data", [])[:limit]
            results = []
            for r in candidates:
                entry = r.get("entry", {})
                rec_id = entry.get("mal_id")
                if not rec_id: continue
                results.append({
                    "title": entry.get("title", ""),
                    "cover_url": entry.get("images", {}).get("webp", {}).get("large_image_url"),
                    "tmdb_id": rec_id,
                    "type": "Anime" if media_type == "anime" else "Manga",
                    "popularity": r.get("votes", 0)
                })
            if results:
                return results
    except Exception as e:
        print(f"Jikan Recommendations Error for {media_type} ID {mal_id}: {e}")
        
    print(f"Falling back to AniList recommendations for {media_type} ID {mal_id}")
    return _anilist_recommendations(mal_id, media_type, limit)

def search_jikan_multi(title: str, media_type: str = "anime") -> List[dict]:
    """
    Searches for media items and returns a list of results.
    Falls back to AniList and Kitsu if Jikan fails or returns no results.
    """
    url = f"{BASE_URL}/{media_type}"
    params = {"q": title, "limit": 15}
    
    try:
        response = _jikan_get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            results = data.get("data", [])
            
            if not results and " " in title:
                words = title.split()
                shorter_title = " ".join(words[:2]) if len(words) > 2 else words[0]
                if shorter_title and shorter_title.lower() != title.lower():
                    params["q"] = shorter_title
                    response = _jikan_get(url, params=params)
                    if response.status_code == 200:
                        data = response.json()
                        results = data.get("data", [])
                        
            if media_type == "anime":
                results = [r for r in results if r.get("type") != "Movie"]
                
            if results:
                from thefuzz import fuzz
                formatted_results = []
                for r in results:
                    year = ""
                    if media_type == "manga":
                        year = str(r.get("published", {}).get("prop", {}).get("from", {}).get("year", "") or "")
                    else:
                        year = str(r.get("aired", {}).get("prop", {}).get("from", {}).get("year", "") or "")
                        
                    titles_to_check = []
                    for title_obj in r.get("titles", []):
                        titles_to_check.append(title_obj.get("title", ""))
                    if not titles_to_check:
                        titles_to_check.append(r.get("title", ""))
                        if r.get("title_english"): titles_to_check.append(r.get("title_english"))
                        if r.get("title_japanese"): titles_to_check.append(r.get("title_japanese"))
                    
                    best_score = 0
                    for t in titles_to_check:
                        if not t: continue
                        score = fuzz.token_sort_ratio(title.lower(), t.lower())
                        if title.lower() == t.lower(): score += 100
                        if score > best_score: best_score = score

                    formatted_results.append({
                        "tmdb_id": r.get("mal_id"),
                        "title": r.get("title_english") or r.get("title"),
                        "release_year": year,
                        "cover_url": r.get("images", {}).get("webp", {}).get("large_image_url"),
                        "overview": r.get("synopsis"),
                        "fuzz_score": best_score
                    })
                
                formatted_results.sort(key=lambda x: x["fuzz_score"], reverse=True)
                for fr in formatted_results:
                    del fr["fuzz_score"]
                    
                return formatted_results[:10]
    except Exception as e:
        print(f"Jikan Multi Search Error for '{title}' ({media_type}): {e}")
        
    print(f"Falling back to AniList multi search for '{title}' ({media_type})")
    ani_results = _anilist_search_multi(title, media_type)
    if ani_results:
        return ani_results
        
    print(f"Falling back to Kitsu multi search for '{title}' ({media_type})")
    return _kitsu_search_multi(title, media_type)
