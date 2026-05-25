import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine

import sys
import os
sys.path.append(os.getcwd())

# Create an in-memory database for testing
test_engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

from main import preview_metadata, get_suggestions
from database import MediaItem

class TestAnimeFallback(unittest.TestCase):
    def setUp(self):
        SQLModel.metadata.create_all(test_engine)
        self.session = Session(test_engine)

    def tearDown(self):
        self.session.close()

    @patch("jikan_helper.search_anime")
    @patch("jikan_helper.get_anime_details")
    @patch("tmdb_helper.search_tmdb")
    @patch("tmdb_helper.get_tv_details")
    def test_preview_metadata_anime_no_tmdb_fallback(self, mock_get_tv_details, mock_search_tmdb, mock_get_anime_details, mock_search_anime):
        # 1. Jikan fails to find or return details
        mock_search_anime.return_value = None
        mock_get_anime_details.return_value = {}
        
        # 2. TMDB has a match (mocked)
        mock_search_tmdb.return_value = 12345
        mock_get_tv_details.return_value = {
            "title": "Mock TV Anime on TMDB",
            "release_year": "2024",
            "genres": "Action",
            "cover_url": "http://example.com/cover.jpg",
            "director": "Studio",
            "tmdb_id": 12345,
            "content_rating": "PG-13",
            "overview": "Overview"
        }
        
        # 3. Call preview_metadata
        # We expect this to raise HTTPException (404/400) because TMDB fallback is disabled.
        # Under current code, it falls back to TMDB, so it will return the TMDB data instead of raising an exception.
        # Thus, this assertRaises will FAIL on current code!
        with self.assertRaises(HTTPException) as ctx:
            preview_metadata(type="Anime", title="Mock TV Anime", session=self.session)
        
        self.assertIn(ctx.exception.status_code, [404, 400])
        print("Test passed: preview_metadata raised HTTPException as expected when Jikan failed.")

    @patch("jikan_helper.get_anime_details")
    @patch("tmdb_helper.search_tmdb")
    @patch("tmdb_helper.get_tv_details")
    def test_get_suggestions_anime_no_tmdb_fallback(self, mock_get_tv_details, mock_search_tmdb, mock_get_anime_details):
        # Setup: Add a high rated Anime item to the database so it's picked as seed
        anime_seed = MediaItem(
            title="My Seed Anime",
            type="Anime",
            rating="9/10",
            numeric_rating="9",
            tmdb_id=11111, # MAL ID
            source="manual"
        )
        self.session.add(anime_seed)
        self.session.commit()
        
        # Mock get_jikan_recommendations to return a candidate anime
        candidate_rec = {
            "title": "Recommended Anime",
            "cover_url": "http://example.com/rec.jpg",
            "tmdb_id": 22222,
            "type": "Anime",
            "popularity": 100
        }
        
        with patch("main.get_jikan_recommendations", return_value=[candidate_rec]):
            # Mock get_anime_details to fail for the candidate
            mock_get_anime_details.return_value = {}
            
            # Mock TMDB fallback to return a match
            mock_search_tmdb.return_value = 55555
            mock_get_tv_details.return_value = {
                "title": "TMDB Live Action Fallback",
                "release_year": "2024",
                "genres": "Action",
                "cover_url": "http://example.com/tmdb.jpg",
                "director": "Live Action Director",
                "tmdb_id": 55555,
                "content_rating": "TV-MA",
                "overview": "Overview"
            }
            
            # Call get_suggestions
            # Under current code, because of TMDB fallback, "Recommended Anime" gets resolved via TMDB details,
            # and is returned as a suggestion (meaning the suggestions list has 1+ items).
            # Under new code, since TMDB fallback is disabled and Jikan details failed,
            # it should NOT fall back to TMDB, so the candidate is skipped, resulting in empty suggestions.
            suggestions = get_suggestions(category="Anime", session=self.session)
            
            # We assert that suggestions is empty, meaning no fallback occurred.
            # On current code, this will FAIL because suggestions will contain the TMDB fallback item.
            self.assertEqual(len(suggestions), 0)
            print("Test passed: get_suggestions did not fall back to TMDB when Jikan details failed.")

    @patch("jikan_helper.search_jikan_multi")
    @patch("tmdb_helper.search_tmdb_multi")
    def test_search_multi_anime_uses_only_jikan(self, mock_tmdb_multi, mock_jikan_multi):
        from main import search_multi
        mock_jikan_multi.return_value = [{"title": "Jikan Result"}]
        
        results = search_multi(title="Attack", type="Anime")
        
        mock_jikan_multi.assert_called_once_with("Attack", "anime")
        mock_tmdb_multi.assert_not_called()
        self.assertEqual(results, [{"title": "Jikan Result"}])
        print("Test passed: search_multi for Anime uses Jikan and does not call TMDB.")

if __name__ == "__main__":
    unittest.main()
