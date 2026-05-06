# Silva's Media Tracker

A professional, standalone dashboard for organizing and tracking movies, TV series, manga, and anime. This project provides a centralized, high-density view of media collections with automated metadata enrichment and personal ranking management.

Visit the live site: [https://silvas-media-tracker.vercel.app/](https://silvas-media-tracker.vercel.app/)

---

## Technical Architecture

The application is engineered with a modern, high-density stack optimized for performance and visual excellence:

- **Backend**: Python-based FastAPI architecture managing asynchronous RESTful API endpoints and background data orchestration.
- **Database Layer**: High-availability Supabase (PostgreSQL) instance managed via SQLModel for robust data persistence and strict schema integrity.
- **UI/UX System**: A custom "Glassmorphism" design engine built with vanilla CSS3, utilizing deep backdrop blurs, dynamic theme-switching variables, and an intensive themed radiance system.
- **Frontend Core**: A high-performance Single-Page Application (SPA) utilizing vanilla JavaScript and an event-driven architecture for sub-second interactions and real-time state management.
- **Enrichment Pipeline**: An automated metadata engine integrating with the TMDB API and Jikan API to fetch high-resolution cover art, directorial credits, and production data.
- **Statistical Modeling**: Custom JavaScript algorithms for weighted passion indexing, genre-specific rating distributions, and trend analysis.


---

## Core Features

### Premium Visual Architecture
A state-of-the-art "Glassmorphism" interface engineered for visual excellence and high-density information display. 
- **Themed Radiance**: Deep, category-aware glows that dynamically adapt to the media type (Blue for Movies, Red for TV, Green for Manga, Gold for Anime).
- **Parallax Gallery**: High-fidelity media cards featuring blurred poster backgrounds, 3D parallax hover effects, and "hover-to-front" priority logic.
- **High-Contrast Clarity**: Precision-engineered typography with black outlines and multi-layered shadows for 100% legibility across all backgrounds.

### Intelligent Discovery Engine
A sophisticated recommendation system that leverages your personal taste profile for tailored discovery.
- **Risk-Adjusted Suggestions**: Four distinct levels of discovery (Low to Extreme) with visual risk bars to tune the balance between "Safe" hits and "Wildcard" finds.
- **Statistical Passion Indexing**: A weighted algorithm that identifies your true top directors and genres by balancing rating intensity against consumption volume.

### Real-Time Metadata Enrichment
An automated ingestion pipeline that transforms basic titles into high-fidelity media profiles instantly.
- **Multi-Source Sync**: Deep integration with TMDB and Jikan APIs to fetch official posters, directorial credits, and precise production data.
- **Interactive Metadata Pills**: Metadata is presented in interactive, themed pills that emit a vivid radiance on hover, matching the media's category color.


---

## Advanced Analytics & Insights

The application utilizes a comprehensive statistical engine to visualize media consumption habits and identify deep taste trends:

- **Taste Heatmaps**: Dynamic visualizations of score distributions across genres, release decades, and media types.
- **Hall of Fame**: Automated tracking of elite entries (9+ ratings) with exclusive visual distinctions and ranking ribbons.
- **Director Indexing**: Statistical tracking of your most-watched creators, providing deep insights into directorial preferences.
- **Passion-Volume Indexing**: A weighted algorithm that identifies true favorites by balancing rating intensity against total consumption volume.

---

## Engineering Solutions

### Thematic Radiance Engine
Developed a dynamic CSS variable system that injects category-specific HSL values into the global DOM. This allows the entire interface to "pulse" with the theme of the active media (e.g., Deep Blue for Movies, Vibrant Red for TV), maintaining a cohesive visual identity across all modules.

### High-Density Stacking Contexts
Solved complex `z-index` and `backdrop-filter` conflicts to enable high-end hover interactions. Gallery cards utilize "hover-to-front" priority logic, allowing them to overlap the sticky header and neighboring elements while maintaining crystal-clear blur effects.

### Asynchronous Enrichment Pipeline
Engineered a robust metadata ingestion layer that orchestrates concurrent API requests to TMDB and Jikan. The system includes failure-safe fallbacks, manual ID anchoring for ambiguous titles, and sub-second data normalization.

### Risk-Tuned Discovery Logic
Developed a 4-tier recommendation algorithm that allows users to tune discovery "wildcards." The solution translates mathematical risk thresholds into user-friendly "Risk Levels" (Low to Extreme), visualized through a dynamic progress bar system.

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
- **Genre Badging- **v219**: Metadata Repair & Title Sync. Added "Sync with Official" and "Manual Link ID" tools to fix mismatches and standardize titles to their "Real World" official names.
- **v218**: Dynamic Color Themes. Movies (Blue/Purple), TV (Red/Orange), Manga (Green/Yellow), Anime (Yellow/Green).
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

- **Discord Decommissioning**: Removed all legacy synchronization logic and channel-based ingestion.
- **Standalone Architecture**: Transitioned the core engine to direct manual entry and TMDB enrichment.
- **Desktop Navigation**: Restored category navigation for desktop while maintaining mobile bottom nav.
- **Auth Consolidation**: Centralized developer login within "The Hub" for a unified experience.
- **Review Integrity**: Implemented a "Real Review" safety check to filter out system placeholders.
- **Add Entry Refinement**: Integrated a compact "+" entry button for instant access on all devices.

### Update 10: Extreme Mobile UI Refinement
Focus: High-density compaction and native-feeling mobile aesthetics.

- **Extreme UI Compaction**: Compressed metrics and distribution graphs by 50% to maximize vertical density.
- **Micro-Grid Architecture**: Optimized 3-column mobile grid with micro-typography to eliminate grayspace.
- **Quick-Info Modal**: Redesigned with a floating close button, header clearance, and integrated scrolling.
- **Responsive Navigation**: Engineered a unified search/filter row for mobile headers to reclaim viewport space.
- **Premium Footer Design**: Replaced bulky highlights with sleek underline indicators and enhanced blur.
- **Mobile-Exclusive Logic**: Implemented text-swap mechanisms to replace verbose text with concise formulas.

### Update 11: Premium Glassmorphism & High-Pop Aesthetics
Focus: Visual excellence, deep glassmorphism, and interactive micro-animations.

- **Glassmorphism Overhaul**: Implemented a deep-blur (40px) design with translucent backgrounds.
- **Dynamic Card Backgrounds**: Engineered blurred poster backgrounds for cards and profiles.
- **High-Pop Typography**: Added black outlines and shadows to all white text for 100% legibility.
- **Metadata Pills**: Replaced flat metadata with interactive, glowing pills themed to each category.
- **Advanced Glow Engine**: Developed an intense themed radiance for modals and hover states.
- **Parallax Gallery**: Implemented scale and blur animations with "hover-to-front" priority logic.
- **Mobile Hub Redesign**: Reorganized navigation into high-visibility themed tiles and a 2x2 grid.
- **Risk Level Visuals**: Renamed suggestion modes and added dynamic risk progress bars.

---

## License
This project is licensed under the MIT License.

