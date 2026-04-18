document.addEventListener('DOMContentLoaded', () => {
    let allMedia = [];
    let currentCategory = 'Movie'; // Default page
    let currentSubTab = 'Completed'; // Default subtab ('Completed' or 'Rankings')

    const searchInput = document.getElementById('searchInput');
    
    // Sidebar Toggles
    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('openSidebarBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    // Initial state check for mobile
    if (window.innerWidth < 800) {
        sidebar.classList.add('collapsed');
    }

    openSidebarBtn.onclick = () => sidebar.classList.remove('collapsed');
    closeSidebarBtn.onclick = () => sidebar.classList.add('collapsed');

    // Sidebar Tabs Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const pageTitle = document.getElementById('pageTitle');
    const pageBanner = document.getElementById('pageBanner');

    const updateBanner = () => {
        const categoryMap = {
            'Movie': 'linear-gradient(135deg, #1b2838 0%, #2a1138 100%)',
            'TV Series': 'linear-gradient(135deg, #30171a 0%, #291223 99%, #291223 100%)',
            'Manga': 'linear-gradient(135deg, #142e1f 0%, #152630 100%)',
            'Anime': 'linear-gradient(135deg, #30162a 0%, #162033 100%)',
        };
        const bg = categoryMap[currentCategory] || 'linear-gradient(135deg, #2a2723 0%, #1c1a17 100%)';
        pageBanner.style.background = bg;
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            currentCategory = link.getAttribute('data-filter');
            
            pageTitle.innerHTML = `<span class="serif">${currentCategory}</span>`;
            
            updateBanner();
            filterAndRenderMedia();
            
            // Auto close on small mobile screens
            if (window.innerWidth < 800) {
                sidebar.classList.add('collapsed');
            }
        });
    });

    // Pill Tabs Navigation
    const pillTabs = document.querySelectorAll('.pill-tab');
    pillTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            pillTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentSubTab = tab.getAttribute('data-sub');
            
            filterAndRenderMedia();
        });
    });

    searchInput.addEventListener('input', () => {
        filterAndRenderMedia();
    });

    // Custom Sort Dropdown Logic
    const sortDropdown = document.getElementById('sortDropdown');
    const sortHeader = sortDropdown.querySelector('.dropdown-header');
    const sortHeaderSpan = sortHeader.querySelector('span');
    const sortOptions = sortDropdown.querySelectorAll('.dropdown-options li');
    let currentSortValue = "";

    sortHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('open');
    });

    sortOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            sortOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            currentSortValue = option.getAttribute('data-value');
            sortHeaderSpan.innerHTML = option.innerHTML;
            sortDropdown.classList.remove('open');
            filterAndRenderMedia();
        });
    });

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!sortDropdown.contains(e.target)) {
            sortDropdown.classList.remove('open');
        }
        if (!reviewFilterDropdown.contains(e.target)) {
            reviewFilterDropdown.classList.remove('open');
        }
    });

    // Review Filter Dropdown Logic
    const reviewFilterDropdown = document.getElementById('reviewFilterDropdown');
    const reviewFilterHeader = reviewFilterDropdown.querySelector('.dropdown-header');
    const reviewFilterHeaderSpan = reviewFilterHeader.querySelector('span');
    const reviewFilterOptions = reviewFilterDropdown.querySelectorAll('.dropdown-options li');
    let currentReviewFilter = "all";

    reviewFilterHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        reviewFilterDropdown.classList.toggle('open');
    });

    reviewFilterOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            reviewFilterOptions.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            currentReviewFilter = option.getAttribute('data-value');
            reviewFilterHeaderSpan.innerHTML = `Reviews: ${option.innerHTML}`;
            reviewFilterDropdown.classList.remove('open');
            filterAndRenderMedia();
        });
    });

    const filterAndRenderMedia = () => {
        // Filter by current Category
        let filtered = allMedia.filter(item => item.type.toLowerCase() === currentCategory.toLowerCase());
        
        // Filter by Sub Tab
        const isRankingRequired = currentSubTab === 'Rankings';
        const isLikedRequired = currentSubTab === 'Liked';

        if (isLikedRequired) {
            // Liked tab: only items explicitly marked liked
            filtered = filtered.filter(item => item.is_liked === true || item.is_liked === 1);
            // Prefer Completed entries over Rankings entries (sort non-ranking first)
            filtered.sort((a, b) => (a.is_ranking ? 1 : 0) - (b.is_ranking ? 1 : 0));
            // Deduplicate by title, keeping the first (Completed) version
            const seen = new Set();
            filtered = filtered.filter(item => {
                const k = item.title.toLowerCase();
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        } else {
            filtered = filtered.filter(item => Boolean(item.is_ranking) === isRankingRequired);
        }
        
        // Filter by Search Query
        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            filtered = filtered.filter(item => item.title.toLowerCase().includes(query));
        }

        // Filter by Review Status
        if (currentReviewFilter === 'reviewed') {
            filtered = filtered.filter(item => isRealReview(item.review));
        } else if (currentReviewFilter === 'unreviewed') {
            filtered = filtered.filter(item => !isRealReview(item.review));
        }

        // Sort Rankings Numerically (always, if Rankings tab)
        if (isRankingRequired) {
            filtered.sort((a, b) => {
                const rankA = parseInt(a.rating.replace('#', ''), 10) || 999;
                const rankB = parseInt(b.rating.replace('#', ''), 10) || 999;
                return rankA - rankB;
            });
        } else {
            // Apply user-selected sort
            if (currentSortValue === 'rating-desc') {
                filtered.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
            } else if (currentSortValue === 'rating-asc') {
                filtered.sort((a, b) => parseFloat(a.rating) - parseFloat(b.rating));
            } else if (currentSortValue === 'year-desc') {
                filtered.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
            } else if (currentSortValue === 'year-asc') {
                filtered.sort((a, b) => (a.release_year || 9999) - (b.release_year || 9999));
            } else if (currentSortValue === 'title-asc') {
                filtered.sort((a, b) => a.title.localeCompare(b.title));
            } else if (currentSortValue === 'title-desc') {
                filtered.sort((a, b) => b.title.localeCompare(a.title));
            }
        }

        renderMedia(filtered, isRankingRequired, isLikedRequired);
    };

    const updateSidebarCounts = () => {
        const categories = ['Movie', 'TV Series', 'Manga', 'Anime'];
        categories.forEach(cat => {
            // Filter specific to the category
            const items = allMedia.filter(i => i.type.toLowerCase() === cat.toLowerCase());
            // Filter purely by unique titles so we don't accidentally double-count a movie existing in both Rankings and Completed arrays
            const uniqueTitles = new Set(items.map(i => i.title.toLowerCase()));

            const countId = `count-${cat.replace(' ', '')}`;
            const countSpan = document.getElementById(countId);
            if (countSpan) {
                countSpan.textContent = uniqueTitles.size;
            }
        });
    };

    const grid = document.getElementById('mediaGrid');
    const loader = document.getElementById('loader');
    
    const modal = document.getElementById('mediaModal');
    const addBtn = document.getElementById('addMediaBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('mediaForm');

    // Modal behavior
    addBtn.onclick = () => {
        modal.classList.add('show');
    };

    closeBtn.onclick = () => {
        modal.classList.remove('show');
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.classList.remove('show');
        }
    };

    // Dynamic Form toggle
    const typeInput = document.getElementById('typeInput');
    const movieFields = document.getElementById('movieFields');
    
    typeInput.addEventListener('change', (e) => {
        if (e.target.value === 'Movie') {
            movieFields.style.display = 'block';
            document.getElementById('releaseYearInput').required = true;
        } else {
            movieFields.style.display = 'none';
            document.getElementById('releaseYearInput').required = false;
        }
    });

    // Form Submittion
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.getElementById('typeInput').value;
        const ratingVal = parseFloat(document.getElementById('ratingInput').value);
        
        if (isNaN(ratingVal)) {
            alert('Please enter a valid numeric rating.');
            return;
        }

        if (ratingVal % 0.5 !== 0) {
            alert('Rating must be strictly on a 0.5 scale (e.g., 7.0, 7.5, 8.0).');
            return;
        }

        let genres = null;
        let releaseYear = null;

        if (type === 'Movie') {
            const checkedBoxes = document.querySelectorAll('#genreChecklist input[type="checkbox"]:checked');
            if (checkedBoxes.length < 1 || checkedBoxes.length > 2) {
                alert('For movies, please select exactly 1 or 2 genres.');
                return;
            }
            genres = Array.from(checkedBoxes).map(cb => cb.value).join(', ');
            releaseYear = parseInt(document.getElementById('releaseYearInput').value, 10);
            if (isNaN(releaseYear)) {
                alert('Please enter a valid release year for this movie.');
                return;
            }
        }
        
        const payload = {
            title: document.getElementById('titleInput').value,
            type: type,
            rating: ratingVal + '/10',
            review: document.getElementById('reviewInput').value,
            release_year: releaseYear,
            genres: genres,
            source: 'manual'
        };

        try {
            const res = await fetch('/api/media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                form.reset();
                modal.classList.remove('show');
                fetchMedia(); // Refresh list
            } else {
                const errData = await res.json();
                console.error("Failed to add entry", errData);
                alert(`Failed to add entry: ${errData.detail || 'Unknown error'}`);
            }
        } catch(error) {
            console.error("Error posting data:", error);
            alert("Network error: Could not reach the server to add entry.");
        }
    });

    // --- Review Modal Event Handlers ---
    const reviewModal = document.getElementById('reviewModal');
    const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');
    const saveReviewBtn = document.getElementById('saveReviewBtn');
    const clearReviewBtn = document.getElementById('clearReviewBtn');
    let currentReviewContext = null;

    const closeReviewModal = () => {
        reviewModal.classList.remove('show');
        currentReviewContext = null;
    };

    closeReviewModalBtn.addEventListener('click', closeReviewModal);

    window.addEventListener('click', (e) => {
        if (e.target === reviewModal && reviewModal.classList.contains('show')) {
            closeReviewModal();
        }
    });

    // Helper: determine if a review is a real user-written review vs a Discord placeholder
    const isRealReview = (review) => {
        if (!review) return false;
        const lower = review.toLowerCase().trim();
        if (lower.startsWith('imported from discord')) return false;
        return true;
    };

    // Globally accessible for dynamically generated onclick handlers
    window.openReviewModal = (title, type, existingReview) => {
        document.getElementById('reviewTitleDisplay').innerHTML = `Reviewing: <strong>${title}</strong>`;
        const reviewText = isRealReview(existingReview) ? existingReview : '';
        document.getElementById('reviewInputBox').value = reviewText;
        
        currentReviewContext = { title: title, type: type };
        reviewModal.classList.add('show');
    };

    const submitReview = async (reviewText) => {
        if (!currentReviewContext) return;
        
        const payload = {
            title: currentReviewContext.title,
            type: currentReviewContext.type,
            review: reviewText
        };

        try {
            const res = await fetch('/api/media/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                closeReviewModal();
                fetchMedia(); // Refresh global list to update badges horizontally!
            } else {
                alert('Failed to save review.');
            }
        } catch (error) {
            console.error('Error saving review:', error);
            alert('Error saving review.');
        }
    };

    saveReviewBtn.addEventListener('click', () => {
        submitReview(document.getElementById('reviewInputBox').value);
    });

    clearReviewBtn.addEventListener('click', () => {
        submitReview(''); // Empty string nullifies the review backend
    });

    // Deletion Logic
    const deleteMedia = async (id) => {
        console.log(`[JS DEBUG] ATTEMPTING TO DELETE ENTRY WITH ID: ${id}`);
        
        if (!id) {
            alert('Error: Media ID is missing. Cannot delete.');
            return;
        }

        if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
            return;
        }

        try {
            const url = `/api/media/delete/${id}`;
            console.log(`[JS DEBUG] CALLING DELETE URL: ${url}`);

            const res = await fetch(url, {
                method: 'POST'
            });

            if (res.ok) {
                console.log(`[JS DEBUG] SUCCESSFUL DELETION OF ID: ${id}`);
                fetchMedia(); // Refresh list and counts
            } else {
                const err = await res.json();
                console.error(`[JS DEBUG] SERVER ERROR DURING DELETION:`, err);
                alert(err.detail || 'Failed to delete entry');
            }
        } catch (error) {
            console.error("[JS DEBUG] FETCH EXCEPTION DURING DELETION:", error);
            alert('An error occurred while deleting.');
        }
    };

    // Fetch initial data
    const fetchMedia = async () => {
        try {
            const res = await fetch('/api/media');
            if (!res.ok) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">
                         <h3>Connection Error</h3>
                         <p>Could not load media. Make sure the server is fully running.</p>
                    </div>`;
                return;
            }
            allMedia = await res.json();
            loader.style.display = 'none';
            filterAndRenderMedia();
        } catch (error) {
            console.error('Error fetching media:', error);
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 40px;">
                     <h3>Offline</h3>
                     <p>Cannot reach the Personal Media Tracker API.</p>
                </div>`;
        }
    };

    // Toggle like on a media item (optimistic UI + cascade via API)
    const toggleLike = async (itemId) => {
        try {
            const res = await fetch(`/api/media/like/${itemId}`, { method: 'POST' });
            if (res.ok) {
                fetchMedia(); // refresh to reflect the new liked state everywhere
            } else {
                console.error('Failed to toggle like');
            }
        } catch (err) {
            console.error('Error toggling like:', err);
        }
    };

    const renderMedia = (items, isRankingRequired, isLikedRequired) => {
        grid.innerHTML = '';
        
        // Remove structural classes from previous renders
        grid.classList.remove('media-grid', 'ranking-list');

        if (items.length === 0) {
            const query = searchInput.value.trim();
            grid.classList.add('media-grid'); // default back to square grid limits
            if (query) {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">No results found for "<strong>${query}</strong>" in ${currentSubTab.toLowerCase()} ${currentCategory.toLowerCase()}s.</p>`;
            } else if (currentSubTab === 'Liked') {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">No liked ${currentCategory.toLowerCase()}s yet. Hover over a card and click ♡ to mark one!</p>`;
            } else {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">Completed ${currentCategory.toLowerCase()}s were not listed yet.</p>`;
            }
            return;
        }

        // Liked tab uses card grid; Rankings uses ranking-list
        if (isRankingRequired) {
            grid.classList.add('ranking-list');
        } else {
            grid.classList.add('media-grid');
        }

        // Build a lookup map: title+type -> rank number (from ranking entries)
        const rankMap = {};
        allMedia.forEach(m => {
            if (m.is_ranking) {
                const key = (m.title + '|' + m.type).toLowerCase();
                const rank = parseInt((m.rating || '').replace('#', ''), 10);
                if (!isNaN(rank)) rankMap[key] = rank;
            }
        });

        items.forEach((item, index) => {
            // Format date correctly
            const dateObj = new Date(item.date_added);
            const dateStr = dateObj.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });

            const typeClass = `type-${item.type.toLowerCase().replace(' ', '-')}`;
            const sourceBadgeClass = item.source.toLowerCase() === 'discord' ? 'source-badge source-discord' : 'source-badge';
            const sourceIcon = item.source.toLowerCase() === 'discord' ? '🎮' : '✍️'; 

            if (isRankingRequired) {
                // Procedural Leaderboard Row Injection
                const row = document.createElement('div');
                row.className = 'ranking-row';
                
                const rankNum = parseInt(item.rating.replace('#', ''), 10);
                
                // Podium Logic (1, 2, 3)
                let podiumClass = '';
                if (rankNum === 1) podiumClass = 'rank-gold';
                else if (rankNum === 2) podiumClass = 'rank-silver';
                else if (rankNum === 3) podiumClass = 'rank-bronze';

                const hasReview = isRealReview(item.review);
                const safeTitle = (item.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const safeReview = isRealReview(item.review) ? (item.review || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';

                row.innerHTML = `
                    <div class="rank-badge ${podiumClass}">#${rankNum}</div>
                    <div class="ranking-info">
                        <div class="ranking-header">
                            <h3 class="media-title" style="cursor:pointer;" onclick="window.openReviewModal('${safeTitle}', '${item.type}', '${safeReview}')">${item.title} ${item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : ''}</h3>
                            <span class="media-type ${typeClass}">${item.type}</span>
                        </div>
                        ${hasReview ? `<div class="review-badge">✍️ Reviewed</div>` : ''}
                    </div>
                `;

                // Heart button for ranking rows
                const likeBtn = document.createElement('button');
                likeBtn.className = `like-btn${item.is_liked ? ' liked' : ''}`;
                likeBtn.title = item.is_liked ? 'Unlike' : 'Mark as personally liked';
                likeBtn.innerHTML = item.is_liked ? '♥' : '♡';
                likeBtn.onclick = (e) => { e.stopPropagation(); toggleLike(item.id); };
                row.appendChild(likeBtn);

                if (item.source === 'manual') {
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-btn';
                    delBtn.innerHTML = '&times;';
                    delBtn.title = 'Delete Entry';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteMedia(item.id);
                    };
                    row.appendChild(delBtn);
                }

                grid.appendChild(row);

            } else {
                // Traditional Grid Block 
                const card = document.createElement('div');
                card.className = 'media-card';
                
                const yearBadge = item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : '';
                const genreText = item.genres ? `<div style="font-size: 0.85rem; color: var(--accent-cyan); margin-bottom: 0.8rem; font-weight: 600;">${item.genres}</div>` : '';
                const hasReview = isRealReview(item.review);
                const safeTitle = (item.title || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                const safeReview = isRealReview(item.review) ? (item.review || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'") : '';

                const likedClass = item.is_liked ? 'liked' : '';
                const likedIcon = item.is_liked ? '♥' : '♡';

                // Check if this title has a ranking position
                const rankKey = (item.title + '|' + item.type).toLowerCase();
                const rankPosition = rankMap[rankKey];
                const rankBadgeHTML = rankPosition ? `<div class="card-rank-badge">#${rankPosition}</div>` : '';

                card.innerHTML = `
                    <div class="card-header">
                        <h3 class="media-title" onclick="window.openReviewModal('${safeTitle}', '${item.type}', '${safeReview}')">${item.title} ${yearBadge}</h3>
                        <span class="media-type ${typeClass}">${item.type}</span>
                    </div>
                    ${genreText}
                    <div class="media-rating">${item.rating}</div>
                    <div class="card-badges">
                        ${hasReview ? `<div class="review-badge">✍️ Reviewed</div>` : ''}
                        ${rankBadgeHTML}
                    </div>
                    <div class="card-spacer"></div>
                    <div class="media-footer">
                        <div class="date-added">${dateStr}</div>
                        <div class="${sourceBadgeClass}">
                            <span>${sourceIcon}</span> ${item.source}
                        </div>
                        <button class="like-btn-inline ${likedClass}" title="${item.is_liked ? 'Unlike' : 'Like'}">${likedIcon}</button>
                    </div>
                `;

                // Wire up like button click
                card.querySelector('.like-btn-inline').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleLike(item.id);
                });

                if (item.source === 'manual') {
                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-btn';
                    delBtn.innerHTML = '&times;';
                    delBtn.title = 'Delete Entry';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteMedia(item.id);
                    };
                    card.appendChild(delBtn);
                }
                
                grid.appendChild(card);
            }
        });
    };

    // Initialization
    pageTitle.innerHTML = `<span class="serif">${currentCategory}</span>`;
    updateBanner();
    fetchMedia().then(() => {
        updateSidebarCounts();
    });
});
