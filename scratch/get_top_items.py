import sys
import os
sys.path.append('/Users/cdesilva/Coding/media-tracker')

# Set environment variable to use the Supabase URL from .env
from dotenv import load_dotenv
load_dotenv('/Users/cdesilva/Coding/media-tracker/.env')

from database import engine, MediaItem
from sqlmodel import Session, select

with Session(engine) as session:
    print("--- Top Anime ---")
    anime = session.exec(select(MediaItem).where(MediaItem.type == 'Anime', MediaItem.is_ranking == True).order_by(MediaItem.rating).limit(3)).all()
    for item in anime:
        print(f"{item.rating}: {item.title}")
        
    print("\n--- Top Manga ---")
    manga = session.exec(select(MediaItem).where(MediaItem.type == 'Manga', MediaItem.is_ranking == True).order_by(MediaItem.rating).limit(3)).all()
    for item in manga:
        print(f"{item.rating}: {item.title}")
        
    print("\n--- Top Movies ---")
    movies = session.exec(select(MediaItem).where(MediaItem.type == 'Movies', MediaItem.is_ranking == True).order_by(MediaItem.rating).limit(3)).all()
    for item in movies:
        print(f"{item.rating}: {item.title}")
        
    print("\n--- Top TV Series ---")
    tv = session.exec(select(MediaItem).where(MediaItem.type == 'TV Series', MediaItem.is_ranking == True).order_by(MediaItem.rating).limit(3)).all()
    for item in tv:
        print(f"{item.rating}: {item.title}")
