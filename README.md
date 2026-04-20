# Silva's Media Tracker

Silva's Media Tracker is a personal project I built to help me organize and track all the movies, TV series, manga, and anime I've gone through. I wanted a way to see my collection in different ways (whether that's through a clean cinematic grid, top-tier rankings, or just seeing my favorites) all without the clutter of mainstream tracking sites.

Visit the live site here: [https://silvas-media-tracker.vercel.app/](https://silvas-media-tracker.vercel.app/)

The system pulls my ratings directly from Discord and displays them on a dark-themed dashboard that I designed to fit my own taste and keep things simple.

---

## Technical Architecture

The application is built on a modern Python stack engineered for high performance and low latency:

- **Backend**: FastAPI serves as the high-performance asynchronous core, handling API requests and database operations with non-blocking logic.
- **Database Layer**: SQLModel (an integration of Pydantic and SQLAlchemy) manages the SQLite database, providing a robust, type-safe data layer with efficient object-relational mapping.
- **Frontend Architecture**: A bespoke single-page application (SPA) developed using vanilla HTML5, CSS3, and modern JavaScript. By avoiding heavy framework dependencies, the application maintains exceptionally fast load times and a responsive feel.
- **Data Pipeline**: A dedicated synchronization module (`discord_sync.py`) utilizes the Discord API to ingest ratings, titles, and metadata from private logs, transforming unstructured messages into structured relational data.

---

## Core Features and Interaction Design

### Automated Data Ingestion
The system connects to specific Discord channels where media entries are logged in real-time. It automatically parses these entries into the database, capturing titles, release years, and personal ratings. This creates a centralized hub from a distributed logging workflow.

### Cinematic Interaction
To preserve the visual integrity of the media grid, numerical ratings are concealed by default. The dashboard utilizes CSS transitions and opacity filters to reveal scores only upon user hover. This interaction model reduces visual density and keeps the focus on cover art and titles.

### Cross-Tab Synchronization
The dashboard intelligently links "Completed" logs with "Rankings" leaderboards.
- **Badge Integration**: Items present in the Rankings tab are automatically flagged with a gold-tier badge (e.g., #1) on the main dashboard tab.
- **Global State Management**: Likes and reviews are cascaded across all media states, ensuring that personal preferences remain synchronized regardless of the current view filter.

### Independent Review Engine
The application includes a internal review editor, allowing users to persist written critiques. The system distinguishes between Discord-imported metadata and user-authored reviews, ensuring personal thoughts are always the primary source of truth.

---

## Engineering Challenges and Solutions

### Data Validation and Normalization
Early synchronization attempts faced issues with inconsistent Discord formatting and manual typing errors (e.g., release years logged as "20109").
- **Solution**: A rigorous validation layer was implemented in the ingestion pipeline. It uses regular expressions to normalize data and enforces strict logical bounds for release dates, sanitizing all input before it reaches the permanent storage layer.

### Cache-Busting Mechanisms
Frequent updates to CSS and JavaScript often resulted in browsers serving stale assets to the user.
- **Solution**: A manual versioning system was implemented. By appending unique query strings to resource links in the core HTML template, the browser is forced to bypass its local cache and fetch the most recent code whenever a version update is deployed.

### Relational Deduplication
Managing the same media item across multiple tabs (Regular vs. Ranking) presented a potential for duplicate cards.
- **Solution**: A custom deduplication filter was engineered into the frontend rendering logic. It prioritizes the most feature-complete record (typically the "Completed" entry) while preserving state data from the "Ranking" entry, resulting in a single, unified card for every unique title.

---

## Maintenance and Enrichment

### Metadata Verification Utility
For entries with missing or corrupted release dates, the system includes a specialized verification utility. This tool queries high-authority APIs (Jikan for Anime/Manga, TVmaze for TV, and Wikipedia for Movies) to fetch and persist verified release years and metadata.

```bash
python health_check.py
```

---

## Deployment and Configuration

### Prerequisites
- Python 3.8 or higher.
- API credentials for Discord.

### Environment Setup
Create a `.env` file in the project root with the following configuration:

```env
DISCORD_TOKEN=your_token
CHANNEL_MOVIE_COMPLETED=id
CHANNEL_ANIME_COMPLETED=id
CHANNEL_MANGA_COMPLETED=id
CHANNEL_TVSERIES_COMPLETED=id
CHANNEL_MOVIE_TOP=id
CHANNEL_ANIME_TOP=id
CHANNEL_MANGA_TOP=id
CHANNEL_TVSERIES_TOP=id
```

### Launch Sequence (macOS)
The repository includes a startup script to automate environment provisioning:

```bash
chmod +x Run_on_Mac.command
./Run_on_Mac.command
```

---

## Ongoing Development and Roadmap

This project is under active development. We are committed to a continuous improvement cycle, focusing on metadata accuracy and interface polish.

### Update 1: The Precision Metadata Overhaul
This is the first major technical update to the enrichment engine, focusing on "opinionated" data accuracy rather than simple ingestion.

- **Advanced Movie Classification**: We migrated the movie enrichment logic from simple text extraction to a sophisticated **Wikipedia Category Scoring Model**. The system now queries the Wikipedia `prop=categories` API to parse detailed film classifications.
- **Strict 2-Genre Requirement**: A hard constraint was implemented for the Movies category. Every film is now required to display exactly two core genres.
- **Genre Complement Logic**: For titles with limited metadata, an internal mapping system (e.g., *Animation* -> *Animation/Adventure*) ensures every card maintains a consistent and professional density.
- **Tiered Metadata Priority**: The Manga and Anime engine now utilizes a "Golden List" scoring system. This prioritizes definitive genres (Action, Romance, Drama) while deprioritizing background settings (School, Slice of Life) unless additional context is required.
- **API Resilience**: The data collectors were hardened with a patient back-off algorithm to handle HTTP 429 rate-limiting from Wikipedia and MyAnimeList, ensuring library-wide refreshes can complete without interruption.
- **Manual Accuracy Overrides**: A "Source of Truth" dictionary was added to `enrich_data.py` to allow for manual correction of complex titles (e.g., ensuring *A Silent Voice* captures its Romance/Drama identity over generic tags).
- **Interface Simplification**: To improve the minimalist feel, media type badges were removed, allowing the high-precision genres and artwork to dominate the visual space.

---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
