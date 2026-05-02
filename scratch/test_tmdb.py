import os
import requests

TMDB_API_KEY = "3d50abb7eaf10e7b72d1fa19cf57b304"
BASE_URL = "https://api.themoviedb.org/3"

def test_id(tmdb_id, media_type):
    url = f"{BASE_URL}/{media_type}/{tmdb_id}"
    params = {"api_key": TMDB_API_KEY}
    
    print(f"Testing {media_type} ID {tmdb_id}...")
    try:
        response = requests.get(url, params=params)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Name: {data.get('name') or data.get('title')}")
            print(f"Found!")
        else:
            print(f"Failed: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

test_id(37854, "tv")
test_id(37854, "movie")
