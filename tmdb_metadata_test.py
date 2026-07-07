#!/usr/bin/env python3
"""
TMDB Metadata Endpoint Test Suite
Tests the new GET /api/movies/:id/metadata endpoint with TMDB integration
"""

import requests
import json
import uuid
import time
from typing import Dict, Any, List

# Base URL from .env
BASE_URL = "https://emote-screen.preview.emergentagent.com/api"

# Test data
TEST_USER_ID = str(uuid.uuid4())
test_movie_ids = []

def print_test(name: str):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_result(success: bool, message: str):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def print_response(response: requests.Response):
    print(f"Status: {response.status_code}")
    try:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)[:800]}")
    except:
        print(f"Response: {response.text[:500]}")

# Test 1: Get movie IDs for testing
def get_test_movie_ids():
    global test_movie_ids
    print_test("GET /api/movies?limit=10 - Get Movie IDs for Testing")
    try:
        response = requests.get(f"{BASE_URL}/movies?limit=10")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        movies = data.get('movies', [])
        
        if len(movies) < 4:
            print_result(False, f"Need at least 4 movies, got {len(movies)}")
            return False
        
        # Get 4 different movie IDs
        test_movie_ids = [m['id'] for m in movies[:4]]
        movie_titles = [m['title'] for m in movies[:4]]
        
        print_result(True, f"Got {len(test_movie_ids)} movie IDs for testing: {movie_titles}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 2: TMDB Metadata - First Movie (ZA region)
def test_tmdb_metadata_movie1():
    print_test(f"GET /api/movies/{test_movie_ids[0]}/metadata?region=ZA - TMDB Metadata (Movie 1)")
    try:
        if not test_movie_ids:
            print_result(False, "No test movie IDs available")
            return False
        
        movie_id = test_movie_ids[0]
        response = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=ZA")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify required fields
        if 'tmdbEnabled' not in data:
            print_result(False, "Missing 'tmdbEnabled' field")
            return False
        
        if data['tmdbEnabled'] != True:
            print_result(False, f"Expected tmdbEnabled=true, got {data['tmdbEnabled']}")
            return False
        
        # Verify tmdbId is a number
        if 'tmdbId' not in data:
            print_result(False, "Missing 'tmdbId' field")
            return False
        
        if data['tmdbId'] is not None and not isinstance(data['tmdbId'], int):
            print_result(False, f"tmdbId should be a number, got {type(data['tmdbId'])}")
            return False
        
        # Verify trailerKey (string or null)
        if 'trailerKey' not in data:
            print_result(False, "Missing 'trailerKey' field")
            return False
        
        if data['trailerKey'] is not None and not isinstance(data['trailerKey'], str):
            print_result(False, f"trailerKey should be string or null, got {type(data['trailerKey'])}")
            return False
        
        # Verify providers structure
        if 'providers' not in data:
            print_result(False, "Missing 'providers' field")
            return False
        
        providers = data['providers']
        if providers is not None:
            if 'region' not in providers:
                print_result(False, "Missing 'region' in providers")
                return False
            
            if providers['region'] != 'ZA':
                print_result(False, f"Expected region='ZA', got {providers['region']}")
                return False
            
            if 'link' not in providers:
                print_result(False, "Missing 'link' in providers")
                return False
            
            if 'items' not in providers:
                print_result(False, "Missing 'items' in providers")
                return False
            
            if 'cachedAt' not in providers:
                print_result(False, "Missing 'cachedAt' in providers")
                return False
            
            # Verify provider items structure
            items = providers['items']
            if isinstance(items, list) and len(items) > 0:
                item = items[0]
                required_item_fields = ['providerId', 'name', 'logoUrl', 'category']
                missing = [f for f in required_item_fields if f not in item]
                if missing:
                    print_result(False, f"Missing fields in provider item: {missing}")
                    return False
                
                # Verify logoUrl is a TMDB image URL
                if item['logoUrl'] and 'image.tmdb.org' not in item['logoUrl']:
                    print_result(False, f"logoUrl should be a TMDB image URL, got {item['logoUrl']}")
                    return False
                
                # Verify category is one of stream/rent/buy
                if item['category'] not in ['stream', 'rent', 'buy']:
                    print_result(False, f"category should be stream/rent/buy, got {item['category']}")
                    return False
        
        # Verify posterUrl
        if 'posterUrl' not in data:
            print_result(False, "Missing 'posterUrl' field")
            return False
        
        print_result(True, f"TMDB metadata valid: tmdbId={data['tmdbId']}, trailerKey={data['trailerKey'][:20] if data['trailerKey'] else None}, providers={len(providers['items']) if providers else 0} items")
        return data
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 3: TMDB Metadata - Second Movie (ZA region)
def test_tmdb_metadata_movie2():
    print_test(f"GET /api/movies/{test_movie_ids[1]}/metadata?region=ZA - TMDB Metadata (Movie 2)")
    try:
        if len(test_movie_ids) < 2:
            print_result(False, "Not enough test movie IDs")
            return False
        
        movie_id = test_movie_ids[1]
        response = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=ZA")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('tmdbEnabled') != True:
            print_result(False, f"Expected tmdbEnabled=true")
            return False
        
        print_result(True, f"TMDB metadata valid: tmdbId={data.get('tmdbId')}, trailerKey={data.get('trailerKey')[:20] if data.get('trailerKey') else None}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 4: TMDB Metadata - Third Movie (ZA region)
def test_tmdb_metadata_movie3():
    print_test(f"GET /api/movies/{test_movie_ids[2]}/metadata?region=ZA - TMDB Metadata (Movie 3)")
    try:
        if len(test_movie_ids) < 3:
            print_result(False, "Not enough test movie IDs")
            return False
        
        movie_id = test_movie_ids[2]
        response = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=ZA")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('tmdbEnabled') != True:
            print_result(False, f"Expected tmdbEnabled=true")
            return False
        
        print_result(True, f"TMDB metadata valid: tmdbId={data.get('tmdbId')}, trailerKey={data.get('trailerKey')[:20] if data.get('trailerKey') else None}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 5: TMDB Metadata - Fourth Movie (ZA region)
def test_tmdb_metadata_movie4():
    print_test(f"GET /api/movies/{test_movie_ids[3]}/metadata?region=ZA - TMDB Metadata (Movie 4)")
    try:
        if len(test_movie_ids) < 4:
            print_result(False, "Not enough test movie IDs")
            return False
        
        movie_id = test_movie_ids[3]
        response = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=ZA")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('tmdbEnabled') != True:
            print_result(False, f"Expected tmdbEnabled=true")
            return False
        
        print_result(True, f"TMDB metadata valid: tmdbId={data.get('tmdbId')}, trailerKey={data.get('trailerKey')[:20] if data.get('trailerKey') else None}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 6: Caching - Second call should be fast
def test_tmdb_caching():
    print_test(f"GET /api/movies/{test_movie_ids[0]}/metadata?region=ZA - Caching Test")
    try:
        if not test_movie_ids:
            print_result(False, "No test movie IDs available")
            return False
        
        movie_id = test_movie_ids[0]
        
        # First call (should be cached from previous test)
        start_time = time.time()
        response1 = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=ZA")
        elapsed1 = (time.time() - start_time) * 1000  # Convert to ms
        
        if response1.status_code != 200:
            print_result(False, f"First call failed: {response1.status_code}")
            return False
        
        data1 = response1.json()
        
        # Second call (should be from cache)
        start_time = time.time()
        response2 = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=ZA")
        elapsed2 = (time.time() - start_time) * 1000  # Convert to ms
        
        if response2.status_code != 200:
            print_result(False, f"Second call failed: {response2.status_code}")
            return False
        
        data2 = response2.json()
        
        print(f"First call: {elapsed1:.0f}ms, Second call: {elapsed2:.0f}ms")
        
        # Verify data is identical
        if data1.get('tmdbId') != data2.get('tmdbId'):
            print_result(False, f"tmdbId mismatch: {data1.get('tmdbId')} != {data2.get('tmdbId')}")
            return False
        
        if data1.get('trailerKey') != data2.get('trailerKey'):
            print_result(False, f"trailerKey mismatch: {data1.get('trailerKey')} != {data2.get('trailerKey')}")
            return False
        
        # Second call should be reasonably fast (cached)
        if elapsed2 > 300:
            print_result(False, f"Second call too slow: {elapsed2:.0f}ms (expected <300ms)")
            return False
        
        print_result(True, f"Caching working: second call {elapsed2:.0f}ms, data identical")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 7: Nonexistent movie ID should return 404
def test_tmdb_nonexistent_movie():
    print_test("GET /api/movies/nonexistent-id/metadata - Nonexistent Movie")
    try:
        fake_id = str(uuid.uuid4())
        response = requests.get(f"{BASE_URL}/movies/{fake_id}/metadata")
        print_response(response)
        
        if response.status_code != 404:
            print_result(False, f"Expected 404, got {response.status_code}")
            return False
        
        data = response.json()
        if 'error' not in data:
            print_result(False, "Expected error message in response")
            return False
        
        print_result(True, f"Nonexistent movie correctly returns 404")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 8: Different region (US) should return different providers
def test_tmdb_different_region():
    print_test(f"GET /api/movies/{test_movie_ids[0]}/metadata?region=US - Different Region")
    try:
        if not test_movie_ids:
            print_result(False, "No test movie IDs available")
            return False
        
        movie_id = test_movie_ids[0]
        response = requests.get(f"{BASE_URL}/movies/{movie_id}/metadata?region=US")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        
        if data.get('tmdbEnabled') != True:
            print_result(False, f"Expected tmdbEnabled=true")
            return False
        
        providers = data.get('providers')
        if providers is None:
            print_result(True, f"No providers available for US region (acceptable)")
            return True
        
        if providers.get('region') != 'US':
            print_result(False, f"Expected region='US', got {providers.get('region')}")
            return False
        
        print_result(True, f"US region metadata valid: region={providers.get('region')}, providers={len(providers.get('items', []))} items")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 9: Quick Regression - Mood Recommendations
def test_regression_mood_recommendations():
    print_test("POST /api/recommendations/mood - Regression Test (Cozy Mood)")
    try:
        payload = {
            "mood": {"c": 0.85, "l": 0.75, "m": 0.6},
            "limit": 5
        }
        response = requests.post(f"{BASE_URL}/recommendations/mood", json=payload)
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        results = data.get('results', [])
        
        if len(results) != 5:
            print_result(False, f"Expected 5 results, got {len(results)}")
            return False
        
        # Verify matchPercent exists
        for r in results:
            if 'matchPercent' not in r:
                print_result(False, "Missing matchPercent in result")
                return False
        
        print_result(True, f"Mood recommendations still working: {len(results)} results with matchPercent")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 10: Quick Regression - Library CRUD
def test_regression_library_crud():
    print_test("Library CRUD - Regression Test")
    try:
        # Get a movie ID
        response = requests.get(f"{BASE_URL}/movies?limit=1")
        movie_id = response.json()['movies'][0]['id']
        
        # POST - Add to library
        payload = {
            "userId": TEST_USER_ID,
            "movieId": movie_id,
            "status": "watching",
            "rating": 4
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        if response.status_code != 200:
            print_result(False, f"POST failed: {response.status_code}")
            return False
        
        # GET - Retrieve library
        response = requests.get(f"{BASE_URL}/library?userId={TEST_USER_ID}")
        if response.status_code != 200:
            print_result(False, f"GET failed: {response.status_code}")
            return False
        
        items = response.json().get('items', [])
        if len(items) != 1:
            print_result(False, f"Expected 1 item, got {len(items)}")
            return False
        
        # DELETE - Remove from library
        response = requests.delete(f"{BASE_URL}/library/{movie_id}?userId={TEST_USER_ID}")
        if response.status_code != 200:
            print_result(False, f"DELETE failed: {response.status_code}")
            return False
        
        # Verify deleted
        response = requests.get(f"{BASE_URL}/library?userId={TEST_USER_ID}")
        items = response.json().get('items', [])
        if len(items) != 0:
            print_result(False, f"Expected 0 items after delete, got {len(items)}")
            return False
        
        print_result(True, "Library CRUD still working: POST/GET/DELETE all successful")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Run all tests
def run_all_tests():
    print("\n" + "="*80)
    print("TMDB METADATA ENDPOINT TEST SUITE")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print("="*80)
    
    results = {}
    
    # Get test movie IDs
    results['get_movie_ids'] = get_test_movie_ids()
    
    if not results['get_movie_ids']:
        print("\n❌ CRITICAL: Could not get movie IDs. Aborting tests.")
        return results
    
    # TMDB Metadata Tests (3-4 movies)
    results['tmdb_movie1'] = test_tmdb_metadata_movie1()
    results['tmdb_movie2'] = test_tmdb_metadata_movie2()
    results['tmdb_movie3'] = test_tmdb_metadata_movie3()
    results['tmdb_movie4'] = test_tmdb_metadata_movie4()
    
    # Caching Test
    results['tmdb_caching'] = test_tmdb_caching()
    
    # Nonexistent Movie Test
    results['tmdb_nonexistent'] = test_tmdb_nonexistent_movie()
    
    # Different Region Test
    results['tmdb_different_region'] = test_tmdb_different_region()
    
    # Regression Tests
    results['regression_mood'] = test_regression_mood_recommendations()
    results['regression_library'] = test_regression_library_crud()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    print(f"\nPassed: {passed}/{total}")
    print(f"Failed: {total - passed}/{total}")
    
    print("\nDetailed Results:")
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test}")
    
    print("\n" + "="*80)
    
    return results

if __name__ == "__main__":
    run_all_tests()
