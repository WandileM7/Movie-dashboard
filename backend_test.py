#!/usr/bin/env python3
"""
Taste Cartography Backend API Test Suite
Tests all API endpoints at {NEXT_PUBLIC_BASE_URL}/api
"""

import requests
import json
import uuid
from typing import Dict, Any, List

# Base URL from .env
BASE_URL = "https://emote-screen.preview.emergentagent.com/api"

# Test data
TEST_USER_ID = str(uuid.uuid4())
test_movie_id = None
test_library_entries = []

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
        print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")
    except:
        print(f"Response: {response.text[:500]}")

# Test 1: Health Check
def test_health_check():
    print_test("GET /api - Health Check")
    try:
        response = requests.get(f"{BASE_URL}")
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'ok':
                print_result(True, "Health check passed")
                return True
            else:
                print_result(False, f"Expected status='ok', got {data}")
                return False
        else:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 2: Get Movies List
def test_get_movies():
    global test_movie_id
    print_test("GET /api/movies - List Movies")
    try:
        response = requests.get(f"{BASE_URL}/movies")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'movies' not in data or 'total' not in data:
            print_result(False, "Missing 'movies' or 'total' in response")
            return False
        
        movies = data['movies']
        if len(movies) == 0:
            print_result(False, "No movies returned")
            return False
        
        # Store a movie ID for later tests
        test_movie_id = movies[0]['id']
        
        # Verify movie structure
        movie = movies[0]
        required_fields = ['id', 'title', 'year', 'genres', 'overview', 'rating', 'popularity', 'mood', 'posterUrl', 'providers', 'providersSample']
        missing = [f for f in required_fields if f not in movie]
        if missing:
            print_result(False, f"Missing fields in movie: {missing}")
            return False
        
        # Verify mood structure
        mood = movie['mood']
        if not all(k in mood for k in ['c', 'l', 'm']):
            print_result(False, f"Invalid mood structure: {mood}")
            return False
        
        # Verify mood values are in range -1 to 1
        for k in ['c', 'l', 'm']:
            if not -1 <= mood[k] <= 1:
                print_result(False, f"Mood {k}={mood[k]} out of range [-1, 1]")
                return False
        
        # Verify posterUrl is a Wikipedia URL (or null)
        if movie['posterUrl'] and 'upload.wikimedia.org' not in movie['posterUrl']:
            print_result(False, f"posterUrl is not a Wikipedia URL: {movie['posterUrl']}")
            return False
        
        # Verify providers is non-empty
        if not movie['providers'] or len(movie['providers']) == 0:
            print_result(False, "providers array is empty")
            return False
        
        # Verify providersSample is true
        if movie['providersSample'] != True:
            print_result(False, f"providersSample should be true, got {movie['providersSample']}")
            return False
        
        print_result(True, f"Got {len(movies)} movies, total={data['total']}, test_movie_id={test_movie_id}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 3: Search Movies
def test_search_movies():
    print_test("GET /api/movies?search=inception - Search Movies")
    try:
        response = requests.get(f"{BASE_URL}/movies?search=inception")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        movies = data['movies']
        
        # Check if Inception is in results
        inception_found = any('inception' in m['title'].lower() for m in movies)
        if not inception_found:
            print_result(False, "Inception not found in search results")
            return False
        
        print_result(True, f"Found {len(movies)} movies matching 'inception'")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 4: Filter by Genre
def test_filter_genre():
    print_test("GET /api/movies?genre=Horror - Filter by Genre")
    try:
        response = requests.get(f"{BASE_URL}/movies?genre=Horror")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        movies = data['movies']
        
        if len(movies) == 0:
            print_result(False, "No Horror movies found")
            return False
        
        # Verify all movies have Horror genre
        non_horror = [m for m in movies if 'Horror' not in m['genres']]
        if non_horror:
            print_result(False, f"Found {len(non_horror)} non-Horror movies in results")
            return False
        
        print_result(True, f"Found {len(movies)} Horror movies, all have Horror genre")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 5: Sort by Rating
def test_sort_rating():
    print_test("GET /api/movies?sort=rating - Sort by Rating")
    try:
        response = requests.get(f"{BASE_URL}/movies?sort=rating")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        movies = data['movies']
        
        # Verify descending order
        ratings = [m['rating'] for m in movies[:10]]
        if ratings != sorted(ratings, reverse=True):
            print_result(False, f"Movies not sorted by rating descending: {ratings}")
            return False
        
        print_result(True, f"Movies sorted by rating descending, top rating: {ratings[0]}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 6: Limit Results
def test_limit():
    print_test("GET /api/movies?limit=5 - Limit Results")
    try:
        response = requests.get(f"{BASE_URL}/movies?limit=5")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        movies = data['movies']
        
        if len(movies) != 5:
            print_result(False, f"Expected 5 movies, got {len(movies)}")
            return False
        
        print_result(True, f"Got exactly 5 movies")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 7: Get Genres
def test_get_genres():
    print_test("GET /api/genres - Get Genres")
    try:
        response = requests.get(f"{BASE_URL}/genres")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'genres' not in data:
            print_result(False, "Missing 'genres' in response")
            return False
        
        genres = data['genres']
        if len(genres) == 0:
            print_result(False, "No genres returned")
            return False
        
        # Verify sorted
        if genres != sorted(genres):
            print_result(False, "Genres not sorted")
            return False
        
        print_result(True, f"Got {len(genres)} genres, sorted: {genres[:5]}...")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 8: Get Movie Detail
def test_get_movie_detail():
    print_test(f"GET /api/movies/{test_movie_id} - Get Movie Detail")
    try:
        if not test_movie_id:
            print_result(False, "No test_movie_id available")
            return False
        
        response = requests.get(f"{BASE_URL}/movies/{test_movie_id}")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'movie' not in data or 'similar' not in data:
            print_result(False, "Missing 'movie' or 'similar' in response")
            return False
        
        movie = data['movie']
        similar = data['similar']
        
        if movie['id'] != test_movie_id:
            print_result(False, f"Wrong movie returned: {movie['id']} != {test_movie_id}")
            return False
        
        if len(similar) != 8:
            print_result(False, f"Expected 8 similar movies, got {len(similar)}")
            return False
        
        # Verify none of the similar movies is the requested movie
        if any(m['id'] == test_movie_id for m in similar):
            print_result(False, "Similar movies include the requested movie")
            return False
        
        print_result(True, f"Got movie '{movie['title']}' with 8 similar movies")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 9: Mood Recommendations - Cozy
def test_mood_recommendations_cozy():
    print_test("POST /api/recommendations/mood - Cozy Mood")
    try:
        payload = {
            "mood": {"c": 0.85, "l": 0.75, "m": 0.6},
            "limit": 10
        }
        response = requests.post(f"{BASE_URL}/recommendations/mood", json=payload)
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'target' not in data or 'results' not in data:
            print_result(False, "Missing 'target' or 'results' in response")
            return False
        
        results = data['results']
        if len(results) != 10:
            print_result(False, f"Expected 10 results, got {len(results)}")
            return False
        
        # Verify each result has matchPercent and moodDistance
        for r in results:
            if 'matchPercent' not in r or 'moodDistance' not in r:
                print_result(False, f"Missing matchPercent or moodDistance in result")
                return False
            if not 0 <= r['matchPercent'] <= 100:
                print_result(False, f"matchPercent out of range: {r['matchPercent']}")
                return False
        
        # Verify sorted by moodDistance ascending
        distances = [r['moodDistance'] for r in results]
        if distances != sorted(distances):
            print_result(False, f"Results not sorted by moodDistance: {distances}")
            return False
        
        # Check for cozy movie titles (comforting/light)
        titles = [r['title'] for r in results]
        cozy_keywords = ['julie', 'chef', 'amelie', 'paddington', 'notting', 'grand budapest', 'moonrise', 'fantastic mr']
        cozy_found = any(any(kw in t.lower() for kw in cozy_keywords) for t in titles[:5])
        
        print_result(True, f"Got 10 cozy recommendations, top: {titles[0]}, cozy_match={cozy_found}")
        return data  # Return for comparison
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 10: Mood Recommendations - Dark
def test_mood_recommendations_dark():
    print_test("POST /api/recommendations/mood - Dark Mood")
    try:
        payload = {
            "mood": {"c": -0.9, "l": -0.9, "m": -0.7},
            "limit": 10
        }
        response = requests.post(f"{BASE_URL}/recommendations/mood", json=payload)
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        results = data['results']
        
        if len(results) != 10:
            print_result(False, f"Expected 10 results, got {len(results)}")
            return False
        
        # Check for dark movie titles
        titles = [r['title'] for r in results]
        dark_keywords = ['hereditary', 'oldboy', 'requiem', 'irreversible', 'martyrs', 'funny games', 'come and see']
        dark_found = any(any(kw in t.lower() for kw in dark_keywords) for t in titles[:5])
        
        print_result(True, f"Got 10 dark recommendations, top: {titles[0]}, dark_match={dark_found}")
        return data  # Return for comparison
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 11: Compare Cozy vs Dark
def test_compare_moods(cozy_data, dark_data):
    print_test("Compare Cozy vs Dark Mood Results")
    try:
        if not cozy_data or not dark_data:
            print_result(False, "Missing cozy or dark data")
            return False
        
        cozy_ids = set(r['id'] for r in cozy_data['results'])
        dark_ids = set(r['id'] for r in dark_data['results'])
        
        overlap = len(cozy_ids & dark_ids)
        if overlap > 3:
            print_result(False, f"Too much overlap between cozy and dark results: {overlap}/10")
            return False
        
        print_result(True, f"Cozy and dark results differ substantially, overlap={overlap}/10")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 12: Mood Recommendations - Invalid Body
def test_mood_recommendations_invalid():
    print_test("POST /api/recommendations/mood - Invalid Body")
    try:
        # Test with missing mood values (should clamp/default, not 500)
        payload = {"mood": {}, "limit": 5}
        response = requests.post(f"{BASE_URL}/recommendations/mood", json=payload)
        print_response(response)
        
        if response.status_code == 500:
            print_result(False, "Got 500 error for missing mood values (should clamp/default)")
            return False
        
        if response.status_code == 200:
            data = response.json()
            if 'results' in data and len(data['results']) > 0:
                print_result(True, "Missing mood values handled gracefully (clamped/defaulted)")
                return True
        
        print_result(True, f"Invalid body handled with status {response.status_code}")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 13: Library - Add Movie (watching)
def test_library_add_watching():
    global test_library_entries
    print_test(f"POST /api/library - Add Movie (watching) for user {TEST_USER_ID}")
    try:
        if not test_movie_id:
            print_result(False, "No test_movie_id available")
            return False
        
        payload = {
            "userId": TEST_USER_ID,
            "movieId": test_movie_id,
            "status": "watching"
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'item' not in data:
            print_result(False, "Missing 'item' in response")
            return False
        
        item = data['item']
        if item['userId'] != TEST_USER_ID or item['movieId'] != test_movie_id:
            print_result(False, f"Wrong userId or movieId in response")
            return False
        
        if item['status'] != 'watching':
            print_result(False, f"Expected status='watching', got {item['status']}")
            return False
        
        if 'addedAt' not in item or 'updatedAt' not in item:
            print_result(False, "Missing addedAt or updatedAt")
            return False
        
        test_library_entries.append(test_movie_id)
        print_result(True, f"Added movie to library with status 'watching'")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 14: Library - Update with Rating
def test_library_update_rating():
    print_test(f"POST /api/library - Update with Rating")
    try:
        payload = {
            "userId": TEST_USER_ID,
            "movieId": test_movie_id,
            "rating": 5
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        item = data['item']
        
        if item['status'] != 'watching':
            print_result(False, f"Status changed unexpectedly: {item['status']}")
            return False
        
        if item.get('rating') != 5:
            print_result(False, f"Expected rating=5, got {item.get('rating')}")
            return False
        
        print_result(True, f"Updated movie with rating=5, status kept as 'watching'")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 15: Library - Add Another Movie (watched)
def test_library_add_watched():
    global test_library_entries
    print_test(f"POST /api/library - Add Another Movie (watched)")
    try:
        # Get a different movie
        response = requests.get(f"{BASE_URL}/movies?limit=10")
        movies = response.json()['movies']
        second_movie_id = next((m['id'] for m in movies if m['id'] != test_movie_id), None)
        
        if not second_movie_id:
            print_result(False, "Could not find a second movie")
            return False
        
        payload = {
            "userId": TEST_USER_ID,
            "movieId": second_movie_id,
            "status": "watched",
            "rating": 4
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        item = data['item']
        
        if item['status'] != 'watched' or item.get('rating') != 4:
            print_result(False, f"Wrong status or rating: {item}")
            return False
        
        test_library_entries.append(second_movie_id)
        print_result(True, f"Added second movie with status='watched', rating=4")
        return second_movie_id
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 16: Library - Get All Items
def test_library_get_all():
    print_test(f"GET /api/library?userId={TEST_USER_ID} - Get All Items")
    try:
        response = requests.get(f"{BASE_URL}/library?userId={TEST_USER_ID}")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'items' not in data:
            print_result(False, "Missing 'items' in response")
            return False
        
        items = data['items']
        if len(items) != 2:
            print_result(False, f"Expected 2 items, got {len(items)}")
            return False
        
        # Verify each item has joined movie object
        for item in items:
            if 'movie' not in item:
                print_result(False, "Missing 'movie' in library item")
                return False
            if 'title' not in item['movie']:
                print_result(False, "Movie object incomplete")
                return False
        
        # Verify sorted by updatedAt desc (most recent first)
        if items[0]['updatedAt'] < items[1]['updatedAt']:
            print_result(False, "Items not sorted by updatedAt desc")
            return False
        
        print_result(True, f"Got 2 library items, each with joined movie object, sorted by updatedAt desc")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 17: Library - Filter by Status
def test_library_filter_status():
    print_test(f"GET /api/library?userId={TEST_USER_ID}&status=watching - Filter by Status")
    try:
        response = requests.get(f"{BASE_URL}/library?userId={TEST_USER_ID}&status=watching")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        items = data['items']
        
        if len(items) != 1:
            print_result(False, f"Expected 1 item with status='watching', got {len(items)}")
            return False
        
        if items[0]['status'] != 'watching':
            print_result(False, f"Wrong status: {items[0]['status']}")
            return False
        
        print_result(True, f"Got 1 item with status='watching'")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 18: Library - Validation (Invalid Status)
def test_library_validation_status():
    print_test("POST /api/library - Validation (Invalid Status)")
    try:
        payload = {
            "userId": TEST_USER_ID,
            "movieId": test_movie_id,
            "status": "invalid_status"
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 400:
            print_result(False, f"Expected 400, got {response.status_code}")
            return False
        
        print_result(True, "Invalid status rejected with 400")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 19: Library - Validation (Invalid Rating)
def test_library_validation_rating():
    print_test("POST /api/library - Validation (Invalid Rating)")
    try:
        payload = {
            "userId": TEST_USER_ID,
            "movieId": test_movie_id,
            "rating": 7
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 400:
            print_result(False, f"Expected 400, got {response.status_code}")
            return False
        
        print_result(True, "Invalid rating rejected with 400")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 20: Library - Validation (Missing userId)
def test_library_validation_userid():
    print_test("POST /api/library - Validation (Missing userId)")
    try:
        payload = {
            "movieId": test_movie_id,
            "status": "watching"
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 400:
            print_result(False, f"Expected 400, got {response.status_code}")
            return False
        
        print_result(True, "Missing userId rejected with 400")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 21: Library - Validation (Nonexistent movieId)
def test_library_validation_movieid():
    print_test("POST /api/library - Validation (Nonexistent movieId)")
    try:
        fake_movie_id = str(uuid.uuid4())
        payload = {
            "userId": TEST_USER_ID,
            "movieId": fake_movie_id,
            "status": "watching"
        }
        response = requests.post(f"{BASE_URL}/library", json=payload)
        print_response(response)
        
        if response.status_code != 404:
            print_result(False, f"Expected 404, got {response.status_code}")
            return False
        
        print_result(True, "Nonexistent movieId rejected with 404")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 22: For You Recommendations (with userId)
def test_foryou_with_user():
    print_test(f"GET /api/recommendations/foryou?userId={TEST_USER_ID} - For You with User")
    try:
        response = requests.get(f"{BASE_URL}/recommendations/foryou?userId={TEST_USER_ID}")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if 'profileBased' not in data or 'results' not in data:
            print_result(False, "Missing 'profileBased' or 'results' in response")
            return False
        
        if data['profileBased'] != True:
            print_result(False, f"Expected profileBased=true, got {data['profileBased']}")
            return False
        
        results = data['results']
        if len(results) != 20:
            print_result(False, f"Expected 20 results, got {len(results)}")
            return False
        
        # Verify library movies are excluded
        library_ids = set(test_library_entries)
        result_ids = set(r['id'] for r in results)
        overlap = library_ids & result_ids
        if overlap:
            print_result(False, f"Library movies not excluded: {overlap}")
            return False
        
        print_result(True, f"Got 20 profile-based recommendations, library movies excluded")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 23: For You Recommendations (without userId)
def test_foryou_without_user():
    print_test("GET /api/recommendations/foryou - For You without User")
    try:
        response = requests.get(f"{BASE_URL}/recommendations/foryou")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('profileBased') != False:
            print_result(False, f"Expected profileBased=false, got {data.get('profileBased')}")
            return False
        
        results = data['results']
        if len(results) != 20:
            print_result(False, f"Expected 20 results, got {len(results)}")
            return False
        
        print_result(True, f"Got 20 popular recommendations (no profile)")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 24: Library - Delete Entry
def test_library_delete():
    print_test(f"DELETE /api/library/{test_movie_id}?userId={TEST_USER_ID} - Delete Entry")
    try:
        response = requests.delete(f"{BASE_URL}/library/{test_movie_id}?userId={TEST_USER_ID}")
        print_response(response)
        
        if response.status_code != 200:
            print_result(False, f"Expected 200, got {response.status_code}")
            return False
        
        data = response.json()
        if data.get('deleted') != True:
            print_result(False, f"Expected deleted=true, got {data}")
            return False
        
        # Verify it's gone
        response = requests.get(f"{BASE_URL}/library?userId={TEST_USER_ID}")
        items = response.json()['items']
        if len(items) != 1:
            print_result(False, f"Expected 1 item left, got {len(items)}")
            return False
        
        print_result(True, f"Deleted entry, 1 item remaining")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Test 25: Cleanup - Delete All Test Entries
def test_cleanup():
    print_test("Cleanup - Delete All Test Library Entries")
    try:
        for movie_id in test_library_entries:
            response = requests.delete(f"{BASE_URL}/library/{movie_id}?userId={TEST_USER_ID}")
            if response.status_code != 200:
                print(f"Warning: Failed to delete {movie_id}")
        
        # Verify all deleted
        response = requests.get(f"{BASE_URL}/library?userId={TEST_USER_ID}")
        items = response.json()['items']
        if len(items) != 0:
            print_result(False, f"Expected 0 items, got {len(items)}")
            return False
        
        print_result(True, f"All test entries cleaned up")
        return True
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

# Run all tests
def run_all_tests():
    print("\n" + "="*80)
    print("TASTE CARTOGRAPHY BACKEND API TEST SUITE")
    print(f"Base URL: {BASE_URL}")
    print(f"Test User ID: {TEST_USER_ID}")
    print("="*80)
    
    results = {}
    
    # Health & Catalog
    results['health'] = test_health_check()
    results['movies'] = test_get_movies()
    results['search'] = test_search_movies()
    results['genre_filter'] = test_filter_genre()
    results['sort_rating'] = test_sort_rating()
    results['limit'] = test_limit()
    results['genres'] = test_get_genres()
    results['movie_detail'] = test_get_movie_detail()
    
    # Mood Recommendations
    cozy_data = test_mood_recommendations_cozy()
    results['mood_cozy'] = bool(cozy_data)
    dark_data = test_mood_recommendations_dark()
    results['mood_dark'] = bool(dark_data)
    results['mood_compare'] = test_compare_moods(cozy_data, dark_data)
    results['mood_invalid'] = test_mood_recommendations_invalid()
    
    # Library CRUD
    results['library_add_watching'] = test_library_add_watching()
    results['library_update_rating'] = test_library_update_rating()
    second_movie = test_library_add_watched()
    results['library_add_watched'] = bool(second_movie)
    results['library_get_all'] = test_library_get_all()
    results['library_filter_status'] = test_library_filter_status()
    
    # Library Validation
    results['library_val_status'] = test_library_validation_status()
    results['library_val_rating'] = test_library_validation_rating()
    results['library_val_userid'] = test_library_validation_userid()
    results['library_val_movieid'] = test_library_validation_movieid()
    
    # For You Recommendations
    results['foryou_with_user'] = test_foryou_with_user()
    results['foryou_without_user'] = test_foryou_without_user()
    
    # Delete & Cleanup
    results['library_delete'] = test_library_delete()
    results['cleanup'] = test_cleanup()
    
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
