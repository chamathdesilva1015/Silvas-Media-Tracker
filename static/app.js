document.addEventListener('DOMContentLoaded', () => {
    // Determine Environment: Localhost vs Production (Read-Only)
    const hostname = window.location.hostname;
    const isReadOnly = (hostname !== 'localhost' && hostname !== '127.0.0.1');
    if (isReadOnly) {
        document.body.classList.add('read-only-mode');
        document.getElementById('reviewInputBox').readOnly = true;
        document.getElementById('reviewInputBox').placeholder = 'There is no review setup for this entry.';
    }

    let allMedia = [];
    let currentCategory = 'Movies'; // Default page
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

    const updateTheme = () => {
        const theme = currentCategory.toLowerCase().replace(' ', '-');
        document.body.setAttribute('data-theme', theme);
        
        // Update banner background
        pageBanner.style.background = 'var(--theme-banner)';

        // Update mesh blob positions for "movement"
        const blobs = document.querySelectorAll('.mesh-blob');
        blobs.forEach((blob, i) => {
            const x = Math.random() * 40 - 20;
            const y = Math.random() * 40 - 20;
            blob.style.transform = `translate(${x}px, ${y}px) scale(${1 + Math.random() * 0.2})`;
        });
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            currentCategory = link.getAttribute('data-filter');

            // Sync active state across BOTH sidebar and bottom nav
            navLinks.forEach(l => {
                l.classList.remove('active');
                if (l.getAttribute('data-filter') === currentCategory) {
                    l.classList.add('active');
                }
            });
            
            updateCategoryTitleCount();
            
            // Update Add Button Text
            const addBtn = document.getElementById('addMediaBtn');
            if (addBtn) {
                addBtn.innerText = `+ Add ${currentCategory}`;
            }

            updateTheme();
            filterAndRenderMedia();
            
            // Auto close on small mobile screens
            if (window.innerWidth < 800) {
                sidebar.classList.add('collapsed');
            }
        });
    });

    // Initial theme set
    updateTheme();

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

        // 1. Filter by Tab Status (Completed vs Ranking vs Liked)
        if (isLikedRequired) {
            filtered = filtered.filter(item => item.is_liked === true || item.is_liked === 1);
        } else if (isRankingRequired) {
            // Rankings Tab: ONLY show items where is_ranking is explicitly true.
            // This is the single source of truth to avoid "ghost" duplicates.
            filtered = filtered.filter(item =>
                item.is_ranking === true || item.is_ranking === 1
            );
        } else {
            // Completed Tab: Show EVERYTHING (Standard list)
            // Note: We no longer exclude rankings from the main list!
        }

        // 2. Bulletproof Identity deduplication (Gatekeeper)
        // We ensure that each Title+Type+Year combination only appears ONCE on the screen.
        // We sort by is_ranking DESC initially so that the "ranked" version of a movie wins the dedup.
        filtered.sort((a, b) => (b.is_ranking ? 1 : 0) - (a.is_ranking ? 1 : 0));

        const activeIds = new Set();
        const activeMediaKeys = new Set();
        
        filtered = filtered.filter(item => {
            // Check by database ID
            if (item.id && activeIds.has(item.id)) return false;
            
            // Check by semantic identity (Title + Type + Year)
            const identityKey = `${item.title.toLowerCase().trim()}|${item.type.toLowerCase()}|${item.release_year || 'any'}`;
            if (activeMediaKeys.has(identityKey)) return false;

            if (item.id) activeIds.add(item.id);
            activeMediaKeys.add(identityKey);
            return true;
        });

        // 3. Filter by Search Query
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
                const rankA = parseInt((a.rating || '').replace('#', ''), 10) || 999;
                const rankB = parseInt((b.rating || '').replace('#', ''), 10) || 999;
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

    const normalizeTitle = (title) => {
        if (!title) return "";
        // Match backend: remove symbols, lowercase, trim, collapse spaces
        return title.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .trim()
            .replace(/\s+/g, ' ');
    };

    const updateCategoryTitleCount = () => {
        if (!currentCategory) return;
        const items = allMedia.filter(i => i.type.toLowerCase() === currentCategory.toLowerCase());
        const uniqueTitles = new Set(items.map(i => normalizeTitle(i.title)));
        const count = uniqueTitles.size;
        
        pageTitle.innerHTML = `<span class="serif">${currentCategory}</span> <span class="header-count">Total Entries ${count}</span>`;
    };

    const grid = document.getElementById('mediaGrid');
    const loader = document.getElementById('loader');
    
    const modal = document.getElementById('mediaModal');
    const addBtn = document.getElementById('addMediaBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const form = document.getElementById('mediaForm');

    // Modal behavior
    addBtn.onclick = () => {
        // Pre-select current category and trigger logic
        const typeInput = document.getElementById('typeInput');
        typeInput.value = currentCategory;
        typeInput.dispatchEvent(new Event('change'));
        
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
        if (e.target.value === 'Movies') {
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

        let releaseYear = null;

        if (type === 'Movies') {
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
            review: '', // No review on creation per user request
            release_year: releaseYear,
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

    // --- Delete Modal Event Handlers ---
    const deleteModal = document.getElementById('deleteModal');
    const deleteTargetTitle = document.getElementById('deleteTargetTitle');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    let itemToDeleteId = null;

    const closeDeleteModal = () => {
        deleteModal.classList.remove('show');
        itemToDeleteId = null;
    };

    cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    window.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    const openDeleteModal = (id, title) => {
        itemToDeleteId = id;
        deleteTargetTitle.innerText = title;
        deleteModal.classList.add('show');
    };

    confirmDeleteBtn.addEventListener('click', async () => {
        if (!itemToDeleteId) return;

        try {
            const res = await fetch(`/api/media/${itemToDeleteId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                closeDeleteModal();
                fetchMedia();
            } else {
                alert('Failed to delete entry.');
            }
        } catch (error) {
            console.error('Error deleting media:', error);
            alert('Error deleting entry.');
        }
    });

    const deleteMedia = (id, title) => {
        openDeleteModal(id, title);
    };

    const renderSkeletons = () => {
        grid.innerHTML = '';
        grid.className = 'media-grid';
        for (let i = 0; i < 8; i++) {
            const skel = document.createElement('div');
            skel.className = 'skeleton-card';
            grid.appendChild(skel);
        }
    };

    // Fetch initial data
    const fetchMedia = async () => {
        renderSkeletons();
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
        // Explicit sort for rankings (numerical #1, #2...)
        if (isRankingRequired) {
            items.sort((a, b) => {
                const rankA = parseInt((a.rating || '').replace('#', ''), 10) || 999;
                const rankB = parseInt((b.rating || '').replace('#', ''), 10) || 999;
                return rankA - rankB;
            });
        }

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
                const row = document.createElement('div');
                row.className = 'ranking-row stagger-in';
                row.style.animationDelay = `${index * 0.05}s`;
                
                const rankNum = parseInt(item.rating.replace('#', ''), 10);
                
                // Podium Logic (1, 2, 3)
                let podiumClass = '';
                if (rankNum === 1) podiumClass = 'rank-gold';
                else if (rankNum === 2) podiumClass = 'rank-silver';
                else if (rankNum === 3) podiumClass = 'rank-bronze';

                const hasReview = isRealReview(item.review);

                row.innerHTML = `
                    <div class="rank-badge ${podiumClass}">#${rankNum}</div>
                    <div class="ranking-info">
                        <div class="ranking-header">
                            <h3 class="media-title ${hasReview ? 'clickable-review-trigger' : ''}" style="${hasReview ? 'cursor:pointer;' : ''}">${item.title} ${item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : ''}</h3>
                        </div>
                        ${hasReview ? `<span class="review-badge">Reviewed</span>` : ''}
                    </div>
                `;

                // Action group for ranking rows (Heart + Delete)
                const actions = document.createElement('div');
                actions.className = 'row-actions';

                // Wire up review modal trigger for ranking row
                if (hasReview) {
                    row.querySelector('.clickable-review-trigger').addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.openReviewModal(item.title, item.type, item.review);
                    });
                }

                const likeBtn = document.createElement('button');
                likeBtn.className = `like-btn${item.is_liked ? ' liked' : ''}`;
                likeBtn.title = item.is_liked ? 'Unlike' : 'Mark as personally liked';
                likeBtn.innerHTML = item.is_liked ? '♥' : '♡';
                likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(item.id); });
                actions.appendChild(likeBtn);

                const delBtn = document.createElement('button');
                delBtn.className = 'delete-btn';
                delBtn.innerHTML = '&times;';
                delBtn.title = 'Delete Entry';
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteMedia(item.id, item.title);
                });
                actions.appendChild(delBtn);
                
                row.appendChild(actions);
                grid.appendChild(row);

            } else {
                // Traditional Grid Block 
                const card = document.createElement('div');
                card.className = 'media-card stagger-in';
                card.style.animationDelay = `${index * 0.05}s`;
                
                const yearBadge = item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : '';
                const hasReview = isRealReview(item.review);

                const likedClass = item.is_liked ? 'liked' : '';
                const likedIcon = item.is_liked ? '♥' : '♡';

                // --- DUAL-DISPLAY PRIORITY LOGIC ---
                const ratingStr = item.rating || '';
                const numRatingStr = item.numeric_rating || '';
                
                // Identify which one is the Score (10/10) and which is the Rank (#1)
                const isRatingA_Rank = ratingStr.startsWith('#');
                const isRatingB_Rank = numRatingStr.startsWith('#');
                
                // The "Prime" rating for the card center should ALWAYS be a score if possible
                let displayRating = '';
                if (!isRatingA_Rank && ratingStr) {
                    displayRating = ratingStr;
                } else if (!isRatingB_Rank && numRatingStr) {
                    displayRating = numRatingStr;
                }

                // The Rank Badge (#1) should always show the Rank string if we have one
                const rankFromFields = isRatingA_Rank ? ratingStr : (isRatingB_Rank ? numRatingStr : '');
                
                // Final Check: Check the rankMap (from the Rankings tab) as a second source
                const rankKey = (item.title + '|' + item.type).toLowerCase();
                const globalRank = rankMap[rankKey];
                const finalRank = rankFromFields || (globalRank ? `#${globalRank}` : '');

                card.innerHTML = `
                    <div class="card-header">
                        <h3 class="media-title ${hasReview ? 'clickable-review-trigger' : ''}" data-id="${item.id}">${item.title} ${yearBadge}</h3>
                    </div>
                    <div class="media-rating-container">
                        <div class="media-rating default-rating">${displayRating}</div>
                        ${(() => {
                            const hoverCandidate = item.numeric_rating || displayRating;
                            // Only render a separate hover rating if it provides new information (e.g. score over rank)
                            if (hoverCandidate && hoverCandidate !== displayRating && !String(hoverCandidate).startsWith('#')) {
                                return `<div class="media-rating hover-rating">${hoverCandidate}</div>`;
                            }
                            return '';
                        })()}
                    </div>
                    <div class="card-badges">
                        <div class="badge-slot-left">
                            ${finalRank ? `<span class="card-rank-badge">★ ${finalRank}</span>` : ''}
                        </div>
                        <div class="badge-slot-right">
                            ${hasReview ? `<span class="review-badge">Reviewed</span>` : ''}
                        </div>
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

                // Wire up review modal trigger
                if (hasReview) {
                    card.querySelector('.clickable-review-trigger').addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.openReviewModal(item.title, item.type, item.review);
                    });
                }

                // Wire up like button click
                card.querySelector('.like-btn-inline').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleLike(item.id);
                });

                // Delete button for cards (all sources allowed)
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-btn';
                delBtn.innerHTML = '&times;';
                delBtn.title = 'Delete Entry';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteMedia(item.id, item.title);
                };
                card.appendChild(delBtn);
                // Touch-to-reveal click listener for mobile interactions
                card.addEventListener('click', () => {
                    // Only applies visual toggle if the CSS handles it
                    card.classList.toggle('revealed');
                });
                
                grid.appendChild(card);
            }
        });
    };


    // --- Global Notification System ---
    function showNotification(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    // --- Startup Sync Watcher ---
    // The server runs a Discord sync automatically on launch.
    // Monitor its status and refresh media data once it completes.
    async function watchStartupSync() {
        let syncWasRunning = false;
        let idleChecks = 0;
        const MAX_IDLE = 10; // give up after 10 × 2s = 20s with no activity

        const check = async () => {
            try {
                const res = await fetch('/api/automation/status');
                if (!res.ok) return;
                const data = await res.json();

                if (data.sync.running) {
                    syncWasRunning = true;
                    idleChecks = 0; // reset while actively syncing
                } else if (syncWasRunning) {
                    // Sync just finished — refresh data silently
                    clearInterval(poll);
                    await fetchMedia();
                    updateCategoryTitleCount();
                    if (data.sync.last_result?.status === 'success') {
                        showNotification('✓ Discord data updated', 'success');
                    }
                } else {
                    // Sync never started or already done before page loaded
                    idleChecks++;
                    if (idleChecks >= MAX_IDLE) clearInterval(poll);
                }
            } catch (_) { /* server still starting — keep trying */ }
        };

        const poll = setInterval(check, 2000);
        check(); // run immediately on load
    }

    // Initialization
    updateCategoryTitleCount();
    updateTheme();
    fetchMedia().then(() => {
        updateCategoryTitleCount();
        watchStartupSync();
    });
});
