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

### Update 8: High-Density UI and Advanced Filtering
Focus: Modernized navigation and robust statistical modeling.
- **Unified Filter System**: Persistent multi-select "Sort & Filter" dropdown.
- **Mobile Bottom-Sheet**: Optimized mobile UX with a premium, viewport-anchored bottom-sheet.
- **Passion-Volume Index**: Weighted scoring model to rank Top 10 Genres and Directors.
- **Director Indexing**: Expanded search and metadata pipelines for Director-based lookups.
- **Smart Scroll**: Implemented intelligent navigation visibility for immersive browsing.

### Update 9: Standalone Transition
Focus: Total independence from external platforms.
- **Discord Decommission**: Nuked all legacy Discord sync logic and channel-based ingestion.
- **Standalone Engine**: Shifted to a manual-first database with TMDB-direct enrichment.
- **Interface Overhaul**: Rebranded "The Hub" and optimized UI for standalone database management.

### Update 10: Admin Console & Content Integrity
Focus: Power-user tools and data validation.
- **Header Add Tool**: Integrated a global "+ Add Entry" button (Desktop & Mobile FAB).
- **Review Safety Filter**: Refined badge logic to block system placeholders and "fake" reviews.
- **Navigation Sync**: Restored desktop category nav and centralized auth controls in The Hub.
- **Stability Pass**: Fixed critical TypeError crashes and normalized UI anchor points.

---

## License
This project is licensed under the MIT License.
