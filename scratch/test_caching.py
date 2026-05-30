import sys
import os
sys.path.append(os.getcwd())

from fastapi.testclient import TestClient
from main import app

def test_cache_headers():
    client = TestClient(app)
    
    # 1. Test recent recommendations caching
    resp1 = client.get("/api/recommendations/recent/Movies")
    cache_control_1 = resp1.headers.get("Cache-Control")
    print(f"recent/Movies Cache-Control: {cache_control_1}")
    assert cache_control_1 == "no-cache, no-store, must-revalidate", f"recent/Movies cache header mismatch: {cache_control_1}"
    
    # 2. Test check recommendations caching
    resp2 = client.get("/api/recommendations/check?ext_id=123&type=Movies")
    cache_control_2 = resp2.headers.get("Cache-Control")
    print(f"check Cache-Control: {cache_control_2}")
    assert cache_control_2 == "no-cache, no-store, must-revalidate", f"check cache header mismatch: {cache_control_2}"
    
    # 3. Test all recommendations caching
    resp3 = client.get("/api/recommendations/all")
    cache_control_3 = resp3.headers.get("Cache-Control")
    print(f"all Cache-Control: {cache_control_3}")
    assert cache_control_3 == "no-cache, no-store, must-revalidate", f"all cache header mismatch: {cache_control_3}"
    
    print("All cache header tests passed successfully!")

if __name__ == "__main__":
    test_cache_headers()
