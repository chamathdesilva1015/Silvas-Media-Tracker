# Silva's Media Tracker

A professional, standalone dashboard for organizing and tracking movies, TV series, manga, and anime. This project provides a centralized, high-density view of media collections with automated metadata enrichment and personal ranking management.

Visit the live site: [https://silvas-media-tracker.vercel.app/](https://silvas-media-tracker.vercel.app/)

---

## Technical Architecture

The application utilizes a high-performance Python backend and a refined vanilla frontend stack:

- **Backend**: FastAPI manages asynchronous API requests and database operations.
- **Database Layer**: SQLModel (SQLAlchemy + Pydantic) handles data persistence and object-relational mapping.
- **Frontend**: Single-page application (SPA) engineered with HTML5, CSS3, and JavaScript, prioritizing visual density and sub-second load times.
- **Metadata Engine**: An automated enrichment module (`enrich_data.py`) integrates with the TMDB API to fetch official posters, genres, directors, and runtimes.

---

## Core Features

### High-Density Media Dashboard
The interface is designed for power users who want to see their entire collection at a glance. It utilizes a content-driven grid that automatically adapts to the available screen space, providing maximum information throughput without visual clutter.

### Automated Metadata Enrichment
Manual entry is supplemented by a "Magic Auto-Fill" system. By simply entering a title, the system queries official databases to retrieve high-quality cover art, directorial credits, and precise genre classifications.

### Personal Ranking System
A specialized "Rankings" view allows for the creation of curated leaderboards.
- **Visual Badges**: Top-ranked items display exclusive rank ribbons (e.g., #1) throughout the application.
- **State Synchronization**: Reviews, likes, and metadata stay perfectly synchronized between the global logs and your personal leaderboards.

### Advanced Analytics & Insights
The application builds a profile of your media taste based on your ratings.
- **Taste Profile**: Automatically identifies your top genres and directors based on statistical weighting.
- **Metric Breakdown**: Visualizes score distributions and release decade trends.

---

## Engineering Solutions

### Smart Visibility & Navigation
Implemented a "Smart Scroll" behavior where the header and navigation elements intelligently hide during active scrolling to maximize the viewing area, reappearing instantly when needed.

### Asset Versioning
A manual cache-busting system ensures browsers load the latest CSS and JavaScript assets. Unique query strings are appended to resource links, forcing the browser to fetch the most recent code upon deployment.

### Data Normalization
The ingestion pipeline includes a validation layer to normalize titles and enforce logical bounds for release dates and ratings, ensuring a clean and consistent database.

---

## Deployment and Configuration

### Environment Setup
A `.env` file is required in the project root with the following configuration:

```env
DATABASE_URL=your_supabase_url
TMDB_API_KEY=your_tmdb_api_key
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
- **Genre Constraints**: Enforced a two-genre display limit for consistent visual card alignment.
- **Priority Mapping**: Implemented logic to prioritize core genres over background themes.
- **Rate-Limit Handling**: Added back-off algorithms for Wikipedia and MyAnimeList APIs.
- **Manual Overrides**: Created a matching dictionary to correct complex or ambiguous titles.
- **Data Validation**: Automated sanitation of year formats and title strings during ingestion.

### Update 2: Cloud Migration and Reliability
Focus: Infrastructure stability and ranking integrity.
- **Supabase Migration**: Transitioned the data layer to a high-availability PostgreSQL backend.
- **Streamlined Sync**: Optimized synchronization by transitioning away from legacy scraping.
- **Production Safety**: Added a read-only protection layer for public guest deployments.
- **ID Anchoring**: Utilized Discord Message IDs as primary keys for reliable record syncing.
- **Ranking Audits**: Implemented automated post-sync audits to detect sequence gaps.
- **Deduplication**: Added fuzzy-year matching (±2 years) to merge duplicate entries.

### Update 3: UX Modernization and Aesthetics
Focus: Visual performance and interface refinement.
- **Glassmorphism Design**: Implemented a design system using mesh gradients and frosted glass.
- **Skeleton States**: Added animated loading placeholders for improved perceived performance.
- **Event Delegation**: Refactored the review system to resolve character-set encoding and interaction issues.
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
- **TMDB Integration**: Built a background enrichment pipeline to fetch official posters and metadata via API.
- **Quick-Info Modal**: Implemented a comprehensive media popup with posters and metadata cards.
- **Genre Badging**: Added dynamic, color-coded genre badges to all media entries.
- **Letterboxd Bridge**: Built a CSV migration engine to import and standardize legacy 5-star movie data.
- **Unified Ratings**: Normalized disparate rating sources into a single, high-precision 10-point scale.
- **Sanitized Metadata**: Implemented year-parsing and title normalization to resolve ambiguous Discord logs.

### Update 7: Dynamic Analytics and Taste Modeling
Focus: Predictive metrics and interactive dashboard logic.
- **Run Stats Simulation**: Added analytical processing delays with contextual loading for an interactive feel.
- **Personal Taste Profile**: Developed an algorithm to identify Top 5 genres based on 8+ ratings.
- **Interactive Accordions**: Converted stats lists into collapsible accordions for space management.
- **Hero Row Optimization**: Reorganized the stats dashboard to elevate core metrics.
- **Hall of Fame**: Developed initial ranking models for high-value entries (9+ ratings).

### Update 8: High-Density UI and Advanced Filtering
Focus: Modernized navigation and robust statistical modeling.
- **Unified Filter System**: Replaced legacy tabs with a persistent multi-select "Sort & Filter" dropdown.
- **Mobile Bottom-Sheet**: Optimized mobile UX with a premium, viewport-anchored bottom-sheet.
- **Passion-Volume Index**: Developed a weighted scoring model to rank Top 10 Genres and Directors.
- **Director Indexing**: Expanded search and metadata pipelines to support Director-based lookups.
- **Visual Density**: Removed hover ratings and reduced card heights to maximize data visibility.
- **Discovery Shuffling**: Implemented randomized default sorting to encourage media discovery.

### Update 9: Standalone Evolution
Focus: Decoupling from external platforms for true independence.

Discord Decommissioning: Removed all legacy synchronization logic and channel-based ingestion.
Standalone Architecture: Transitioned the core engine to direct manual entry and TMDB enrichment.
Desktop Navigation: Restored category navigation for desktop while maintaining mobile bottom nav.
Auth Consolidation: Centralized developer login within "The Hub" for a unified experience.
Review Integrity: Implemented a "Real Review" safety check to filter out system placeholders.
Add Entry Refinement: Integrated a compact "+" entry button for instant access on all devices.

### Update 10: Extreme Mobile UI Refinement
Focus: High-density compaction and native-feeling mobile aesthetics.

Extreme UI Compaction: Compressed metrics and distribution graphs by 50% to maximize vertical density.
Micro-Grid Architecture: Optimized 3-column mobile grid with micro-typography to eliminate grayspace.
Quick-Info Modal: Redesigned with a floating close button, header clearance, and integrated scrolling.
Responsive Navigation: Engineered a unified search/filter row for mobile headers to reclaim viewport space.
Premium Footer Design: Replaced bulky highlights with sleek underline indicators and enhanced blur.
Mobile-Exclusive Logic: Implemented text-swap mechanisms to replace verbose text with concise formulas.


Update 11: TV Series Enrichment Support
Focus: Expanding automated metadata lookups to television content.

TV Pipeline Integration: Engineered a multi-type enrichment engine supporting both Movies and TV Series.
Intelligent TMDB Routing: Implemented type-aware API logic to prevent data collisions between movies and shows.
Creator Mapping: Automatically identifies and maps TV Show Creators to the existing metadata schema.
Average Runtime Logic: Developed statistical averaging for TV episode runtimes for consistent data density.
TV Certification Support: Added logic to fetch and standardize TV-specific content ratings (e.g., TV-MA).

---

## License
This project is licensed under the MIT License.
