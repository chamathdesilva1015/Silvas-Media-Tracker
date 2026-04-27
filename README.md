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
Numerical ratings are hidden by default to maintain a clean visual grid. Scores are revealed via hover effects to keep the focus on cover art and titles.

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

### Update 1: Metadata and Genre Optimization
Focus focused on data accuracy and structured classification for all media types.

- **Wikipedia Category Scoring**: Implemented a scoring model to parse detailed film classifications from the Wikipedia API.
- **Genre Constraints**: Established a mandatory two-genre display for movie entries to ensure visual consistency.
- **High-Priority Mapping**: Logic was added to prioritize core themes (Action, Drama, Romance) while deprioritizing background settings.
- **Rate-Limit Handling**: Added back-off algorithms to manage API request frequency for Wikipedia and MyAnimeList.
- **Manual Overrides**: Created a matching dictionary to allow for the manual correction of complex titles.

### Update 2: Cloud Migration and Reliability
Focus shifted to infrastructure stability, security, and ranking integrity.

- **Supabase Migration**: Transitioned the data layer to a high-availability PostgreSQL backend on Supabase.
- **Streamlined Sync**: Removed the genre scraping system to improve synchronization speeds and simplify the interface.
- **Public Read-Only Mode**: Added an environment-aware protection layer that disables editing features when deployed to production.
- **Message ID Anchoring**: Updated the sync engine to use unique Discord Message IDs as primary keys, enabling reliable message updates.
- **Ranking Safety Engine**: Implemented strict rank prioritization logic and automated post-sync audits to detect sequence gaps.
- **Typo Protection**: Added a fuzzy-year matching system (±2 years) to merge duplicate entries caused by manual typing errors.

### Update 3: UX Modernization and Dynamic Aesthetics
Focus focused on visual excellence, performance perception, and functional reliability.

- **Style System Overhaul**: Implemented a comprehensive high-end design pattern including category-themed mesh gradients and frosted glass components (Glassmorphism).
- **Skeleton Loading State**: Replaced standard loading indicators with animated "skeleton" placeholders to improve navigation speed perception.
- **Micro-Interactions**: Added staggered entry animations and themed soft-glow shadows to enhance the physical feedback of interface elements.
- **Robust Event Handling**: Refactored the core review system to use centralized event delegation, resolving a critical bug caused by complex character sets in user critiques.
- **Premium Typography**: Upgraded the font system to a curated pairing of Plus Jakarta Sans for UI legibility and Playfair Display for elegant serif headers.
- **Ranking Integrity Fix**: Resolved a memory-snapshot conflict in the sync module, ensuring that leaderboard positions are always correctly force-written to the database after resets.
- **Deduplication Refinement**: Improved item identity matching to ensure the correct original media versions are prioritized over legacy or unintentional live-action entries.

### Update 4: Responsive Architecture and Touch-Forward Mobility
Focus shifted to maximizing data density across varying viewport dimensions and engineering native-feeling touch logic.

- **Mobile First Compact Grid**: Redesigned the entire mobile constraints into a hyper-dense, 3-column architecture, aggressively trimming non-essential metadata and stretching edge margins to maximize screen real estate.
- **Widescreen Data Density**: Engineered the desktop grid logic to systematically expand from standard layouts into a precise 5-column landscape on large monitors, re-balancing internal card paddings to maintain elegance.
- **Organic Touch Interactions**: Scrapped dedicated interaction buttons on mobile devices in favor of full-card tap logic; tapping an entry organically highlights the bounds in a blue ambient glow while gracefully pulling the rating score to the forefront.
- **Contextual Sheet Engineering**: Reverted awkward bottom-sheet overlays back to centrally anchored modals with optimized viewing heights, ensuring long-form movie critiques remain highly readable without complex scrolling.
- **Conditional Click Execution**: Refactored the JavaScript event loop to conditionally bind modal triggers; unreviewed media is now fully locked against pointer interactions, preventing empty data states.
- **Responsive Dynamic Scaling**: Rebuilt badge sizing logic per-device threshold; ranked leaderboard badges intelligently upscale to match spacious PC cards, whilst shrinking down smoothly to preserve layout integrity on phones.

### Update 5: Evaluative Philosophy and Information Hub Finalization
Focus shifted to documentation transparency, terminology generalization, and massive codebase maintenance.

- **Category-Agnostic Refactoring**: Stripped media-specific terminology ("movie/film") across the entire engine and UI, replacing it with universal logic ("work/entry") to natively support Anime, Manga, and TV Series within the same documentation framework.
- **Information Hub Consolidation**: Centralized all meta-content into a refined "Info" dashboard, unifying the Rating Scale, Criteria Breakdown, Ranking Rules, and Bias documentation into a single interactive registry.
- **Bias & Effects Narrative**: Overhauled the personal bias documentation into five core pillars: *Preference, Expectation, Recency, Legacy,* and *Scale*. Each section was rewritten into a grounded "Bias -> Result -> Understanding" framework.
- **Grading Criteria Professionalism**: Rewrote the criteria breakdown (Writing, Acting, Visual Craft, etc.) from robotic definitions into meaningful, human-centric paragraphs that articulate specific evaluative standards.
- **Review Integrity & Playbook**: Completely rewrote the 1-10 rating scale into a behavior-based system (e.g., rewatch frequency, emotional recall, execution vs. intent), transforming the scale from abstract numbers into a grounded, consistent guide for all personal critiques.
- **Legacy Logic Purge**: Executed a systemic cleanup of the repository, deleting seven obsolete scripts and stripping over 200 lines of deprecated genre-mapping logic from the automated enrichment engine.
- **Health Auditor Hardening**: Updated the custom `health_check.py` auditor to support the new schema, strictly validating release years and ranking integrity whilst preventing crashes caused by missing legacy columns.
- **Mobile Navigation Integration**: Synchronized the "Info" hub into the mobile bottom navigation bar, ensuring documentation accessibility is maintained across all device types.
- **Ranking Fluidity Rules**: Crystalized the "Ranking Rules" logic, formally documenting the relationship between an entry's position and its stability within the Top 20 leaderboards.

---

## License
This project is licensed under the MIT License.
