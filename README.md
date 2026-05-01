# Silva's Media Tracker

A personal dashboard for organizing and tracking movies, TV series, manga, and anime. This project provides a centralized view of media collections without the overhead of mainstream tracking platforms.

Visit the live site: [https://silvas-media-tracker.vercel.app/](https://silvas-media-tracker.vercel.app/)

Ratings are synchronized directly from Discord channels and displayed on a dark-themed, minimalist interface.

---

## Technical Architecture

The application utilizes a Python-based backend and a vanilla frontend stack:

- **Backend**: FastAPI manages asynchronous API requests and database operations.
- **Database Layer**: SQLModel handles data persistence and object-relational mapping.
- **Frontend**: Single-page application (SPA) built with HTML5, CSS3, and JavaScript, prioritizing fast load times.
- **Data Pipeline**: A synchronization module (`discord_sync.py`) utilizes the Discord API to ingest and structure media data from message logs.

---

## Core Features

### Automated Data Ingestion
The system monitors specific Discord channels to capture media entries. Regular expressions parse message content to extract titles, release years, and numeric ratings into the database.

### Interface Design
The dashboard prioritizes visual density and high information throughput. Cover art is front-and-center, with metadata (Director, Year, Genres) accessible at a glance. Visual clutter, such as secondary ratings and interaction buttons, is intelligently hidden for viewers but remains accessible for administrators.

### Multi-Tab Synchronization
The dashboard links standard "Completed" logs with "Rankings" leaderboards.
- **Visual Badges**: Items found in the Rankings tab display a rank badge (e.g., #1) on the main list.
- **State Persistence**: Likes and reviews stay synchronized across all categories and filter views.

### Internal Review System
A built-in review editor allow for the persistence of written critiques. The system prioritizes user-authored reviews over automated import metadata.

---

## Engineering Solutions

### Data Normalization
The ingestion pipeline includes a validation layer to handle inconsistent Discord formatting and manual entry errors. Regular expressions normalize titles and enforce logical bounds for release dates.

### Asset Versioning
A manual cache-busting system ensures browsers load the latest CSS and JavaScript assets. Unique query strings are appended to resource links, forcing the browser to fetch the most recent code upon deployment.

### Item Deduplication
Custom filtering logic ensures that each unique Title+Type+Year combination appears only once. The system prioritizes the most complete record while preserving state data from ranking entries.

---

## Deployment and Configuration

### Environment Setup
A `.env` file is required in the project root with the following configuration:

```env
DISCORD_TOKEN=your_token
DATABASE_URL=your_supabase_url
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
A startup script automates the environment provisioning and server launch:

```bash
chmod +x Run_on_Mac.command
./Run_on_Mac.command
```

---

## Development Roadmap

### Update 1: Metadata and Genre Logic
Focus: Data accuracy and structured media classification.

- **Wikipedia Scoring**: Developed a scoring model to parse film classifications from Wikipedia.
- **Genre Constraints**: Enforced a two-genre display limit for consistent card alignment.
- **Priority Mapping**: Implemented logic to prioritize core genres over background themes.
- **Rate-Limit Handling**: Added back-off algorithms for Wikipedia and MyAnimeList APIs.
- **Manual Overrides**: Created a matching dictionary to correct ambiguous Discord titles.
- **Data Validation**: Automated sanitation of year formats and title strings during ingestion.

### Update 2: Cloud Migration and Reliability
Focus: Infrastructure stability and ranking integrity.

- **Supabase Migration**: Transitioned the data layer to a high-availability PostgreSQL backend.
- **Streamlined Sync**: Optimized synchronization by transitioning away from legacy scraping.
- **Production Safety**: Added a read-only protection layer for guest deployments.
- **ID Anchoring**: Utilized Discord Message IDs as primary keys for reliable record syncing.
- **Ranking Audits**: Implemented automated post-sync audits to detect sequence gaps.
- **Deduplication**: Added fuzzy-year matching (±2 years) to merge duplicate entries.

### Update 3: UX Modernization and Aesthetics
Focus: Visual performance and interface refinement.

- **Glassmorphism Design**: Implemented a design system using mesh gradients and frosted glass.
- **Skeleton States**: Added animated loading placeholders for improved perceived performance.
- **Event Delegation**: Refactored the review system to resolve encoding and interaction issues.
- **Typography Upgrade**: Standardized Plus Jakarta Sans and Playfair Display across the UI.
- **Leaderboard Fixes**: Resolved memory conflicts to ensure ranking persistence after resets.
- **Identity Matching**: Refined logic to prioritize original media over legacy versions.

### Update 4: Responsive Architecture
Focus: Data density and native-feeling mobile interactions.

- **Dense Mobile Grid**: Engineered a 3-column mobile architecture for maximum data visibility.
- **Widescreen Scaling**: Expanded desktop grid to 5 columns on ultra-wide monitors.
- **Touch Interactions**: Implemented full-card tap logic to trigger mobile ratings.
- **Contextual Modals**: Optimized review viewing heights for improved long-form readability.
- **Pointer Locking**: Disabled interactions for unreviewed items to prevent empty states.
- **Adaptive Badges**: Engineered badge scaling logic to match device-specific grid sizes.

### Update 5: Documentation and Generalization
Focus: Codebase maintenance and universal logic.

- **Category Agnostic**: Refactored the core engine to natively support Anime, Manga, and TV.
- **Information Hub**: Unified all meta-documentation into a centralized dashboard registry.
- **Bias Documentation**: Formalized documentation for Recency, Legacy, and Scale biases.
- **Criteria Refinement**: Standardized grading definitions for Writing, Visuals, and Craft.
- **Legacy Purge**: Deleted 200+ lines of deprecated logic and obsolete synchronization scripts.
- **Auditor Hardening**: Updated health checks to strictly validate new schema integrity.

### Update 6: Metadata Enrichment and Visual Density
Focus: Automated data lookup and high-fidelity media presentation.

- **TMDB Integration**: Built a background pipeline to fetch official posters and genre metadata.
- **Quick-Info Modal**: Implemented a comprehensive media popup with posters and metadata cards.
- **Genre Badging**: Added dynamic, color-coded genre badges to all media entries.
- **Letterboxd Bridge**: Built a CSV migration engine to standardize legacy 5-star movie data.
- **Unified Ratings**: Normalized disparate rating sources into a high-precision 10-point scale.
- **Sanitized Metadata**: Implemented title normalization to resolve ambiguous Discord logs.

### Update 7: Dynamic Analytics and Taste Modeling
Focus: Predictive metrics and interactive dashboard logic.

- **Run Stats Simulation**: Added a processing delay with contextual messages for an interactive feel.
- **Personal Taste Profile**: Developed an algorithm to identify Top 5 genres based on 8+ ratings.
- **Interactive Accordions**: Converted stats lists into collapsible accordions for space management.
- **Hero Row Optimization**: Reorganized the stats dashboard to elevate core metrics.
- **Pattern Strictness**: Fine-tuned taste detection to prioritize 8/10+ scores for interest modeling.
- **Historical Analysis**: Developed initial ranking models for high-value entries (9+ ratings).

### Update 8: High-Density UI and Advanced Filtering
Focus: Modernized navigation and robust statistical modeling.

- **Unified Filter System**: Replaced legacy tabs with a persistent multi-select "Sort & Filter" dropdown.
- **Mobile Bottom-Sheet**: Optimized mobile UX with a premium, viewport-anchored bottom-sheet.
- **Passion-Volume Index**: Developed a weighted scoring model to rank Top 10 Genres and Directors.
- **Director Indexing**: Expanded search and metadata pipelines to support Director-based lookups.
- **Visual Density**: Removed hover ratings and reduced card heights to maximize data visibility.
- **Discovery Shuffling**: Implemented randomized default sorting to encourage media discovery.
- **The Hub**: Rebranded the console and streamlined the interface by removing redundant displays.
- **Viewer Role Logic**: Implemented read-only states and restricted interactions for guest users.

---

## License
This project is licensed under the MIT License.
