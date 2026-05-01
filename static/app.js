document.addEventListener('DOMContentLoaded', () => {
    // Determine Environment: Localhost vs Production (Read-Only)
    const hostname = window.location.hostname;
    const isReadOnly = (hostname !== 'localhost' && hostname !== '127.0.0.1');

    // Admin Auth Hook (In-Memory Only, Wipes on Refresh)
    const tempKey = localStorage.getItem('admin_key_temp');
    if (tempKey === "Dn1h7M55!") {
        window.runtimeAdminKey = tempKey;
        localStorage.removeItem('admin_key_temp'); // Burn after reading so next refresh is guest
    } else {
        window.runtimeAdminKey = null;
    }
    
    let isAdminUnlocked = (window.runtimeAdminKey !== null);

    // Helper to evaluate auth bounds
    const computeCanEdit = () => !isReadOnly || isAdminUnlocked;

    const getAuthHeaders = (isJson = true) => {
        const headers = {};
        if (isJson) headers['Content-Type'] = 'application/json';
        if (isAdminUnlocked && window.runtimeAdminKey) headers['X-Admin-Key'] = window.runtimeAdminKey;
        return headers;
    };

    const loginAdminBtns = [document.getElementById('loginAdminBtn'), document.getElementById('mobileLoginBtn')];
    const logoutAdminBtns = [document.getElementById('logoutAdminBtn'), document.getElementById('mobileLogoutBtn')];

    // Make updateAuthUI safely globally accessible so it can run before and after media loads
    window.updateAuthUI = () => {
        const canEdit = computeCanEdit();
        if (canEdit) {
            document.body.classList.remove('read-only-mode');
            document.getElementById('reviewInputBox').readOnly = false;
            document.getElementById('reviewInputBox').placeholder = 'Type your review here...';
            
            if (!isReadOnly) {
                // Localhost, no need for auth buttons
                loginAdminBtns.forEach(btn => { if(btn) btn.style.display = 'none'; });
                logoutAdminBtns.forEach(btn => { if(btn) btn.style.display = 'none'; });
            } else {
                // Logged in live
                loginAdminBtns.forEach(btn => { if(btn) btn.style.display = 'none'; });
                logoutAdminBtns.forEach(btn => { if(btn) btn.style.display = 'block'; });
            }
        } else {
            document.body.classList.add('read-only-mode');
            document.getElementById('reviewInputBox').readOnly = true;
            document.getElementById('reviewInputBox').placeholder = 'There is no review setup for this entry.';
            
            logoutAdminBtns.forEach(btn => { if(btn) btn.style.display = 'none'; });
            loginAdminBtns.forEach(btn => { if(btn) btn.style.display = 'block'; });
        }
    };

    const loginModal = document.getElementById('loginModal');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const submitLoginBtn = document.getElementById('submitLoginBtn');
    const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');

    const closeLogin = () => {
        if(loginModal) loginModal.classList.remove('show');
        if(adminPasswordInput) adminPasswordInput.value = '';
    };

    logoutAdminBtns.forEach(btn => {
        if(btn) btn.onclick = () => {
            window.runtimeAdminKey = null;
            isAdminUnlocked = false;
            localStorage.removeItem('admin_key_temp');
            window.location.reload(); // Hard reset for clean logout sweep
        };
    });

    loginAdminBtns.forEach(btn => {
        if(btn) btn.onclick = () => {
            if(loginModal) {
                loginModal.classList.add('show');
                if(adminPasswordInput) adminPasswordInput.focus();
            }
        };
    });

    if(closeLoginModalBtn) closeLoginModalBtn.onclick = closeLogin;

    if(submitLoginBtn) {
        submitLoginBtn.onclick = () => {
            const pwd = adminPasswordInput.value;
            if (pwd === "Dn1h7M55!") {
                // Set temporary key to survive the RELOAD
                localStorage.setItem('admin_key_temp', pwd);
                window.location.reload(); 
            } else {
                alert("Incorrect Developer Key. Viewing access only.");
            }
        };
    }
    
    // Add native dismiss
    window.addEventListener('click', (e) => {
        if (e.target == loginModal) closeLogin();
    });

    // Run initial boot visually
    window.updateAuthUI();

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
            const filter = link.getAttribute('data-filter');
            const sub = link.getAttribute('data-sub');

            if (sub === 'Info') {
                currentSubTab = 'Info';
                // Sync the top pill-tabs if they exist
                document.querySelectorAll('.pill-tab').forEach(t => {
                    t.classList.remove('active');
                    if (t.getAttribute('data-sub') === 'Info') t.classList.add('active');
                });
                
                // Sync bottom nav active state (remove from others, add to this one)
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            } else if (filter) {
                currentCategory = filter;
                currentSubTab = 'Completed'; // Reset to Completed when switching category
                
                // Sync the top pill-tabs
                document.querySelectorAll('.pill-tab').forEach(t => {
                    t.classList.remove('active');
                    if (t.getAttribute('data-sub') === 'Completed') t.classList.add('active');
                });

                // Sync active state across BOTH sidebar and bottom nav
                navLinks.forEach(l => {
                    l.classList.remove('active');
                    if (l.getAttribute('data-filter') === currentCategory) {
                        l.classList.add('active');
                    }
                });
            }
            
            updateCategoryTitleCount();
            
            // Update Add Button Text
            const addBtn = document.getElementById('addMediaBtn');
            if (addBtn) {
                addBtn.innerText = `+ Add ${currentCategory}`;
            }

            updateTheme();
            filterAndRenderMedia();
            
            // Auto close sidebar on small mobile screens
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

    const statsPage = document.getElementById('statsPage');

    const renderStats = async (category) => {
        if (!statsPage) return;
        
        // Initial "Running" state for the simulation effect
        statsPage.innerHTML = `
            <div class="stats-header">
                <h2 class="serif">${category} — Stats</h2>
                <p>Analyzing the ${category.toLowerCase()} collection...</p>
            </div>
            <div style="text-align:center; padding: 4rem 0;">
                <div class="spinner" style="margin: 0 auto 1.5rem; width: 40px; height: 40px; border-width: 3px;"></div>
                <p style="opacity:0.6; font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; animation: pulse 1.5s infinite;">Processing metadata & patterns...</p>
            </div>
        `;

        let data;
        try {
            // Fetch the real data
            const fetchPromise = fetch(`/api/stats/${encodeURIComponent(category)}`).then(res => res.json());
            
            // Wait for both the data AND at least 1000ms to give the "Run" effect
            const results = await Promise.all([
                fetchPromise,
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
            data = results[0];
        } catch (e) {
            statsPage.innerHTML = '<p style="text-align:center;color:#e74c3c;padding: 2rem;">Failed to load dynamic stats.</p>';
            return;
        }

        if (!data.total) {
            statsPage.innerHTML = `<div class="stats-header"><h2 class="serif">${category} — Stats</h2></div><p style="text-align:center;opacity:0.5;">No entries found for this category.</p>`;
            return;
        }

        // Score distribution — sorted keys from 1..10, skip empty/sub-1 buckets
        const distKeys = Object.keys(data.score_distribution || {})
            .filter(k => parseFloat(k) >= 1 && data.score_distribution[k] > 0)
            .sort((a, b) => parseFloat(a) - parseFloat(b));
        const distMax = distKeys.length ? Math.max(...distKeys.map(k => data.score_distribution[k])) : 1;
        const distBars = distKeys.map(k => {
            const count = data.score_distribution[k];
            const pct = Math.round((count / distMax) * 100);
            return `<div class="dist-bar-row">
                <span class="dist-bar-label">${k}/10</span>
                <div class="dist-bar-track"><div class="dist-bar-fill" style="width:${pct}%"></div></div>
                <span class="dist-bar-count">${count}</span>
            </div>`;
        }).join('');

        // Decade distribution
        const decKeys = Object.keys(data.decade_breakdown || {}).sort();
        const decMax = decKeys.length ? Math.max(...decKeys.map(k => data.decade_breakdown[k])) : 1;
        const decBars = decKeys.map(k => {
            const count = data.decade_breakdown[k];
            const pct = Math.round((count / decMax) * 100);
            return `<div class="dist-bar-row">
                <span class="dist-bar-label" style="min-width:85px">${k}</span>
                <div class="dist-bar-track"><div class="dist-bar-fill" style="width:${pct}%"></div></div>
                <span class="dist-bar-count">${count}</span>
            </div>`;
        }).join('');

        const reviewPct = data.total ? Math.round((data.with_reviews / data.total) * 100) : 0;

        statsPage.innerHTML = `
            <div class="stats-header">
                <h2 class="serif">${category} — Analysis Complete</h2>
                <p>Insights generated from your ${category.toLowerCase()} collection.</p>
            </div>

            <div class="stats-hero-row">
                <div class="stat-card">
                    <div class="stat-card-value">${data.total}</div>
                    <div class="stat-card-label">Total Entries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${data.avg_score ?? '—'}</div>
                    <div class="stat-card-label">Average Score</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${data.with_reviews}</div>
                    <div class="stat-card-label">With Reviews <span style="font-size:0.6em;opacity:0.6">(${reviewPct}%)</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">♥ ${data.total_likes}</div>
                    <div class="stat-card-label">Total Likes</div>
                </div>
            </div>

            ${data.favorite_genres && data.favorite_genres.length ? `
            <div class="hof-accordion" style="margin-bottom: 1.5rem; border-color: var(--theme-accent-muted);">
                <div class="hof-accordion-header" style="cursor: default; background: rgba(var(--theme-accent-rgb), 0.03);">
                    <div class="hof-accordion-title">
                        Top Genres
                        <span class="hof-subtitle">Based on items rated 7.5+</span>
                    </div>
                </div>
                <div class="hof-accordion-body" style="display: block; padding-top: 0;">
                    ${data.favorite_genres.map((g, i) => `
                        <div class="hof-entry">
                            <span class="hof-entry-rank" style="color: var(--theme-accent);">${i + 1}</span>
                            <span class="hof-entry-title" style="text-transform: capitalize; font-weight: 600;">${g}</span>
                            <span class="hof-entry-score" style="font-size: 0.7rem; opacity: 0.5;">Favorite</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <div class="hof-accordion" id="hofAccordion">
                <div class="hof-accordion-header" id="hofHeader">
                    <div class="hof-accordion-title">
                        <span class="hof-count">${data.hall_of_fame}</span>
                        Hall of Fame
                        <span class="hof-subtitle">Rated 9/10 or higher</span>
                    </div>
                    <span class="hof-chevron" id="hofChevron">▼</span>
                </div>
                <div class="hof-accordion-body" id="hofBody">
                    ${(data.hall_of_fame_items || []).map((e, i) => `
                        <div class="hof-entry">
                            <span class="hof-entry-rank">${i + 1}</span>
                            <span class="hof-entry-title">${e.title}${e.year ? ` <span class="hof-entry-year">(${e.year})</span>` : ''}</span>
                            <span class="hof-entry-score">${e.score}/10</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="stats-full-row">
                <div class="stats-dist-card">
                    <div class="stats-dist-title">Score Distribution</div>
                    ${distBars || '<p style="opacity:0.4;font-size:0.85rem">No scored entries yet.</p>'}
                </div>
                <div class="stats-dist-card">
                    <div class="stats-dist-title">Decade Breakdown</div>
                    ${decBars || '<p style="opacity:0.4;font-size:0.85rem">No release years on record.</p>'}
                </div>
            </div>`;

        // Wire up accordion toggle AFTER innerHTML is set
        const hofHeader = statsPage.querySelector('#hofHeader');
        const hofBody   = statsPage.querySelector('#hofBody');
        const hofChevron = statsPage.querySelector('#hofChevron');
        if (hofHeader) {
            hofHeader.addEventListener('click', () => {
                const isOpen = hofBody.classList.toggle('open');
                hofChevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        }
    };

    const filterAndRenderMedia = () => {
        const infoPage = document.getElementById('infoPage');
        const controls = document.querySelector('.top-controls');

        if (currentSubTab === 'Stats') {
            grid.style.display = 'none';
            if (infoPage) infoPage.style.display = 'none';
            if (statsPage) statsPage.style.display = 'block';
            if (controls) controls.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
            renderStats(currentCategory);
            return;
        } else {
            if (statsPage) statsPage.style.display = 'none';
        }

        if (currentSubTab === 'Info') {
            grid.style.display = 'none';
            if (infoPage) {
                infoPage.style.display = 'block';
                
                // Always reset to the dashboard view when landing on Info
                const infoIntroView = document.getElementById('infoIntro');
                const infoDetailView = document.getElementById('infoDetail');
                if (infoIntroView) infoIntroView.style.display = 'block';
                if (infoDetailView) infoDetailView.style.display = 'none';

                const mainTitle = infoPage.querySelector('.info-main-title');
                if (mainTitle) mainTitle.innerText = `${currentCategory} Information Hub`;
            }
            if (controls) controls.style.display = 'none';
            if (addBtn) addBtn.style.display = 'none';
            return;
        } else {
            grid.style.display = (currentSubTab === 'Rankings') ? 'block' : 'grid';
            if (infoPage) infoPage.style.display = 'none';
            if (controls) controls.style.display = 'flex';
            if (isAdminUnlocked && addBtn) addBtn.style.display = 'block';
        }

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
        // Filter by category (case-insensitive for safety)
        const items = allMedia.filter(i => (i.type || '').toLowerCase() === currentCategory.toLowerCase());
        const count = items.length;
        
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
                headers: getAuthHeaders(true),
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
    const reviewModalContent = reviewModal.querySelector('.modal-content');
    const REVIEW_MODAL_SIZE_KEY = 'smt_review_modal_size';

    // Persist user-chosen modal dimensions across opens
    if (typeof ResizeObserver !== 'undefined') {
        const _rmo = new ResizeObserver(() => {
            if (reviewModal.classList.contains('show') && window.innerWidth > 768) {
                const w = reviewModalContent.offsetWidth;
                const h = reviewModalContent.offsetHeight;
                if (w > 0 && h > 0) {
                    localStorage.setItem(REVIEW_MODAL_SIZE_KEY, JSON.stringify({ w, h }));
                }
            }
        });
        _rmo.observe(reviewModalContent);
    }

    const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');
    const saveReviewBtn = document.getElementById('saveReviewBtn');
    const clearReviewBtn = document.getElementById('clearReviewBtn');
    let currentReviewContext = null;

    const closeReviewModal = () => {
        reviewModal.classList.remove('show');
        currentReviewContext = null;
    };

    const confirmReviewModal = document.getElementById('confirmReviewModal');
    const noReviewBtn = document.getElementById('noReviewBtn');
    const yesReviewBtn = document.getElementById('yesReviewBtn');
    
    const reviewingStructureModal = document.getElementById('reviewingStructureModal');
    const closeReviewingStructureBtn = document.getElementById('closeReviewingStructureBtn');
    
    let pendingReviewData = null;

    closeReviewModalBtn.addEventListener('click', closeReviewModal);

    noReviewBtn.addEventListener('click', () => {
        confirmReviewModal.classList.remove('show');
        pendingReviewData = null;
    });

    yesReviewBtn.addEventListener('click', () => {
        confirmReviewModal.classList.remove('show');
        reviewingStructureModal.classList.add('show');
    });

    // --- Reviewing Structure Modal Logic Overhaul ---
    const categoryDefinitions = {
        "Writing": {
            def: "The story itself—what happens, how it’s structured, what characters say, and what it all means.",
            well: "The plot is clear and makes sense; events connect logically; dialogue sounds natural; themes come through without being forced.",
            poor: "The story is confusing or inconsistent; events feel random; dialogue is awkward or unnatural; themes are shallow or overly obvious."
        },
        "Directing": {
            def: "How the work is controlled and brought together—choices in tone, staging, and how scenes are presented.",
            well: "Everything feels intentional; scenes are easy to follow; tone stays consistent; all parts of the work come together.",
            poor: "Feels messy or unfocused; scenes are unclear; tone shifts unintentionally; elements feel disconnected."
        },
        "Acting": {
            def: "How believable and effective the performances are.",
            well: "Characters feel real; emotions come across naturally; performances fit the scene and tone.",
            poor: "Acting feels stiff, exaggerated, or fake; emotions don’t land; characters feel flat or inconsistent."
        },
        "Visual Craft": {
            def: "How the work looks—camera work, lighting, sets, and overall visual quality.",
            well: "Shots are clear and well-composed; lighting and design support the mood; visuals feel polished and intentional.",
            poor: "Shots are confusing or dull; visuals distract or feel cheap; noticeable visual mistakes break immersion."
        },
        "Flow": {
            def: "How the story moves over time—pacing, editing, and sound working together.",
            well: "Scenes transition smoothly; pacing feels right; sound and cuts support tension and clarity.",
            poor: "Feels choppy, rushed, or too slow; cuts are confusing; sound or timing disrupts the experience."
        },
        "Emotion": {
            def: "How strongly the work makes the viewer feel something.",
            well: "Creates clear, meaningful emotional reactions that last beyond the scene.",
            poor: "Feels empty, forced, or forgettable; emotional moments don’t land."
        },
        "Originality": {
            def: "How new or distinct the work feels in its ideas or execution.",
            well: "Offers a fresh perspective or unique style; stands out from similar works.",
            poor: "Feels generic, predictable, or heavily copied from other works."
        },
        "Genre Fit": {
            def: "How well the entry delivers on what its genre is supposed to do.",
            well: "Meets expectations (e.g., horror is tense, comedy is funny) while still feeling complete.",
            poor: "Fails to deliver the core experience the genre promises."
        }
    };

    const reviewStep1 = document.getElementById('reviewStep1');
    const reviewContentStep = document.getElementById('reviewContentStep');
    const goToStep2Btn = document.getElementById('goToStep2Btn');
    const prevSubStepBtn = document.getElementById('prevSubStepBtn');
    const nextSubStepBtn = document.getElementById('nextSubStepBtn');
    const categoryChips = document.querySelectorAll('.category-chip');

    // Content Display Elements
    const currentCategoryTitle = document.getElementById('currentCategoryTitle');
    const currentCategoryDef = document.getElementById('currentCategoryDef');
    const currentCategoryWell = document.getElementById('currentCategoryWell');
    const currentCategoryPoor = document.getElementById('currentCategoryPoor');
    const categoryContentInput = document.getElementById('categoryContentInput');
    const subStepIndicator = document.getElementById('subStepIndicator');
    
    let selectedReviewCategories = [];
    let currentSubStepIndex = 0;
    let categoryContents = {}; // Map: Category Name -> Content Text

    const updateSubStepUI = () => {
        const catName = selectedReviewCategories[currentSubStepIndex];
        const data = categoryDefinitions[catName];

        currentCategoryTitle.innerText = catName;
        currentCategoryDef.innerText = data.def;
        currentCategoryWell.innerText = data.well;
        currentCategoryPoor.innerText = data.poor;

        // Load existing content if any
        categoryContentInput.value = categoryContents[catName] || '';
        categoryContentInput.placeholder = `Write about the ${catName.toLowerCase()}... (Min. 1 word)`;
        
        // Update Indicator
        subStepIndicator.innerText = `${currentSubStepIndex + 1} / ${selectedReviewCategories.length}`;

        // Update Buttons
        nextSubStepBtn.innerText = (currentSubStepIndex === selectedReviewCategories.length - 1) ? 'Finish' : 'Next';
        categoryContentInput.focus();
    };

    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const cat = chip.getAttribute('data-cat');
            if (selectedReviewCategories.includes(cat)) {
                selectedReviewCategories = selectedReviewCategories.filter(c => c !== cat);
                chip.classList.remove('selected');
            } else {
                selectedReviewCategories.push(cat);
                chip.classList.add('selected');
            }
            goToStep2Btn.style.display = (selectedReviewCategories.length > 0) ? 'block' : 'none';
        });
    });

    goToStep2Btn.addEventListener('click', () => {
        currentSubStepIndex = 0;
        categoryContents = {}; // Fresh start
        reviewStep1.style.display = 'none';
        reviewContentStep.style.display = 'block';
        updateSubStepUI();
    });

    const goToPrevSubStep = () => {
        if (currentSubStepIndex > 0) {
            // Save current before moving
            const currentCat = selectedReviewCategories[currentSubStepIndex];
            categoryContents[currentCat] = categoryContentInput.value;

            currentSubStepIndex--;
            updateSubStepUI();
        } else {
            // Go back to category selection
            reviewContentStep.style.display = 'none';
            reviewStep1.style.display = 'block';
        }
    };

    const goToNextSubStep = () => {
        const currentCat = selectedReviewCategories[currentSubStepIndex];
        const text = categoryContentInput.value.trim();
        
        // Validation: more than 1 word
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount < 1) {
            alert(`Please write at least one word for ${currentCat} to proceed.`);
            categoryContentInput.focus();
            return;
        }

        // Save
        categoryContents[currentCat] = text;

        if (currentSubStepIndex < selectedReviewCategories.length - 1) {
            currentSubStepIndex++;
            updateSubStepUI();
        } else {
            // --- FINAL COMPLETION & ASSEMBLY ---
            const n = selectedReviewCategories.length;
            const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
            
            let combinedReview = "";
            
            selectedReviewCategories.forEach((cat, i) => {
                const content = categoryContents[cat];
                let prefix = "";
                
                if (i === 0) {
                    prefix = "1st the";
                } else if (i === n - 1) {
                    prefix = "Finally the";
                } else {
                    prefix = `${ordinals[i]} the`;
                }
                
                combinedReview += `${prefix} ${cat}: ${content}\n\n`;
            });

            // Submit to DB
            if (pendingReviewData) {
                // Ensure submitReview has the context it needs
                currentReviewContext = { title: pendingReviewData.title, type: pendingReviewData.type };
                submitReview(combinedReview.trim());
                
                // UX: provide visual feedback then close
                alert(`Review for "${pendingReviewData.title}" has been submitted!`);
                closeReviewingStructure();
            } else {
                console.error("Critical Error: Missing pendingReviewData on submission.");
                closeReviewingStructure();
            }
        }
    };

    prevSubStepBtn.addEventListener('click', goToPrevSubStep);
    nextSubStepBtn.addEventListener('click', goToNextSubStep);

    const closeReviewingStructure = () => {
        reviewingStructureModal.classList.remove('show');
        selectedReviewCategories = [];
        categoryContents = {};
        categoryChips.forEach(c => c.classList.remove('selected'));
        goToStep2Btn.style.display = 'none';
        reviewContentStep.style.display = 'none';
        reviewStep1.style.display = 'block';
        pendingReviewData = null;
    };

    closeReviewingStructureBtn.addEventListener('click', closeReviewingStructure);

    window.addEventListener('click', (e) => {
        if (e.target === reviewModal && reviewModal.classList.contains('show')) {
            closeReviewModal();
        }
        if (e.target === confirmReviewModal) {
            confirmReviewModal.classList.remove('show');
            pendingReviewData = null;
        }
        if (e.target === reviewingStructureModal) {
            reviewingStructureModal.classList.remove('show');
            pendingReviewData = null;
        }
    });

    // Helper: determine if a review is a real user-written review vs a Discord placeholder
    const isRealReview = (review) => {
        if (!review || typeof review !== 'string') return false;
        const trimmed = review.trim();
        if (trimmed === '') return false;
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('imported from discord')) return false;
        if (lower.startsWith('imported from letterboxd')) return false;
        return true;
    };

    // ── Rating History Modal ──────────────────────────────────────────────────
    const ratingHistoryModal = document.getElementById('ratingHistoryModal');
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    const historyBtn = document.getElementById('reviewHistoryBtn');

    if (closeHistoryModalBtn) {
        closeHistoryModalBtn.onclick = () => ratingHistoryModal.classList.remove('show');
    }
    window.addEventListener('click', (e) => {
        if (e.target === ratingHistoryModal) ratingHistoryModal.classList.remove('show');
    });

    // ── Quick Info Modal ──────────────────────────────────────────────────────
    const quickInfoModal = document.getElementById('quickInfoModal');
    document.getElementById('closeQuickInfoBtn').onclick = () => quickInfoModal.classList.remove('show');
    window.addEventListener('click', (e) => {
        if (e.target === quickInfoModal) quickInfoModal.classList.remove('show');
    });

    window.openQuickInfo = (item) => {
        // Title & Year
        document.getElementById('quickInfoTitle').textContent = item.title;
        document.getElementById('quickInfoYear').textContent = item.release_year ? `${item.release_year}` : '';

        // Rating — prefer numeric score over rank string
        let ratingStr = item.numeric_rating || item.rating || '';
        // Remove existing /10 if present to avoid double display (e.g. 7.5/10 / 10)
        let displayScore = (!ratingStr.startsWith('#')) ? ratingStr.toString().replace('/10', '').trim() : (item.numeric_rating || '');
        document.getElementById('quickInfoRating').textContent = displayScore ? `${displayScore} / 10` : '';

        // Edit Button (Admin Only)
        const editBtn = document.getElementById('quickInfoEditBtn');
        if (computeCanEdit()) {
            editBtn.style.display = 'block';
            editBtn.onclick = () => {
                quickInfoModal.classList.remove('show');
                window.openReviewModal(item.title, item.type, item.review, item.id);
            };
        } else {
            editBtn.style.display = 'none';
        }

        // Genres
        const genresEl = document.getElementById('quickInfoGenres');
        if (item.genres) {
            genresEl.innerHTML = item.genres.split(',').map(g =>
                `<span class="genre-badge">${g.trim()}</span>`
            ).join('');
        } else {
            genresEl.innerHTML = '';
        }

        // Review
        const reviewEl = document.getElementById('quickInfoReview');
        const hasReview = isRealReview(item.review);
        reviewEl.textContent = hasReview ? item.review : '';

        // Poster
        const posterImg = document.getElementById('quickInfoPoster');
        const posterPlaceholder = document.getElementById('quickInfoPosterPlaceholder');
        posterImg.classList.remove('loaded');
        posterPlaceholder.style.display = 'flex';
        if (item.cover_url) {
            posterImg.onload = () => {
                posterImg.classList.add('loaded');
                posterPlaceholder.style.display = 'none';
            };
            posterImg.onerror = () => {
                posterPlaceholder.style.display = 'flex';
            };
            posterImg.src = item.cover_url;
        } else {
            posterImg.src = '';
        }

        quickInfoModal.classList.add('show');
    };


    const openRatingHistory = async (itemId, title) => {
        document.getElementById('historyModalTitle').textContent = `History — ${title}`;
        document.getElementById('historyModalBody').innerHTML = '<p style="text-align:center;opacity:0.5;">Loading...</p>';
        ratingHistoryModal.classList.add('show');

        try {
            const res = await fetch(`/api/history/${itemId}`);
            const rows = await res.json();
            if (!rows.length) {
                document.getElementById('historyModalBody').innerHTML = '<p class="history-empty">No rating changes on record yet.<br><span style="opacity:0.5;font-size:0.8rem">Changes are logged the next time a Discord sync runs after you update a score.</span></p>';
            } else {
                document.getElementById('historyModalBody').innerHTML = rows.map(r => `
                    <div class="history-row">
                        <span class="history-old">${r.old_rating}</span>
                        <span class="history-arrow">→</span>
                        <span class="history-new">${r.new_rating}</span>
                        <span class="history-date">${r.changed_at}</span>
                    </div>`).join('');
            }
        } catch (e) {
            document.getElementById('historyModalBody').innerHTML = '<p class="history-empty" style="color:#e74c3c">Failed to load history.</p>';
        }
    };

    // Globally accessible for dynamically generated onclick handlers
    window.openReviewModal = (title, type, existingReview, itemId) => {
        const hasReview = isRealReview(existingReview);
        
        if (hasReview) {
            document.getElementById('reviewTitleDisplay').innerHTML = `Review For: <strong>${title}</strong>`;

            // History button — only show if we have a DB id
            const existingHistBtn = document.getElementById('reviewHistoryBtn');
            if (existingHistBtn) existingHistBtn.remove();
            if (itemId) {
                const hBtn = document.createElement('button');
                hBtn.id = 'reviewHistoryBtn';
                hBtn.className = 'history-btn';
                hBtn.innerHTML = 'Rating History';
                hBtn.onclick = () => openRatingHistory(itemId, title);
                document.getElementById('reviewTitleDisplay').insertAdjacentElement('afterend', hBtn);
            }

            const reviewText = existingReview;
            document.getElementById('reviewInputBox').value = reviewText;
            currentReviewContext = { title: title, type: type };

            // Restore user's preferred size (desktop only)
            if (window.innerWidth > 768) {
                const saved = JSON.parse(localStorage.getItem(REVIEW_MODAL_SIZE_KEY) || 'null');
                if (saved && saved.w && saved.h) {
                    reviewModalContent.style.width  = saved.w + 'px';
                    reviewModalContent.style.height = saved.h + 'px';
                } else {
                    reviewModalContent.style.width  = '';
                    reviewModalContent.style.height = '';
                }
            }

            reviewModal.classList.add('show');
        } else if (computeCanEdit()) {
            // New Workflow for Admin: Confirm Reviewing
            pendingReviewData = { title, type };
            confirmReviewModal.classList.add('show');
        }
        // Guest + No Review = do nothing
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
                headers: getAuthHeaders(true),
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
                method: 'DELETE',
                headers: getAuthHeaders(false)
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
            const res = await fetch(`/api/media/like/${itemId}`, { 
                method: 'POST',
                headers: getAuthHeaders(false)
            });
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
            const sourceIcon = ''; 
            const sourceText = item.source.toLowerCase() === 'discord' ? 'discord' : 'letterboxd';

            if (isRankingRequired) {
                const row = document.createElement('div');
                row.className = 'ranking-row stagger-in';
                row.style.animationDelay = `${index * 0.02}s`;
                
                const rankNum = parseInt(item.rating.replace('#', ''), 10);
                
                // Podium Logic (1, 2, 3)
                let podiumClass = '';
                if (rankNum === 1) podiumClass = 'rank-gold';
                else if (rankNum === 2) podiumClass = 'rank-silver';
                else if (rankNum === 3) podiumClass = 'rank-bronze';

                const hasReview = isRealReview(item.review);
                const canClickReview = hasReview || computeCanEdit();

                row.innerHTML = `
                    <div class="rank-badge ${podiumClass}">#${rankNum}</div>
                    <div class="ranking-info">
                        <div class="ranking-header">
                            <h3 class="media-title ${canClickReview ? 'clickable-review-trigger' : ''}" style="${canClickReview ? 'cursor:pointer;' : ''}">${item.title} ${item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : ''}</h3>
                        </div>
                        ${hasReview ? `<span class="review-badge">Reviewed</span>` : ''}
                    </div>
                `;

                // Action group for ranking rows (Heart + Delete)
                const actions = document.createElement('div');
                actions.className = 'row-actions';

                // Wire up review modal trigger for ranking row
                if (canClickReview) {
                    row.querySelector('.clickable-review-trigger').addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.openReviewModal(item.title, item.type, item.review, item.id);
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
                card.style.animationDelay = `${index * 0.02}s`;
                
                const yearBadge = item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : '';
                const hasReview = isRealReview(item.review);
                const canClickReview = hasReview || computeCanEdit();

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
                        <h3 class="media-title ${canClickReview ? 'clickable-review-trigger' : ''}" data-id="${item.id}">${item.title} ${yearBadge}</h3>
                    </div>
                    ${item.genres ? `
                        <div class="genre-container">
                            ${item.genres.split(',').map(g => `<span class="genre-badge">${g.trim()}</span>`).join('')}
                        </div>
                    ` : ''}
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
                            ${sourceText}
                        </div>
                        <button class="like-btn-inline ${likedClass}" title="${item.is_liked ? 'Unlike' : 'Like'}">${likedIcon}</button>
                    </div>
                `;

                // Wire up review modal trigger -> Now opens Quick Info if item has review
                if (canClickReview) {
                    card.querySelector('.clickable-review-trigger').addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Instead of opening the editor directly, open the info popup
                        // This matches the "Premium" feel where the info is the first touchpoint
                        window.openQuickInfo(item);
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
                // Card click → Quick Info popup (Movies only have poster/genres, but works for all)
                card.addEventListener('click', (e) => {
                    // Don't intercept clicks on action buttons or title
                    if (e.target.closest('button') || e.target.closest('.clickable-review-trigger')) return;
                    window.openQuickInfo(item);
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

    // --- Info Hub Navigation Logic ---
    const iIntro = document.getElementById('infoIntro');
    const iDetail = document.getElementById('infoDetail');
    const iTitle = document.getElementById('infoSectionTitle');
    const iSubtitle = document.getElementById('infoSectionSubtitle');
    const iBody = document.getElementById('infoSectionBody');
    const iBack = document.getElementById('backToInfoBtn');

    const infoSubtitles = {
        'Rating Scale': 'A standardized 1-10 numerical reference guide. Intermediate scores (e.g., 7.5 or 3.5) represent a qualitative hybrid, indicating the entry straddles the transition between two tiers. Click a tier to expand.',
        'Criteria Breakdown': 'This methodology isolates 8 core dimensions of craft to ensure structural consistency and reduce evaluation overlap. By separating technical cause from emotional effect, we maintain a measurable scoring framework. Click a category to view metrics.',
        'Ranking Rules': 'The logic behind my personal Top 20 list. This section explains the relationship between Favorites and Scores, as well as the rules governing rank stability and fluidity.',
        'Bias & Effects': 'These are my own personal biases and the common "shortcuts" my brain uses when I review media. I’m not trying to fix these—they’re just here to help you understand the perspective behind my scores and why I value certain things more than others.'
    };

    const infoData = {
        'Rating Scale': `
            <div class="rating-accordion">
                ${[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(num => {
                    const titles = {
                        10: 'Peak',
                        9: 'Excellent',
                        8: 'Great',
                        7: 'Good',
                        6: 'Decent',
                        5: 'Average',
                        4: 'Weak',
                        3: 'Bad',
                        2: 'Flawed',
                        1: 'Awful'
                    };
                    const details = {
                        10: ['My definition of "Peak" is a personal favorite.', 'Deep emotional and lasting impact.', 'Personally significant or defining experience.', 'Infinite rewatch value.', 'Absolute must-watch.', 'Would Never Forget.', 'Definitely have revisited this entry over 3 times.'],
                        9: ['Outstanding in almost all aspects.', 'Strong emotional and intellectual impact.', 'Highly memorable.', 'Would revisit freely with no specific reason.', 'Must-watch recommendation.', 'Hard to forget; vivid long-term recall.', 'Definitely have revisited this entry over 3 times.'],
                        8: ['Strong performance across most categories.', 'Memorable and engaging experience.', 'Strong positive reaction.', 'Would revisit at almost any time.', 'Highly recommended.', 'Easy to recall key moments in detail.', 'Definitely have revisited this entry over 3 times.'],
                        7: ['The true middle-ground option.', 'Positive emotional response throughout.', 'Would revisit occasionally.', 'Recommended.', 'Scenes or ideas stay with you over time.', 'Very Likely have revisited this entry.'],
                        6: ['Noticeably better than average but inconsistent.', 'Some enjoyable or interesting parts.', 'Positive but restrained reaction.', 'Would revisit only for specific reasons.', 'Mildly recommended.', 'Retains clear moments, but not strongly anchored.', 'Likely have revisited this entry.'],
                        5: ['Neither good nor bad in a meaningful way.', 'Neutral emotional response.', 'Forgettable but not painful to watch.', 'No desire to rewatch.', 'Not particularly recommended.', 'Quickly fades afterward.'],
                        4: ['Tried to work but largely failed in execution.', 'Some effort or moments show potential.', 'Mixed reaction leaning negative.', 'Unlikely to rewatch.', 'Generally not recommended.', 'Remembered in parts, but not as a coherent whole.'],
                        3: ['Poor overall, but with tolerable moments.', 'Negative experience overall.', 'Barely worth finishing.', 'Would not rewatch.', 'Not recommended.', 'Fades quickly, only fragments remain.'],
                        2: ['Significantly flawed with almost no structure.', 'Dislike outweighs any minor positives.', 'Glad it’s over.', 'Would not rewatch.', 'Not recommended.', 'Easily forgettable.'],
                        1: ['High chance this was not finished due to unwatchability.', 'Awful execution across most areas.', 'No enjoyment or value gained.', 'Strong negative reaction.', 'Not recommended under any circumstance.', 'Would forget if given the choice.']
                    };

                    return `
                        <div class="rating-item">
                            <div class="rating-header-click">
                                <div class="rating-score-label">
                                    <span class="score-num">${num}</span>
                                    <span class="score-title">${titles[num]}</span>
                                </div>
                                <span class="chevron-icon">▼</span>
                            </div>
                            <div class="rating-content-pane">
                                <ul class="rating-detail-list">
                                    ${details[num].map(d => `<li>${d}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `,
        'Criteria Breakdown': `
            <div class="rating-accordion criteria-accordion">
                ${[
                    {
                        title: 'Writing', 
                        text: `This covers everything "on paper" before production begins: story, dialogue, plot structure, and themes. I'm looking for a narrative that makes logical sense and scenes that connect naturally. Strong writing feels purposeful and deliberate. Weak writing relies heavily on lucky coincidences, plot armor, or characters making frustratingly stupid decisions just to advance the story.`
                    },
                    {
                        title: 'Directing', 
                        text: `This is all about the captain of the ship and the unified vision of the work. Does the tone stay consistent from start to finish? Good directing creates a focused atmosphere where the music, the actors, and the camera are all working together toward the exact same goal. Weak directing feels confusing, as if the different production departments weren't talking to each other.`
                    },
                    {
                        title: 'Acting', 
                        text: `This evaluates the believability of the performances. It's not just about who can scream the loudest or cry the hardest—it's about the subtle, quiet moments too. Good acting grounds the story and makes you completely forget you're watching a performance. Bad or stiff acting immediately breaks the immersion and snaps you out of the experience.`
                    },
                    {
                        title: 'Visual Craft', 
                        text: `This combines cinematography, lighting, sets, costumes, CGI, and overall design. Are the shots framed nicely? Does the lighting match what the scene is trying to make you feel? This isn't just about throwing a massive budget at the screen; it's about building a uniquely cohesive physical world. Weak craft looks flat, dull, uninspired, or noticeably artificial.`
                    },
                    {
                        title: 'Flow', 
                        text: `This measures pacing, editing, and audio-visual rhythm. How well does the story move over time? Good flow means the editing feels seamless, the transitions make sense, and the pacing naturally holds your attention without dragging. Bad flow feels noticeably choppy, unnecessarily drawn out, or uses awkward cuts that kill the momentum.`
                    },
                    {
                        title: 'Emotion', 
                        text: `This is the raw impact factor. Regardless of the technical details, did this work actually make you feel something? It could be tension, joy, profound sadness, or even legitimate discomfort. A strong emotional impact will linger with you long after it's over, while a weak one feels forced, unearned, or completely hollow.`
                    },
                    {
                        title: 'Originality', 
                        text: `This isn't about completely reinventing the wheel—it's about offering a fresh perspective or an undeniably unique sense of style. Did the creators take a risk, try something different, or put a clever spin on an old trope? Strong originality feels inventive. Weak originality feels like a predictable, copy-paste formula you've already seen a hundred times.`
                    },
                    {
                        title: 'Genre Fit', 
                        text: `This category asks one simple question: Did it deliver on what it promised to be? A comedy needs to bring the laughs; a horror needs to be tense; an action thriller needs good set pieces. An entry can have basic writing and mediocre visuals, but if it successfully nails its specific genre goal, it gets high respect here.`
                    }
                ].map(cat => `
                    <div class="rating-item">
                        <div class="rating-header-click">
                            <div class="rating-score-label">
                                <span class="score-title" style="padding-left: 0.5rem;">${cat.title}</span>
                            </div>
                            <span class="chevron-icon">▼</span>
                        </div>
                        <div class="rating-content-pane">
                            <div style="padding: 1rem; color: var(--text-secondary); line-height: 1.7; font-size: 0.95rem;">
                                ${cat.text}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `,
        'Ranking Rules': `
            <div class="rating-accordion criteria-accordion">
                ${[
                    {title: 'Subjective Favorite Bias', text: 'Unlike the global list, the Rankings tab is **explicitly biased**. It represents my personal "Favorites" rather than just technically superior works. Emotional resonance and personal impact are the primary drivers here.'},
                    {title: 'Score Independence', text: 'An entry does **not** need a high numerical score (like 10/10) to enter the Top 20. A technically "flawed" 7/10 that I personally love can higher rank than an "excellent" 9/10.'},
                    {title: 'Rank Stability (Anchoring)', text: 'The list is fluid, but stability is tied to position. The higher an entry sits (especially the Top 5), the less likely it is to move. Lower positions (15-20) are more volatile and prone to being swapped out.'},
                    {title: 'Active Fluidity', text: 'This list is not static. As I watch more media, entries will be added, shifted, and deleted. The Rankings tab is a living document reflecting my absolute best-of-the-best at any given moment.'}
                ].map(item => `
                    <div class="rating-item">
                        <div class="rating-header-click">
                            <div class="rating-score-label">
                                <span class="score-title" style="padding-left: 0.5rem;">${item.title}</span>
                            </div>
                            <span class="chevron-icon">▼</span>
                        </div>
                        <div class="rating-content-pane">
                            <div style="padding: 1rem; color: var(--text-secondary); line-height: 1.7; font-size: 0.95rem;">
                                ${item.text}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `,
        'Bias & Effects': `
            <div class="rating-accordion criteria-accordion">
                ${[
                    {
                        title: 'Preference Bias & Favoritism', 
                        text: `I have a naturally high interest in grounded dramas, high-concept sci-fi, and psychological thrillers. I also tend to give more weight to philosophical or socially relevant themes.<br><br>
                               <strong>The Result:</strong> This creates a "lower barrier to entry" where a drama might score an 8 simply because it's engaging with my favorite topics, while a comedy that's technically just as good might feel less "important."<br><br>
                               <strong>What to understand:</strong> My "Average" for a preferred genre can still rank higher than a "Good" for a genre I'm less connected to. It's a measurement of personal resonance as much as craft.`
                    },
                    {
                        title: 'Theme Bias & Weighting', 
                        text: `I am inherently drawn to philosophical, psychological, and socially relevant themes. Unlike conventional popcorn entertainment, I look for a balance between *what* a work is saying and *how* it is saying it. I evaluate thematic weight and technical execution with equal importance, ensuring that a profound message is supported by meaningful craft.`
                    },
                    {
                        title: 'Expectation Bias & Anticipation', 
                        text: `I'm often already biased toward directors, creators, or actors I've liked in the past, and my expectations are heavily tied to marketing and general reputation.<br><br>
                               <strong>The Result:</strong> I walk into these works *wanting* them to be great. If there's a big gap between what I expected and what I got, the score is driven by that disappointment. Conversely, a hidden gem I expected to be bad might get an "inflation" bump because I was pleasantly surprised.<br><br>
                               <strong>What to understand:</strong> These scores are a measurement of my personal surprise or letdown relative to the talent involved and the hype surrounding the release.`
                    },
                    {
                        title: 'Recency Bias & Drift', 
                        text: `Newer entries are fresher in my head; the music, the visuals, and the emotions are all high clarity. Older entries suffer from "memory decay" where I might only remember the biggest flaws or broadest strokes.<br><br>
                               <strong>The Result:</strong> Without active re-reviews, my rankings will naturally drift toward whatever I've experienced recently. Older ratings can start to feel deflated or disconnected over time.<br><br>
                               <strong>What to understand:</strong> A 10-year-old 8/10 was likely just as impactful at the time as a 9/10 released today. If you see an old rating that looks way off, message me and I'll re-evaluate it.`
                    },
                    {
                        title: 'Legacy Bias & Momentum', 
                        text: `I find it hard to judge sequels or continuations in a vacuum. My emotional connection to an entire franchise often fills in the narrative gaps for a weaker individual entry.<br><br>
                               <strong>The Result:</strong> A sequel can be "carried" by the momentum of a series I love, or unfairly punished for just not being as legendary as its predecessor.<br><br>
                               <strong>What to understand:</strong> My ratings often reflect the weight of the entire franchise journey, rather than just the isolated effort of that single entry.`
                    },
                    {
                        title: 'Scale Bias & Efficiency', 
                        text: `I pay close attention to how a production uses its resources. I hold massive-budget blockbusters to a much higher technical standard and I definitely notice when that money produces uninspired "slop."<br><br>
                               <strong>The Result:</strong> I give a lot of credit to low-budget projects that perform well despite their limits. An indie "7" often feels more impressive to me than a massive studio "7."<br><br>
                               <strong>What to understand:</strong> This is an evaluation of resource efficiency. A high-budget failure feels like a larger loss, while a low-budget success is seen as a triumph of passion.`
                    }
                ].map(item => `
                    <div class="rating-item">
                        <div class="rating-header-click">
                            <div class="rating-score-label">
                                <span class="score-title" style="padding-left: 0.5rem;">${item.title}</span>
                            </div>
                            <span class="chevron-icon">▼</span>
                        </div>
                        <div class="rating-content-pane">
                            <div style="padding: 1rem; color: var(--text-secondary); line-height: 1.7; font-size: 0.95rem;">
                                ${item.text}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `
    };

    if (iIntro && iDetail) {
        // Delegate rating item clicks
        iBody.addEventListener('click', (e) => {
            const header = e.target.closest('.rating-header-click');
            if (header) {
                const item = header.closest('.rating-item');
                // Close other items for clean accordion behavior
                document.querySelectorAll('.rating-item').forEach(other => {
                    if (other !== item) other.classList.remove('open');
                });
                item.classList.toggle('open');
            }
        });

        document.querySelectorAll('.info-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.getAttribute('data-section');
                iTitle.innerText = section;
                iSubtitle.innerText = infoSubtitles[section] || 'Detailed methodology and project documentation.';
                iBody.innerHTML = infoData[section] || '<p>Information regarding this section is currently being finalized.</p>';
                iIntro.style.display = 'none';
                iDetail.style.display = 'block';
                // Scroll to top of content
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        if (iBack) {
            iBack.addEventListener('click', () => {
                iDetail.style.display = 'none';
                iIntro.style.display = 'block';
            });
        }
    }

    // Initialization
    updateCategoryTitleCount();
    updateTheme();
    fetchMedia().then(() => {
        updateCategoryTitleCount();
        watchStartupSync();
    });
});
