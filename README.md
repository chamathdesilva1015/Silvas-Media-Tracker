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

- **Interface Simplification**: To improve the minimalist feel, media type badges were removed, allowing the high-precision genres and artwork to dominate the visual space.

### Update 1: The Precision Metadata Overhaul
This was the first major technical update to the enrichment engine, focusing on "opinionated" data accuracy and sophisticated genre classification across all media types.

- **Advanced Movie Classification**: Migrated movie enrichment to a sophisticated **Wikipedia Category Scoring Model** to parse detailed film classifications.
- **Initial Genre Enrichment**: Implemented a mandatory 2-genre constraint for movies and a "Golden List" scoring system for Anime/Manga to prioritize core themes over background settings.
- **API Resilience**: Hardened data collectors with patient back-off algorithms to handle rate-limiting from authoritative metadata sources.
- **Manual Accuracy Overrides**: Added a "Source of Truth" matching dictionary to allow for manual correction of complex titles.

### Update 2: The Infrastructure and Reliability Overhaul
This update represents a total transition from a local prototype to a production-grade, globally accessible application. We rebuilt the core engine for speed, security, and data integrity.

- **Cloud Infrastructure Migration**: We successfully migrated the data layer from local SQLite to a high-availability **Supabase (PostgreSQL)** backend. The frontend is now continuously deployed via **Vercel**, enabling instant synchronization across all devices.
- **Dynamic Genre-Free Experience**: In a bold move toward pure minimalism and speed, the entire genre tracking system was decommissioned. This stripped out over 500 lines of complex scraping code, resulting in a cleaner UI and **5x faster synchronization speeds**.
- **Security & Public Read-Only Mode**: To protect the integrity of your personal ratings while keeping the site public, we implemented an environment-aware **Authorization Shield**. The site automatically detects if it is running in production and disables all destructive actions (Add, Delete, Edit) for non-admin viewers.
- **Discord Message ID Anchoring**: The sync engine was overhauled to use unique Discord Message IDs as primary keys. This allows for seamless "Live Edits"—where updating a message in Discord immediately and accurately updates the corresponding entry on the site without creating duplicates.
- **Strict Ranking Integrity Engine**: 
    - **Position Prioritization**: We implemented a hardened logic layer that ensures your "#1" ranking slots are never overwritten by standard scores.
    - **Post-Sync Auditing**: An automated safety check now runs after every sync run to detect duplicate ranks or sequence gaps, guaranteeing that your "Top 20" lists are always logically sound.
- **Fuzzy Year Merging**: To handle human error during Discord logging, the system now features a "Fuzzy Year" safety net (±2 years). It intelligently identifies when you've logged the same movie with a typo and merges the data automatically.
- **Brand Identity & UI Polish**:
    - **Custom Vector Favicon**: Replaced the default browser icon with a bespoke, minimalist logo design (Clapperboard/Play Button hybrid) that matches the site's sleek aesthetic.
    - **Live Entry Counters**: Implemented dynamic counters in the page headers that display the verified total number of entries for each category in real-time.
- **Performance-First Design**: By removing heavy data enrichment dependencies, the sync process now focuses on high-speed title matching and metadata verification, ensuring the dashboard remains exceptionally snappy even as the library grows.



---

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
