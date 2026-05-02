document.addEventListener('DOMContentLoaded', () => {
    // Determine Environment: Localhost vs Production (Read-Only)
    const hostname = window.location.hostname;
    const isReadOnly = (hostname !== 'localhost' && hostname !== '127.0.0.1');

    // Admin Auth Hook (In-Memory Only, Wipes on Refresh)
    const tempKey = localStorage.getItem('admin_key_temp');
    if (tempKey === "9745") {
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

    const loginAdminBtns = [document.getElementById('loginAdminBtn')];
    const logoutAdminBtns = [document.getElementById('logoutAdminBtn')];

    // Make updateAuthUI safely globally accessible so it can run before and after media loads
    window.updateAuthUI = () => {
        const canEdit = computeCanEdit();
        const guestActions = document.getElementById('guestConsoleActions');
        const devActions = document.getElementById('devConsoleActions');

        if (canEdit) {
            document.body.classList.remove('read-only-mode');
            document.getElementById('reviewInputBox').readOnly = false;
            document.getElementById('reviewInputBox').placeholder = 'Type your review here...';
            
            if(guestActions) guestActions.style.display = 'none';
            if(devActions) devActions.style.display = 'block';
            
            // Show global add button in header
            const globalAddBtn = document.getElementById('addMediaBtn');
            if (globalAddBtn) globalAddBtn.style.display = 'flex';
        } else {
            document.body.classList.add('read-only-mode');
            document.getElementById('reviewInputBox').readOnly = true;
            document.getElementById('reviewInputBox').placeholder = 'There is no review setup for this entry.';
            
            if(guestActions) guestActions.style.display = 'block';
            if(devActions) devActions.style.display = 'none';
            
            // Hide global add button
            const globalAddBtn = document.getElementById('addMediaBtn');
            if (globalAddBtn) globalAddBtn.style.display = 'none';
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
            const key = adminPasswordInput.value;
            if (key === "9745") {
                // Set temporary key to survive the RELOAD
                localStorage.setItem('admin_key_temp', key);
                window.location.reload(); 
            } else {
                alert("Incorrect Developer Key. Viewing access only.");
                adminPasswordInput.value = '';
            }
        };
    }
    
    // Fancy focus effect for the key input
    if(adminPasswordInput) {
        adminPasswordInput.onfocus = () => {
            adminPasswordInput.style.borderColor = 'var(--theme-accent)';
            adminPasswordInput.style.boxShadow = '0 0 20px rgba(var(--theme-accent-rgb), 0.3)';
        };
        adminPasswordInput.onblur = () => {
            adminPasswordInput.style.borderColor = 'var(--border-color)';
            adminPasswordInput.style.boxShadow = 'none';
        };
    }

    // Add native dismiss (double-click background to close)
    window.addEventListener('dblclick', (e) => {
        if (e.target == loginModal) closeLogin();
    });

    // Run initial boot visually
    window.updateAuthUI();

    let allMedia = [];
    let rankMap = {}; // title|type -> rank number; populated in renderMedia, read by openQuickInfo
    let currentCategory = 'Movies'; // Default page
    let currentSubTab = 'Completed'; // Default subtab ('Completed' or 'Rankings')

    const searchInput = document.getElementById('searchInput');
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
    // v205: Centralized category switch logic
    const handleCategorySwitch = (category) => {
        currentCategory = category;
        currentSubTab = 'Completed';

        // Apply theme for colors (v218)
        document.body.setAttribute('data-theme', category.toLowerCase().replace(' ', '-'));

        // 1. Update Search Placeholder
        if (searchInput) {
            if (currentCategory === 'TV Series') {
                searchInput.placeholder = "Search titles or creators...";
            } else if (currentCategory === 'Movies') {
                searchInput.placeholder = "Search titles or directors...";
            } else {
                searchInput.placeholder = `Search ${currentCategory.toLowerCase()}...`;
            }
        }

        // 2. Update Add Button Text
        const addBtn = document.getElementById('addMediaBtn');
        if (addBtn) {
            const desktopLabel = addBtn.querySelector('.desktop-text');
            if (desktopLabel) {
                const displayLabel = currentCategory === 'TV Series' ? 'TV Show' : currentCategory.replace(/s$/, '');
                desktopLabel.innerText = `+ Add ${displayLabel}`;
            }
        }

        // 3. Clear and Re-populate Genre Filters
        filterState.genres.clear();
        updateActiveFilterCount();
        populateGenreFilters();

        // 4. Sync ALL category buttons (Desktop + Mobile)
        navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('data-filter') === currentCategory) l.classList.add('active');
        });
        
        document.querySelectorAll('.pill-tab[data-filter]').forEach(t => {
            t.classList.remove('active');
            if (t.getAttribute('data-filter') === currentCategory) t.classList.add('active');
        });

        // Sync the sub-tabs to "Completed"
        document.querySelectorAll('.pill-tab[data-sub]').forEach(t => {
            t.classList.remove('active');
            if (t.getAttribute('data-sub') === 'Completed') t.classList.add('active');
        });

        // 5. Update UI
        updateCategoryTitleCount();
        updateTheme();
        filterAndRenderMedia();
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
                
                // Sync bottom nav active state
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                updateCategoryTitleCount();
                updateTheme();
                filterAndRenderMedia();
            } else if (filter) {
                handleCategorySwitch(filter);
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
            
            const filter = tab.getAttribute('data-filter');
            const sub = tab.getAttribute('data-sub');

            if (filter) {
                handleCategorySwitch(filter);
            } else if (sub) {
                // This is a sub-tab (Header Sub Nav)
                pillTabs.forEach(t => {
                    if (t.getAttribute('data-sub')) t.classList.remove('active');
                });
                tab.classList.add('active');
                currentSubTab = sub;

                // Sync Mobile Info Tab if needed
                if (sub === 'Info') {
                    navLinks.forEach(l => l.classList.remove('active'));
                    const mobileInfo = Array.from(navLinks).find(l => l.getAttribute('data-sub') === 'Info');
                    if (mobileInfo) mobileInfo.classList.add('active');
                }
                
                filterAndRenderMedia();
            }
        });
    });
    searchInput.addEventListener('input', () => {
        filterAndRenderMedia();
    });

    // --- Unified Filter System (v160) ---
    const filterTrigger = document.getElementById('filterTrigger');
    const filterMenu = document.getElementById('filterMenu');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const resetFiltersBtn = document.getElementById('resetFilters');
    const activeFilterCount = document.getElementById('activeFilterCount');
    const genreFilterList = document.getElementById('genreFilterList');

    let filterState = {
        sort: 'shuffle',
        likedOnly: false,
        reviewed: false,
        unreviewed: false,
        genres: new Set()
    };

    if (filterTrigger) {
        filterTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Dynamic Positioning for Desktop (since menu is now at body root)
            if (window.innerWidth > 800) {
                const rect = filterTrigger.getBoundingClientRect();
                filterMenu.style.top = `${rect.bottom + 12}px`;
                filterMenu.style.right = `${window.innerWidth - rect.right}px`;
                filterMenu.style.left = 'auto';
                filterMenu.style.bottom = 'auto';
            } else {
                // Reset for Mobile Bottom Sheet (CSS handles this, but safety first)
                filterMenu.style.top = 'auto';
                filterMenu.style.right = '0';
                filterMenu.style.left = '0';
                filterMenu.style.bottom = '0';
            }
            
            filterMenu.classList.toggle('active');
        });
    }

    document.addEventListener('click', (e) => {
        if (filterMenu && !filterMenu.contains(e.target) && filterTrigger && !filterTrigger.contains(e.target)) {
            filterMenu.classList.remove('active');
        }
    });

    const updateActiveFilterCount = () => {
        let count = 0;
        if (filterState.likedOnly) count++;
        if (filterState.reviewed) count++;
        if (filterState.unreviewed) count++;
        count += filterState.genres.size;
        
        if (count > 0) {
            activeFilterCount.innerText = count;
            activeFilterCount.style.display = 'flex';
        } else {
            activeFilterCount.style.display = 'none';
        }
    };

    const populateGenreFilters = () => {
        if (!genreFilterList) return;
        const genres = new Set();
        allMedia.forEach(item => {
            if (item.genres && item.type.toLowerCase() === currentCategory.toLowerCase()) {
                item.genres.split(',').forEach(g => genres.add(g.trim()));
            }
        });
        
        const sortedGenres = Array.from(genres).sort();
        genreFilterList.innerHTML = sortedGenres.map(g => `
            <label class="filter-option checkbox">
                <input type="checkbox" class="genre-filter-check" value="${g}" ${filterState.genres.has(g) ? 'checked' : ''}>
                <span>${g}</span>
            </label>
        `).join('');
    };

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const sortRadio = document.querySelector('input[name="sort"]:checked');
            filterState.sort = sortRadio ? sortRadio.value : 'rating-desc';
            filterState.likedOnly = document.getElementById('filterLiked').checked;
            filterState.reviewed = document.getElementById('filterReviewed').checked;
            filterState.unreviewed = document.getElementById('filterUnreviewed').checked;
            
            filterState.genres = new Set();
            document.querySelectorAll('.genre-filter-check:checked').forEach(cb => {
                filterState.genres.add(cb.value);
            });

            updateActiveFilterCount();
            filterMenu.classList.remove('active');
            filterAndRenderMedia();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            filterState = {
                sort: 'shuffle',
                likedOnly: false,
                reviewed: false,
                unreviewed: false,
                genres: new Set()
            };
            const defaultSort = document.querySelector('input[name="sort"][value="rating-desc"]');
            if (defaultSort) defaultSort.checked = false; // Don't pre-check anything on reset to imply shuffle
            document.getElementById('filterLiked').checked = false;
            document.getElementById('filterReviewed').checked = false;
            document.getElementById('filterUnreviewed').checked = false;
            populateGenreFilters();
            
            updateActiveFilterCount();
            filterMenu.classList.remove('active');
            filterAndRenderMedia();
        });
    }

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
            
            // Wait for both the data AND at least 2000ms to give the "Run" effect
            const results = await Promise.all([
                fetchPromise,
                new Promise(resolve => setTimeout(resolve, 2000))
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
                <span class="dist-bar-label dist-bar-label-decade">${k}</span>
                <div class="dist-bar-track"><div class="dist-bar-fill" style="width:${pct}%"></div></div>
                <span class="dist-bar-count">${count}</span>
            </div>`;
        }).join('');

        const reviewPct = data.total ? Math.round((data.with_reviews / data.total) * 100) : 0;

        statsPage.innerHTML = `
            <div class="stats-header">
                <h2 class="serif">${category} — Analysis Complete</h2>
                <p>Insights generated from ${category.toLowerCase()} collection.</p>
            </div>

            <div class="stats-hero-row">
                <div class="stat-card">
                    <div class="stat-card-value">${data.total}</div>
                    <div class="stat-card-label">Total Entries</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">${data.with_reviews}</div>
                    <div class="stat-card-label">With Reviews <span style="font-size:0.6em;opacity:0.6">(${reviewPct}%)</span></div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-value">~ 1 in ${data.like_ratio || '—'}</div>
                    <div class="stat-card-label">Like Ratio <span style="font-size:0.6em;opacity:0.6">(Exclusivity)</span></div>
                </div>
            </div>

            ${data.favorite_genres && data.favorite_genres.length ? `
            <div class="hof-accordion" id="genresAccordion" style="margin-bottom: 1.5rem; border-color: var(--theme-accent-muted);">
                <div class="hof-accordion-header" id="genresHeader">
                    <div class="hof-accordion-title">
                        Top Genres
                        <span class="hof-subtitle hof-subtitle-desktop"><b>Passion-Volume Index: Σ (Rating - 4.5)³ × (1 - 1/Count)</b>
                        <br><br>
                        1. <b>The Floor (4.5):</b> Ratings below 4.5 contribute 0 points. This mathematically filters out genres that are only watched occasionally or disliked.
                        <br><br>
                        2. <b>Cubic Growth (³):</b> High ratings carry exponential weight. A 10/10 ${category.toLowerCase().includes('movie') ? 'movie' : 'item'} is worth 216x more than a 5/0 item. <b>Masterpieces marked with a Heart receive a 25% "Passion Bonus,"</b> and <b>entries with a Review receive a 10% "Review Bonus,"</b> ensuring personal involvement defines the top list.
                        <br><br>
                        3. <b>The Confidence Filter:</b> A genre needs a track record. A single 10/10 entry results in 0 points, while 10 entries retain 90% of their score. This eliminates "one-hit wonder" categories.</span>
                        <span class="hof-subtitle-mobile"><b>Passion-Volume Index:</b> Σ (Rating - 4.5)³ × (1 - 1/Count)</span>
                    </div>
                    <span class="hof-chevron" id="genresChevron">▼</span>
                </div>
                <div class="hof-accordion-body" id="genresBody">
                    ${data.favorite_genres.map((g, i) => `
                        <div class="hof-entry" style="align-items: flex-start;">
                            <span class="hof-entry-rank" style="color: var(--theme-accent);">${i + 1}</span>
                            <div style="display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0;">
                                <span class="hof-entry-title" style="text-transform: capitalize; font-weight: 600;">${g.name}</span>
                                <div class="example-pill-container">
                                    ${g.examples.map(ex => `<span class="example-pill">${ex}</span>`).join('')}
                                </div>
                            </div>
                            <span class="hof-entry-score" style="font-size: 0.7rem; opacity: 0.7; color: var(--theme-accent); align-self: center;">${g.score} pts</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${data.favorite_directors && data.favorite_directors.length ? `
            <div class="hof-accordion" id="directorsAccordion" style="margin-bottom: 1.5rem;">
                <div class="hof-accordion-header" id="directorsHeader">
                    <div class="hof-accordion-title">
                        ${category === 'Movies' ? 'Top Directors' : (category === 'Manga' ? 'Top Authors' : 'Top Creators')}
                        <span class="hof-subtitle hof-subtitle-desktop"><b>Passion-Volume Index: Σ (Rating - 4.5)³ × (1 - 1/Count)</b>
                        <br><br>
                        1. <b>Quality Threshold:</b> Only movies rated above 4.5 contribute points. This mathematically filters out directors whose work you found mediocre or disliked.
                        <br><br>
                        2. <b>Cubic Weighting (³):</b> Near-perfect scores carry exponential weight. Masterpieces marked with a <b>Heart (25% bonus)</b> or a <b>Review (10% bonus)</b> significantly increase a director's standing.
                        <br><br>
                        3. <b>The Confidence Multiplier:</b> A director's score is scaled by their filmography's depth. A single high-rated movie results in 0 points; a director needs a consistent track record to reach the top.</span>
                        <span class="hof-subtitle-mobile"><b>Passion-Volume Index:</b> Σ (Rating - 4.5)³ × (1 - 1/Count)</span>
                    </div>
                    <span class="hof-chevron" id="directorsChevron">▼</span>
                </div>
                <div class="hof-accordion-body" id="directorsBody">
                    ${data.favorite_directors.map((d, i) => `
                        <div class="hof-entry" style="align-items: flex-start;">
                            <span class="hof-entry-rank" style="color: var(--theme-accent);">${i + 1}</span>
                            <div style="display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 0;">
                                <span class="hof-entry-title" style="font-weight: 700;">${d.name}</span>
                                <div class="example-pill-container">
                                    ${d.examples.map(ex => `<span class="example-pill">${ex}</span>`).join('')}
                                </div>
                            </div>
                            <span class="hof-entry-score" style="font-size: 0.7rem; opacity: 0.7; color: var(--theme-accent); align-self: center;">${d.score} pts</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}



            <div class="stats-full-row">
                <div class="stats-dist-card">
                    <div class="stats-dist-title">Score Distribution</div>
                    ${distBars || '<p style="opacity:0.4;font-size:0.85rem">No scored entries yet.</p>'}
                    <div class="dist-card-footer">
                        <span class="dist-footer-label">Average Score</span>
                        <span class="dist-footer-value">${data.avg_score}/10</span>
                    </div>
                </div>
                <div class="stats-dist-card">
                    <div class="stats-dist-title">Decade Breakdown</div>
                    ${decBars || '<p style="opacity:0.4;font-size:0.85rem">No release years on record.</p>'}
                    <div class="dist-card-footer">
                        <span class="dist-footer-label">Average Release Year</span>
                        <span class="dist-footer-value">${data.avg_year}</span>
                    </div>
                </div>
            </div>`;

        // Wire up accordion toggle AFTER innerHTML is set
        const setupAccordion = (headerId, bodyId, chevronId) => {
            const header = statsPage.querySelector(`#${headerId}`);
            const body   = statsPage.querySelector(`#${bodyId}`);
            const chevron = statsPage.querySelector(`#${chevronId}`);
            if (header && body) {
                header.addEventListener('click', () => {
                    const parent = header.closest('.hof-accordion');
                    const isOpening = !body.classList.contains('open');
                    body.classList.toggle('open');
                    if (parent) parent.classList.toggle('active', isOpening);
                    if (chevron) chevron.style.transform = isOpening ? 'rotate(180deg)' : 'rotate(0deg)';
                });
            }
        };


        setupAccordion('genresHeader', 'genresBody', 'genresChevron');
        setupAccordion('directorsHeader', 'directorsBody', 'directorsChevron');
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

                // CRITICAL: Refresh Auth UI visibility when entering The Hub
                window.updateAuthUI();
            }
            if (controls) controls.style.display = 'none';
            // KEEP the add button visible even in Info/Stats if admin is unlocked
            if (isAdminUnlocked && addBtn) addBtn.style.display = 'flex';
            return;
        } else {
            grid.style.display = (currentSubTab === 'Rankings') ? 'block' : 'grid';
            if (infoPage) infoPage.style.display = 'none';
            if (controls) controls.style.display = 'flex';
            if (isAdminUnlocked && addBtn) addBtn.style.display = 'flex';
        }

        // Filter by current Category
        let filtered = allMedia.filter(item => item.type.toLowerCase() === currentCategory.toLowerCase());
        
        // Filter by Sub Tab
        const isRankingRequired = currentSubTab === 'Rankings';

        // 1. Filter by Tab Status (Completed vs Ranking)
        if (isRankingRequired) {
            filtered = filtered.filter(item =>
                item.is_ranking === true || item.is_ranking === 1
            );
        }

        // 2. Bulletproof Identity deduplication
        filtered.sort((a, b) => (b.is_ranking ? 1 : 0) - (a.is_ranking ? 1 : 0));

        const activeIds = new Set();
        const activeMediaKeys = new Set();
        
        filtered = filtered.filter(item => {
            const identityKey = `${item.title.toLowerCase().trim()}|${item.type.toLowerCase()}|${item.release_year || 'any'}`;
            if (activeMediaKeys.has(identityKey)) return false;
            activeMediaKeys.add(identityKey);
            return true;
        });

        // 3. Filter by Search Query (Upgraded to include Director)
        const query = searchInput.value.toLowerCase().trim();
        if (query) {
            filtered = filtered.filter(item => 
                item.title.toLowerCase().includes(query) || 
                (item.director && item.director.toLowerCase().includes(query))
            );
        }

        // 4. Unified Multi-Select Filters
        if (filterState.likedOnly) {
            filtered = filtered.filter(item => item.is_liked);
        }
        
        if (filterState.reviewed && !filterState.unreviewed) {
            filtered = filtered.filter(item => isRealReview(item.review));
        } else if (filterState.unreviewed && !filterState.reviewed) {
            filtered = filtered.filter(item => !isRealReview(item.review));
        }

        if (filterState.genres.size > 0) {
            filtered = filtered.filter(item => {
                if (!item.genres) return false;
                const itemGenres = item.genres.split(',').map(g => g.trim());
                return Array.from(filterState.genres).some(g => itemGenres.includes(g));
            });
        }

        // 5. Sorting (Using unified filter state)
        const sortVal = filterState.sort;
        if (sortVal === 'shuffle') {
            // Fisher-Yates Shuffle
            for (let i = filtered.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
            }
        } else if (sortVal === 'rating-desc') {
            filtered.sort((a, b) => (parseRating(b.rating) || 0) - (parseRating(a.rating) || 0));
        } else if (sortVal === 'rating-asc') {
            filtered.sort((a, b) => (parseRating(a.rating) || 0) - (parseRating(b.rating) || 0));
        } else if (sortVal === 'year-desc') {
            filtered.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
        } else if (sortVal === 'year-asc') {
            filtered.sort((a, b) => (a.release_year || 0) - (b.release_year || 0));
        } else if (sortVal === 'title-asc') {
            filtered.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortVal === 'title-desc') {
            filtered.sort((a, b) => b.title.localeCompare(a.title));
        }

        renderMedia(filtered, isRankingRequired);
    };

    const parseRating = (r) => {
        if (!r) return 0;
        if (typeof r === 'number') return r;
        if (r.includes('/')) return parseFloat(r.split('/')[0]);
        return parseFloat(r) || 0;
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
        if (!currentCategory || !pageTitle) return;
        // Filter by category (case-insensitive for safety)
        const items = allMedia.filter(i => (i.type || '').toLowerCase() === currentCategory.toLowerCase());
        const count = items.length;
        
        pageTitle.innerHTML = `<span class="serif">${currentCategory}</span>`;
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
    const textReviewBtn = document.getElementById('textReviewBtn');
    const yesReviewBtn = document.getElementById('yesReviewBtn');
    
    const reviewingStructureModal = document.getElementById('reviewingStructureModal');
    const closeReviewingStructureBtn = document.getElementById('closeReviewingStructureBtn');
    
    let pendingReviewData = null;

    closeReviewModalBtn.addEventListener('click', closeReviewModal);

    noReviewBtn.addEventListener('click', () => {
        confirmReviewModal.classList.remove('show');
        pendingReviewData = null;
    });

    textReviewBtn.addEventListener('click', () => {
        confirmReviewModal.classList.remove('show');
        if (pendingReviewData) {
            currentReviewContext = { title: pendingReviewData.title, type: pendingReviewData.type };
            const displayTitle = document.getElementById('reviewTitleDisplay');
            if (displayTitle) displayTitle.innerText = `Review: ${pendingReviewData.title}`;
            document.getElementById('reviewInputBox').value = '';
            
            // Restore user's preferred size for the text modal (desktop only)
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
        }
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

    window.addEventListener('dblclick', (e) => {
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

    // Helper: determine if a review is a real user-written review vs a placeholder
    const isRealReview = (review) => {
        if (!review || typeof review !== 'string') return false;
        const trimmed = review.trim();
        if (trimmed === '') return false;
        const lower = trimmed.toLowerCase();
        
        // Block known placeholders and system messages
        const placeholders = [
            'imported from letterboxd',
            'discord sync',
            'imported from discord',
            'automatically imported',
            'no review provided'
        ];
        
        if (placeholders.some(p => lower.includes(p))) return false;
        
        // Basic length check - a review should probably be at least a few characters
        // if it's supposed to be "real" content. 
        return trimmed.length > 5;
    };

    // ── Rating History Modal ──────────────────────────────────────────────────
    const ratingHistoryModal = document.getElementById('ratingHistoryModal');
    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    const historyBtn = document.getElementById('reviewHistoryBtn');

    if (closeHistoryModalBtn) {
        closeHistoryModalBtn.onclick = () => ratingHistoryModal.classList.remove('show');
    }
    window.addEventListener('dblclick', (e) => {
        if (e.target === ratingHistoryModal) ratingHistoryModal.classList.remove('show');
    });

    // ── Quick Info Modal ──────────────────────────────────────────────────────
    const quickInfoModal = document.getElementById('quickInfoModal');
    document.getElementById('closeQuickInfoBtn').onclick = () => quickInfoModal.classList.remove('show');
    window.addEventListener('dblclick', (e) => {
        if (e.target === quickInfoModal) quickInfoModal.classList.remove('show');
    });

    window.openQuickInfo = (item) => {
        // Title & Year
        document.getElementById('quickInfoTitle').textContent = item.title;
        document.getElementById('quickInfoYear').textContent = item.release_year ? `${item.release_year}` : '';

        // --- Ranking Ribbon ---
        const ribbon = document.getElementById('quickInfoRibbon');
        const rankKey = (item.title + '|' + item.type).toLowerCase();
        const rank = rankMap[rankKey];
        if (rank) {
            ribbon.style.display = 'flex';
            ribbon.textContent = `#${rank}`;
            // Color: gold=1, silver=2, bronze=3, accent=4+
            ribbon.className = 'rank-ribbon';
            if (rank === 1)      ribbon.classList.add('ribbon-gold');
            else if (rank === 2) ribbon.classList.add('ribbon-silver');
            else if (rank === 3) ribbon.classList.add('ribbon-bronze');
            else                 ribbon.classList.add('ribbon-ranked');
        } else {
            ribbon.style.display = 'none';
            ribbon.className = 'rank-ribbon';
        }

        // Rating — prefer numeric score over rank string
        let ratingStr = item.numeric_rating || item.rating || '';
        // Remove existing /10 if present to avoid double display
        let rawScore = (!ratingStr.startsWith('#')) ? ratingStr.toString().replace('/10', '').trim() : (item.numeric_rating || '');
        document.getElementById('quickInfoRating').textContent = rawScore ? `${rawScore} / 10` : '';

        // Edit Button (Admin Only)
        const editBtn = document.getElementById('quickInfoEditBtn');
        const ratingEditSection = document.getElementById('quickInfoRatingEditSection');
        const ratingInput = document.getElementById('quickInfoRatingInput');
        const yearInput = document.getElementById('quickInfoYearInput');
        const titleInput = document.getElementById('quickInfoTitleInput');
        const saveAllBtn = document.getElementById('quickInfoSaveAllBtn');

        if (computeCanEdit()) {
            editBtn.style.display = 'block';
            editBtn.onclick = () => {
                quickInfoModal.classList.remove('show');
                window.openReviewModal(item.title, item.type, item.review, item.id);
            };

            // Rating & Metadata Override UI
            ratingEditSection.style.display = 'block';
            ratingInput.value = rawScore || '';
            yearInput.value = item.release_year || '';
            titleInput.value = item.title || '';

            saveAllBtn.onclick = async () => {
                let newRating = parseFloat(ratingInput.value);
                const newYear = yearInput.value.trim();
                const newTitle = titleInput.value.trim();
                
                const payload = {};
                if (!isNaN(newRating)) {
                    // Snap to nearest 0.5
                    newRating = Math.round(newRating * 2) / 2;
                    payload.rating = newRating.toString();
                }
                if (newYear) {
                    payload.release_year = newYear;
                }
                if (newTitle) {
                    payload.title = newTitle;
                }
                
                if (Object.keys(payload).length === 0) return;
                
                saveAllBtn.disabled = true;
                saveAllBtn.textContent = 'Saving...';
                
                try {
                    const res = await fetch(`/api/media/update/${item.id}`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.ok) {
                        let msg = "Changes saved!";
                        if (data.needs_reenrich) {
                            msg += "\n\nTitle/Year changed. Re-enrichment has been triggered in the background to find the correct official match.";
                        }
                        alert(msg);
                        quickInfoModal.classList.remove('show');
                        fetchMedia(); // Refresh data
                    } else {
                        alert("Failed to update: " + (data.detail || "Unknown error"));
                    }
                } catch (e) {
                    alert("Error updating: " + e.message);
                } finally {
                    saveAllBtn.disabled = false;
                    saveAllBtn.textContent = 'Save Changes';
                }
            };

            // Metadata Repair v219
            const refreshBtn = document.getElementById('quickInfoRefreshBtn');
            const showLinkBtn = document.getElementById('quickInfoShowLinkBtn');
            const linkSection = document.getElementById('quickInfoLinkSubSection');
            const linkInput = document.getElementById('quickInfoExtIdInput');
            const linkSubmitBtn = document.getElementById('quickInfoLinkSubmitBtn');

            linkSection.style.display = 'none'; // Reset state

            refreshBtn.onclick = async () => {
                if (!confirm("This will force-refresh all metadata (Poster, Title, Author) from the official sources. Continue?")) return;
                
                refreshBtn.disabled = true;
                refreshBtn.textContent = 'Syncing...';
                
                try {
                    const res = await fetch(`/api/media/refresh/${item.id}`, {
                        method: 'POST',
                        headers: getAuthHeaders()
                    });
                    const data = await res.json();
                    if (data.ok) {
                        alert(`Metadata Synced! Entry is now officially linked and titled.`);
                        quickInfoModal.classList.remove('show');
                        fetchMedia(); // Refresh UI
                    } else {
                        alert("Sync Failed: " + (data.detail || "Check console"));
                    }
                } catch (e) {
                    alert("Error syncing: " + e.message);
                } finally {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = 'Sync with Official';
                }
            };

            showLinkBtn.onclick = () => {
                const isHidden = linkSubSection.style.display === 'none';
                linkSubSection.style.display = isHidden ? 'block' : 'none';
                if (isHidden) {
                    // Auto-open search page for the user
                    let searchUrl = "";
                    if (item.type === "Manga") {
                        searchUrl = `https://myanimelist.net/manga.php?q=${encodeURIComponent(item.title)}`;
                    } else {
                        searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(item.title)}`;
                    }
                    window.open(searchUrl, '_blank');
                }
            };

            applyLinkBtn.onclick = async () => {
                const extId = parseInt(linkInput.value);
                if (isNaN(extId)) return alert("Please enter a valid numeric ID.");
                
                applyLinkBtn.disabled = true;
                applyLinkBtn.textContent = 'Linking...';
                
                try {
                    const res = await fetch(`/api/media/manual-link/${item.id}`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ ext_id: extId })
                    });
                    const data = await res.json();
                    if (data.ok) {
                        alert("Item linked! Metadata will be updated shortly.");
                        quickInfoModal.classList.remove('show');
                        fetchMedia();
                    } else {
                        alert("Failed to link: " + (data.detail || "Unknown error"));
                    }
                } catch (e) {
                    alert("Error linking: " + e.message);
                } finally {
                    applyLinkBtn.disabled = false;
                    applyLinkBtn.textContent = 'Apply Link';
                }
            };

        } else {
            editBtn.style.display = 'none';
            ratingEditSection.style.display = 'none';
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

        // --- Movie-only metadata (content_rating, runtime) ---
        const metaEl = document.getElementById('quickInfoMeta');
        const isMovie = (item.type === 'Movies');
        const hasChipMeta = isMovie && (item.content_rating || item.runtime);
        metaEl.style.display = hasChipMeta ? 'flex' : 'none';

        const crEl = document.getElementById('quickInfoContentRating');
        crEl.textContent = item.content_rating || '';
        crEl.style.display = item.content_rating ? 'inline-flex' : 'none';

        const rtEl = document.getElementById('quickInfoRuntime');
        if (item.runtime) {
            const h = Math.floor(item.runtime / 60);
            const m = item.runtime % 60;
            rtEl.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
            rtEl.style.display = 'inline-flex';
        } else {
            rtEl.style.display = 'none';
        }

        // --- Director / Creator — exclusive labeled section ---
        const dirSection = document.getElementById('quickInfoDirectorSection');
        const dirLabel = dirSection.querySelector('.director-label');
        const dirEl = document.getElementById('quickInfoDirector');
        
        if (item.director) {
            dirEl.textContent = item.director;
            let label = 'Created by';
            if (isMovie) label = 'Directed by';
            if (item.type === 'Manga') label = 'Written by';
            dirLabel.textContent = label;
            dirSection.style.display = 'flex';
        } else {
            dirSection.style.display = 'none';
        }

        // Review
        const reviewEl = document.getElementById('quickInfoReview');
        let reviewText = item.review || '';
        // Strip legacy import markers
        reviewText = reviewText.replace(/Imported from Discord/gi, '').trim();
        const hasReview = isRealReview(reviewText);
        reviewEl.textContent = hasReview ? reviewText : '';

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

    window.addEventListener('dblclick', (e) => {
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
            populateGenreFilters();
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
    // Toggle like on a media item (optimistic UI)
    // Toggle like on a media item (optimistic UI)
    const toggleLike = async (itemId) => {
        // Update local cache immediately
        // Use == to handle potential string vs number ID comparison
        const itemIdx = allMedia.findIndex(m => m.id == itemId);
        if (itemIdx === -1) return;
        
        const item = allMedia[itemIdx];
        const newState = !item.is_liked;
        const targetTitle = item.title;
        const targetType = item.type;

        // Backend cascades by title + type, so we must update ALL matching items in cache
        allMedia.forEach(m => {
            if (m.title === targetTitle && m.type === targetType) {
                m.is_liked = newState;
            }
        });

        // Update ALL elements representing this item in the DOM
        const allMatchingTiles = document.querySelectorAll(`[data-item-id]`);
        allMatchingTiles.forEach(el => {
            const elId = el.getAttribute('data-item-id');
            const cachedItem = allMedia.find(m => m.id == elId);
            
            if (cachedItem && cachedItem.title === targetTitle && cachedItem.type === targetType) {
                // Find either like-btn (rankings) or like-btn-inline (cards)
                const likeBtn = el.querySelector('.like-btn, .like-btn-inline');
                if (likeBtn) {
                    if (newState) {
                        likeBtn.classList.add('liked');
                        likeBtn.innerHTML = '♥';
                        likeBtn.title = 'Unlike';
                    } else {
                        likeBtn.classList.remove('liked');
                        likeBtn.innerHTML = '♡';
                        likeBtn.title = 'Mark as personally liked';
                        
                        if (currentSubTab === 'Liked') {
                            el.style.opacity = '0';
                            el.style.transform = 'scale(0.9)';
                            el.style.transition = 'all 0.3s ease';
                            setTimeout(() => el.remove(), 300);
                        }
                    }
                }
            }
        });

        // Fire and forget (or handle error)
        try {
            const res = await fetch(`/api/media/like/${itemId}`, { 
                method: 'POST',
                headers: getAuthHeaders(false)
            });
            if (!res.ok) {
                console.error('Failed to toggle like');
                fetchMedia(); // Force refresh on failure
            }
        } catch (err) {
            console.error('Error toggling like:', err);
            fetchMedia(); // Force refresh on failure
        }
    };

    const renderMedia = (items, isRankingRequired) => {
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
            } else if (filterState.likedOnly) {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">No liked ${currentCategory.toLowerCase()}s match your search or filter.</p>`;
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
        // This writes to the module-level rankMap so openQuickInfo can read it
        rankMap = {};
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
            const isDiscord = item.source.toLowerCase() === 'discord';
            const sourceBadgeClass = isDiscord ? 'source-badge source-discord' : 'source-badge';
            const sourceText = isDiscord ? 'discord' : 'manual'; 
            // Note: keeping 'discord' as a visual text for existing legacy items, but default to manual for others.

            if (isRankingRequired) {
                // Podium Logic (1, 2, 3)
                if (index === 0) {
                    const top3 = items.slice(0, 3);
                    const podiumContainer = document.createElement('div');
                    podiumContainer.className = 'ranking-podium stagger-in';
                    
                    const renderPodiumItem = (podiumItem, rankPos) => {
                        if (!podiumItem) return '';
                        const fallbackImg = `<div class="podium-poster" style="background:#2b2b2b;display:flex;align-items:center;justify-content:center;color:#666;font-size:0.9rem;">No<br>Cover</div>`;
                        const posterHtml = podiumItem.cover_url ? `<img src="${podiumItem.cover_url}" class="podium-poster">` : fallbackImg;
                        const rankNum = parseInt((podiumItem.rating || '').replace('#', ''), 10) || rankPos;
                        return `
                            <div class="podium-item podium-rank-${rankPos}" data-item-id="${podiumItem.id}">
                                <div class="podium-badge">#${rankNum}</div>
                                ${posterHtml}
                                <div class="podium-title">${podiumItem.title}</div>
                                ${podiumItem.director ? `<div class="podium-director">${podiumItem.director}</div>` : ''}
                            </div>
                        `;
                    };

                    // Render Order: 2, 1, 3 for visual podium
                    podiumContainer.innerHTML = `
                        ${renderPodiumItem(top3[1], 2)}
                        ${renderPodiumItem(top3[0], 1)}
                        ${renderPodiumItem(top3[2], 3)}
                    `;

                    // Wire up podium click events
                    [top3[1], top3[0], top3[2]].forEach((it, idx) => {
                        if (!it) return;
                        const node = podiumContainer.children[idx];
                        node.addEventListener('click', (e) => {
                            e.stopPropagation();
                            window.openQuickInfo(it);
                        });
                    });

                    grid.appendChild(podiumContainer);
                }

                // Rich Row Logic (4+)
                if (index >= 3) {
                    const rankNum = parseInt((item.rating || '').replace('#', ''), 10) || (index + 1);
                    const row = document.createElement('div');
                    row.className = 'ranking-row-rich stagger-in';
                    row.setAttribute('data-item-id', item.id);
                    row.style.animationDelay = `${(index - 3) * 0.02}s`;

                    const fallbackImg = `<div class="ranking-row-thumb-fallback">No<br>Cover</div>`;
                    const posterHtml = item.cover_url ? `<img src="${item.cover_url}" class="ranking-row-thumb">` : fallbackImg;

                    let metaStr = [];
                    if (item.director) metaStr.push(`${item.director}`);
                    if (item.genres) metaStr.push(item.genres.split(',').slice(0, 1).join(', '));
                    if (item.runtime) metaStr.push(`${item.runtime}m`);
                    if (item.content_rating) metaStr.push(item.content_rating);
                    const metaHtml = metaStr.length > 0 ? `<div class="ranking-row-meta">${metaStr.join(' • ')}</div>` : '';

                    const hasReview = isRealReview(item.review);
                    const canClickReview = hasReview || computeCanEdit();
                    let snippet = (item.review || '').replace(/Imported from Discord/gi, '').trim();
                    const reviewSnippet = hasReview ? `<div class="ranking-row-snippet">"${snippet.substring(0, 120)}${snippet.length > 120 ? '...' : ''}"</div>` : '';

                    row.innerHTML = `
                        <div class="ranking-row-rank">#${rankNum}</div>
                        ${posterHtml}
                        <div class="ranking-row-info">
                            <div class="ranking-row-title ${canClickReview ? 'clickable-review-trigger' : ''}" title="${item.title}">${item.title} ${item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : ''}</div>
                            ${metaHtml}
                            ${reviewSnippet}
                        </div>
                        <div class="ranking-row-actions">
                            ${hasReview ? `<span class="review-badge">Reviewed</span>` : ''}
                        </div>
                    `;

                    row.addEventListener('click', (e) => {
                        e.stopPropagation();
                        window.openQuickInfo(item);
                    });

                    const actionsDiv = row.querySelector('.ranking-row-actions');
                    
                    if (isAdminUnlocked || item.is_liked) {
                        const likeBtn = document.createElement('button');
                        likeBtn.className = `like-btn-inline${item.is_liked ? ' liked' : ''}`;
                        likeBtn.innerHTML = item.is_liked ? '♥' : '♡';
                        likeBtn.style.background = 'transparent';
                        likeBtn.style.border = 'none';
                        likeBtn.style.cursor = isAdminUnlocked ? 'pointer' : 'default';
                        likeBtn.style.fontSize = '1.2rem';
                        likeBtn.style.color = item.is_liked ? '#ff6b6b' : 'var(--text-muted)';
                        if (isAdminUnlocked) {
                            likeBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLike(item.id); });
                        } else {
                            likeBtn.style.pointerEvents = 'none';
                        }
                        actionsDiv.appendChild(likeBtn);
                    }

                    const delBtn = document.createElement('button');
                    delBtn.className = 'delete-btn';
                    delBtn.innerHTML = '&times;';
                    delBtn.style.background = 'transparent';
                    delBtn.style.border = 'none';
                    delBtn.style.cursor = 'pointer';
                    delBtn.style.fontSize = '1.5rem';
                    delBtn.style.color = '#ff6b6b';
                    delBtn.style.padding = '0 5px';
                    delBtn.title = 'Delete Entry';
                    delBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteMedia(item.id, item.title);
                    });
                    actionsDiv.appendChild(delBtn);

                    grid.appendChild(row);
                }

            } else {
                // Traditional Grid Block 
                const card = document.createElement('div');
                card.className = 'media-card stagger-in';
                card.setAttribute('data-item-id', item.id);
                card.style.animationDelay = `${index * 0.02}s`;
                
                const yearBadge = item.release_year ? `<span style="font-weight:300; opacity:0.7;">(${item.release_year})</span>` : '';
                const hasReview = isRealReview(item.review);
                const canClickReview = hasReview || computeCanEdit();

                const likedClass = item.is_liked ? 'liked' : '';
                const likedIcon = item.is_liked ? '♥' : '♡';

                // --- DUAL-DISPLAY PRIORITY LOGIC ---
                const ratingStr = String(item.rating || '').trim();
                const numRatingStr = String(item.numeric_rating || '').trim();
                
                const isRank = (s) => s.startsWith('#');
                const isValidVal = (s) => s && !['none', 'null', 'undefined', 'nan'].includes(s.toLowerCase());
                const isScore = (s) => isValidVal(s) && !isRank(s);

                // The "Prime" rating for the card center should ALWAYS be a score if possible
                let displayRating = '';
                if (isScore(ratingStr)) {
                    displayRating = ratingStr;
                } else if (isScore(numRatingStr)) {
                    displayRating = numRatingStr;
                } else if (isValidVal(ratingStr)) {
                    displayRating = ratingStr;
                } else if (isValidVal(numRatingStr)) {
                    displayRating = numRatingStr;
                }

                // The Rank Badge (#1) should always show the Rank string if we have one
                let rankFromFields = '';
                if (isRank(ratingStr)) rankFromFields = ratingStr;
                else if (isRank(numRatingStr)) rankFromFields = numRatingStr;
                
                // Final Check: Check the rankMap (from the Rankings tab) as a second source
                const rankKey = (item.title + '|' + item.type).toLowerCase();
                const globalRank = rankMap[rankKey];
                const finalRank = isValidVal(rankFromFields) ? rankFromFields : (globalRank ? `#${globalRank}` : '');

                card.innerHTML = `
                    <div class="card-header">
                        <h3 class="media-title ${canClickReview ? 'clickable-review-trigger' : ''}" data-id="${item.id}">${item.title} ${yearBadge}</h3>
                    </div>
                    ${item.genres ? `
                        <div class="genre-container">
                            ${item.genres.split(',').map(g => `<span class="genre-badge">${g.trim()}</span>`).join('')}
                        </div>
                    ` : ''}
                    ${(item.type === 'Movies' && item.director) ? `
                        <div class="director-container">
                            <span class="director-badge">Dir. ${item.director}</span>
                        </div>
                    ` : ''}
                    ${((item.type === 'TV Series' || item.type === 'Anime') && item.director) ? `
                        <div class="director-container">
                            <span class="director-badge">Creator: ${item.director}</span>
                        </div>
                    ` : ''}
                    ${(item.type === 'Manga' && item.director) ? `
                        <div class="director-container">
                            <span class="director-badge">Author: ${item.director}</span>
                        </div>
                    ` : ''}
                    <div class="card-badges">
                        <div class="badge-slot-left">
                            ${finalRank ? `<span class="card-rank-badge">★ ${finalRank}</span>` : ''}
                        </div>
                        <div class="badge-slot-right">
                            ${hasReview ? `<span class="review-badge">Reviewed</span>` : ''}
                        </div>
                    </div>

                    ${(isAdminUnlocked || item.is_liked) ? `
                        <div class="card-actions-row">
                            <button class="like-btn-inline ${likedClass}" 
                                    title="${isAdminUnlocked ? (item.is_liked ? 'Unlike' : 'Like') : ''}"
                                    style="${!isAdminUnlocked ? 'pointer-events: none; cursor: default;' : ''}">${likedIcon}</button>
                        </div>
                    ` : ''}
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
                const cardLikeBtn = card.querySelector('.like-btn-inline');
                if (cardLikeBtn && isAdminUnlocked) {
                    cardLikeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleLike(item.id);
                    });
                }

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
            </div>
        `
    };

    window.switchTab = (tab) => {
        currentTab = tab;
        const searchInput = document.getElementById('mediaSearchInput');
        if (searchInput) searchInput.value = '';
        currentSearch = '';
        currentFilter = 'All';
        
        const filterBtns = document.querySelectorAll('.filter-btn');
        filterBtns.forEach(btn => {
            if (btn.dataset.filter === 'All') btn.classList.add('active');
            else btn.classList.remove('active');
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        fetchMedia();
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
                
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        function setupDevConsole() {


            const enrichBtn = document.getElementById('triggerEnrichBtn');
            const wrapper = document.getElementById('consoleWrapper');
            const log = document.getElementById('consoleLog');
            const spinner = document.getElementById('consoleSpinner');

            if (enrichBtn) enrichBtn.onclick = async () => {
                wrapper.style.display = 'block';
                spinner.style.display = 'block';
                log.innerHTML = '<div style="color: #64b4ff;">[System] Initializing Metadata Enrichment...</div>';
                try {
                    const res = await fetch('/api/automation/enrich', { method: 'POST', headers: getAuthHeaders() });
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder("utf-8");
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');
                        lines.forEach(msg => {
                            if (!msg.trim()) return;
                            const line = document.createElement('div');
                            line.style.marginBottom = '2px';
                            line.innerText = msg;
                            if (msg.includes('Error')) line.style.color = '#ff6b6b';
                            if (msg.includes('Complete')) line.style.color = '#51cf66';
                            log.appendChild(line);
                            log.scrollTop = log.scrollHeight;
                        });
                    }
                    spinner.style.display = 'none';
                    const final = document.createElement('div');
                    final.style.marginTop = '10px';
                    final.style.paddingTop = '5px';
                    final.style.borderTop = '1px dashed #444';
                    final.style.color = '#fff';
                    final.innerText = `[System] Task "enrichment" completed.`;
                    log.appendChild(final);
                    log.scrollTop = log.scrollHeight;
                    fetchMedia();
                } catch (err) {
                    log.innerHTML += `<div style="color: #ff6b6b;">Request Error: ${err.message}</div>`;
                    spinner.style.display = 'none';
                }
            };
        }

        if (iBack) {
            iBack.addEventListener('click', () => {
                iDetail.style.display = 'none';
                iIntro.style.display = 'block';
            });
        }
        
        // Initialize Dev Console immediately
        setupDevConsole();
    }

    // Initialization
    updateCategoryTitleCount();
    updateTheme();
    window.updateAuthUI(); // Ensure auth UI is set before media loads
    fetchMedia().then(() => {
        updateCategoryTitleCount();
    });

    // --- Smart Scroll Navigation (v177) ---
    let lastScrollTop = 0;
    const header = document.querySelector('header');
    const bNav = document.querySelector('.bottom-nav');

    window.addEventListener('scroll', () => {
        let st = window.pageYOffset || document.documentElement.scrollTop;
        
        // Threshold to prevent flickering on tiny scrolls
        if (Math.abs(st - lastScrollTop) < 5) return;

        if (st > lastScrollTop && st > 80) {
            // Scrolling Down -> Hide Header, Show Footer
            header.classList.add('header-hidden');
            if (bNav) bNav.classList.remove('footer-hidden');
        } else if (st < lastScrollTop) {
            // Scrolling Up -> Show Header, Hide Footer
            header.classList.remove('header-hidden');
            if (bNav) bNav.classList.add('footer-hidden');
        }
        lastScrollTop = st <= 0 ? 0 : st;
    }, false);

    /* ==========================================================================
       RANKING MANAGER LOGIC (v206)
       ========================================================================== */

    const manageRankingsBtn = document.getElementById('manageRankingsBtn');
    const rankingManagerModal = document.getElementById('rankingManagerModal');
    const closeRankingManagerBtn = document.getElementById('closeRankingManagerBtn');
    const rankingList = document.getElementById('rankingList');
    const rankingSearchInput = document.getElementById('rankingSearchInput');
    const rankingSearchResults = document.getElementById('rankingSearchResults');
    const saveRankingsBtn = document.getElementById('saveRankingsBtn');

    let currentRankedItems = [];
    let sortableInstance = null;

    const updateRankingCounter = () => {
        const subtitle = document.getElementById('rankingManagerSubtitle');
        if (subtitle) {
            const count = currentRankedItems.length;
            const categoryDisplay = currentCategory.replace(/s$/, ''); // "Movie" instead of "Movies"
            subtitle.innerHTML = `Leaderboard Status for ${categoryDisplay}: <strong style="color: ${count === 20 ? '#51cf66' : 'var(--theme-accent)'}">${count}/20 slots filled</strong>`;
            
            if (saveRankingsBtn) {
                if (count === 20) {
                    saveRankingsBtn.style.opacity = '1';
                    saveRankingsBtn.style.cursor = 'pointer';
                } else {
                    saveRankingsBtn.style.opacity = '0.5';
                    saveRankingsBtn.style.cursor = 'not-allowed';
                }
            }
        }
    };

    const renderRankingList = () => {
        if (!rankingList) return;
        
        rankingList.innerHTML = currentRankedItems.map((item, index) => `
            <div class="ranking-item" data-id="${item.id}">
                <div class="ranking-item-handle">⠿</div>
                <span class="ranking-number">#${index + 1}</span>
                <div class="ranking-item-info">
                    <span class="ranking-item-title">${item.title}</span>
                    <span class="ranking-item-meta">${item.release_year || 'Unknown Year'} • ${currentCategory.replace(/s$/, '')}</span>
                </div>
                <div class="ranking-item-remove" title="Remove from Rankings" onclick="window.removeFromRankings(${item.id})">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                </div>
            </div>
        `).join('');
        
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(rankingList, {
            animation: 250,
            handle: '.ranking-item-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const newOrderIds = Array.from(rankingList.children).map(el => parseInt(el.getAttribute('data-id')));
                const reordered = [];
                newOrderIds.forEach(id => {
                    const found = currentRankedItems.find(it => it.id === id);
                    if (found) reordered.push(found);
                });
                currentRankedItems = reordered;
                renderRankingList();
            }
        });

        updateRankingCounter();
    };

    const openRankingManager = () => {
        if (!rankingManagerModal) return;
        
        currentRankedItems = allMedia
            .filter(item => {
                if (item.type.toLowerCase() !== currentCategory.toLowerCase()) return false;
                // Trim everything to catch " #9" or "9 "
                const r = String(item.rating || '').trim();
                const nr = String(item.numeric_rating || '').trim();
                return r.startsWith('#') || nr.startsWith('#');
            })
            .sort((a, b) => {
                const getRankNum = (it) => {
                    const r = String(it.rating || '').trim();
                    const nr = String(it.numeric_rating || '').trim();
                    const str = r.startsWith('#') ? r : (nr.startsWith('#') ? nr : '#999');
                    return parseInt(str.replace('#', '')) || 999;
                };
                
                const rankA = getRankNum(a);
                const rankB = getRankNum(b);
                
                if (rankA !== rankB) return rankA - rankB;
                // Tie-breaker: Alphabetical
                return a.title.localeCompare(b.title);
            });
        
        renderRankingList();
        rankingManagerModal.classList.add('show');
        rankingSearchInput.value = '';
        rankingSearchResults.innerHTML = '';
    };

    const closeRankingManager = () => {
        rankingManagerModal.classList.remove('show');
    };

    window.removeFromRankings = (id) => {
        currentRankedItems = currentRankedItems.filter(it => it.id !== id);
        renderRankingList();
    };

    window.addToRankings = (item) => {
        if (currentRankedItems.length >= 20) {
            alert('Your Top 20 list is full. Please remove an item before adding a new one.');
            return;
        }
        if (currentRankedItems.find(it => it.id === item.id)) {
            alert('Item is already in your rankings.');
            return;
        }
        currentRankedItems.push(item);
        renderRankingList();
        rankingSearchInput.value = '';
        rankingSearchResults.innerHTML = '';
    };

    if (manageRankingsBtn) {
        manageRankingsBtn.onclick = () => {
            // Block mobile/tablet access
            if (window.innerWidth < 1024) {
                alert("Elite Ranking Management is optimized for Desktop. Please use a laptop or PC to reorder your Top 20.");
                return;
            }
            openRankingManager();
        };
    }

    if (closeRankingManagerBtn) {
        closeRankingManagerBtn.onclick = closeRankingManager;
    }

    if (rankingSearchInput) {
        rankingSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query.length < 2) {
                rankingSearchResults.innerHTML = '';
                return;
            }
            
            const rankedTitles = new Set(currentRankedItems.map(it => it.title.toLowerCase().trim()));
            const matches = allMedia
                .filter(it => 
                    it.type.toLowerCase() === currentCategory.toLowerCase() &&
                    it.title.toLowerCase().includes(query) &&
                    !rankedTitles.has(it.title.toLowerCase().trim())
                )
                .slice(0, 10);
                
            rankingSearchResults.innerHTML = matches.map(it => {
                const safeTitle = it.title.replace(/'/g, "\\'");
                const itemJson = JSON.stringify({id: it.id, title: safeTitle, release_year: it.release_year});
                return `
                    <div class="ranking-search-item" onclick='window.addToRankings(${itemJson})'>
                        <div class="ranking-search-item-info">
                            <span class="ranking-search-item-title">${it.title}</span>
                            <span class="ranking-search-item-meta">${it.release_year || 'Unknown Year'}</span>
                        </div>
                        <div class="ranking-search-item-plus">+</div>
                    </div>
                `;
            }).join('');
        });
    }

    if (saveRankingsBtn) {
        saveRankingsBtn.onclick = async () => {
            if (currentRankedItems.length !== 20) {
                alert(`You currently have ${currentRankedItems.length}/20 items. You must have exactly 20 items to save your leaderboard.`);
                return;
            }

            const payload = {
                category: currentCategory,
                item_ids: currentRankedItems.map(it => it.id)
            };
            
            saveRankingsBtn.disabled = true;
            saveRankingsBtn.innerText = 'Saving...';
            
            try {
                const res = await fetch('/api/rankings/reorder', {
                    method: 'POST',
                    headers: getAuthHeaders(true),
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    closeRankingManager();
                    fetchMedia(); 
                } else {
                    const err = await res.json();
                    alert('Failed to save rankings: ' + (err.detail || 'Unknown error'));
                }
            } catch (e) {
                console.error('Error saving rankings:', e);
                alert('Error saving rankings.');
            } finally {
                saveRankingsBtn.disabled = false;
                saveRankingsBtn.innerText = 'Save New Order';
            }
        };
    }
});
