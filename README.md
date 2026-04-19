# Silva's Media Tracker

Silva's Media Tracker is a personal project I built to help me organize and track all the movies, TV series, manga, and anime I've gone through. I wanted a way to see my collection in different ways (whether that's through a clean cinematic grid, top-tier rankings, or just seeing my favorites)all without the clutter of mainstream tracking sites.

The system pulls my ratings directly from Discord and displays them on a dark-themed dashboard that I designed to fit my own taste and keep things simple.

## System Architecture

The application is built on a modern Python stack with a focus on speed and simplicity:

- **Backend**: FastAPI serves as the high-performance asynchronous core.
- **ORM/Database**: SQLModel (built on Pydantic and SQLAlchemy) manages the SQLite database, providing a robust and typed data layer.
- **Frontend**: A custom-developed single-page application using vanilla HTML5, CSS3, and ES6+ JavaScript. No bloated frameworks were used, ensuring lightning-fast load times.
- **Data Pipeline**: A dedicated Discord synchronization script (`discord_sync.py`) uses `discord.py` to ingest ratings and metadata directly from a specified Discord channel.

## Core Functionality

### Automated Data Ingestion
The system connects to private Discord channels where media entries are logged. It parses these logs into structured data, capturing titles, release years, and ratings. This allows for a "log once, view everywhere" workflow.

### Hover-to-Reveal Ratings
To maintain a clean, cinematic grid view, numerical ratings are hidden by default. The system uses CSS transforms and opacity transitions to reveal the score only when you hover over a specific card. This reduces data density and makes the browsing experience more focused on titles and artwork.

### Cross-Tab Synchronization and Rankings
The dashboard maintains a distinction between "Completed" works and "Rankings" (leaderboards). However, these views are not isolated. 
- If an entry exists in your Rankings, a small gold ranking badge (e.g., #1) will automatically appear on its corresponding card in the Completed tab.
- When an entry is "Liked" in the Rankings tab, the state is cascaded across the entire database, ensuring your favorites are synchronized regardless of which view you are currently using.

### Review Management
Users can write and persist written reviews directly within the dashboard. The system is designed to distinguish between metadata imported from Discord and genuine personal reviews written through the web interface, ensuring your unique thoughts are prioritized.

## Development Challenges and Solutions

Building this tracker involved overcoming several technical hurdles that required creative engineering:

### Incorrect Data
During the development of the Discord parser, we encountered several instances of malformed data—such as movie years recorded as "20109" or ratings with corrupted formatting. 
**Solution**: We implemented a rigorous validation layer in the sync script. It uses regular expressions to normalize year data and enforces logical bounds (1888-2030), rejecting or flagging entries that fall outside these safe zones to prevent database corruption.

### Solving the Browser Cache Problem
Developing a single-page app with frequent CSS and JS updates presented a persistent issue where changes wouldn't appear for the end user due to aggressive browser caching.
**Solution**: We transitioned to a manual cache-busting system. By appending versioned query strings (e.g., `app.js?v=13`) to resource links in the HTML, we force the browser to immediately fetch the latest code whenever a deployment change occurs.

### Database Row Deduplication
A major challenge was managing the same media item across different database states (Regular vs. Ranking). We didn't want the "Liked" tab to show two separate cards for the same movie.
**Solution**: We engineered a custom deduplication filter in the frontend logic. It sorts all media to prioritize "Completed" entries over "Ranking" entries and then filters by title, ensuring the most detailed version of a card is always the one that is displayed.

## Installation and Setup

### 1. Requirements
Python 3.8 or higher is required.

### 2. Configuration
Create a file named `.env` in the root directory. This file is excluded from version control to protect your credentials. Populate it with the following:

```env
DISCORD_TOKEN=your_secure_discord_token
CHANNEL_MOVIE_COMPLETED=id
CHANNEL_ANIME_COMPLETED=id
CHANNEL_MANGA_COMPLETED=id
CHANNEL_TVSERIES_COMPLETED=id
CHANNEL_MOVIE_TOP=id
CHANNEL_ANIME_TOP=id
CHANNEL_MANGA_TOP=id
CHANNEL_TVSERIES_TOP=id
```

### 3. Execution on Mac
The project includes a startup script that handles virtual environment creation and server launch:
```bash
chmod +x Run_on_Mac.command
./Run_on_Mac.command
```
Open your browser to `http://127.0.0.1:8000`.

## 🛠️ Maintenance and Enrichment

### Verifying Release Years
If you have entries with missing or incorrect release years (especially those imported from Discord without dates), you can run the built-in verification utility. This script uses specialized APIs (Jikan for Anime/Manga, TVmaze for TV, and Wikipedia for Movies) to automatically find and save the correct years.

```bash
python verify_years.py
```

## 📜 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
