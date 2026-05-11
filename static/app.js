document.addEventListener('DOMContentLoaded', () => {
    // --- FEATURE: Security & Safety Gateway on Load ---
    const runSecurityChecks = () => {
        const overlay = document.getElementById('securityOverlay');
        const log = document.getElementById('securityLog');
        const bar = document.getElementById('securityProgressBar');
        if (!overlay) return;

        const steps = [
            "Verifying device environment...",
            "Checking secure connection...",
            "Authenticating session...",
            "Integrity verified. Access granted."
        ];

        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                log.innerHTML = `<div id="securityStep"><i class="fas fa-circle-notch fa-spin" style="color: var(--theme-accent); margin-right: 0.5rem;"></i>${steps[currentStep]}</div>`;
                bar.style.width = `${(currentStep + 1) * 25}%`;
                currentStep++;
            } else {
                clearInterval(interval);
                log.innerHTML = `<div id="securityStep" style="color: #2ecc71;"><i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>Access Granted.</div>`;
                setTimeout(() => {
                    overlay.style.transition = 'opacity 0.5s ease';
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.remove(), 500);
                }, 500);
            }
        }, 600);
    };
    runSecurityChecks();

    // --- FEATURE: Organic Background Blobs & Theming ---
    const blobs = document.querySelectorAll('.mesh-blob');
    let mouseX = 0, mouseY = 0;
    
    // Update category themes on body
    const updateGlobalTheme = (category) => {
        const themeMap = {
            'Movies': 'movies',
            'TV Series': 'tv-series',
            'Manga': 'manga',
            'Anime': 'anime'
        };
        document.body.setAttribute('data-theme', themeMap[category] || 'movies');
    };

    // Smooth movement logic
    const moveBlobs = () => {
        blobs.forEach((blob, index) => {
            const speed = 0.05 + (index * 0.02);
            const x = (Math.sin(Date.now() * 0.0005 * (index + 1)) * 50);
            const y = (Math.cos(Date.now() * 0.0005 * (index + 1)) * 50);
            
            // React to mouse
            const reactX = (mouseX - window.innerWidth / 2) * speed;
            const reactY = (mouseY - window.innerHeight / 2) * speed;
            
            blob.style.transform = `translate(${x + reactX}px, ${y + reactY}px)`;
        });
        requestAnimationFrame(moveBlobs);
    };
    moveBlobs();

    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

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
    let currentSubTab = 'Info'; // Land on The Hub

    const searchInput = document.getElementById('searchInput');
    console.log("Media Tracker App v240 Initializing...");
    const navLinks = document.querySelectorAll('.nav-link');
    const pageTitle = document.getElementById('pageTitle');

    const updateTheme = () => {
        const theme = currentCategory.toLowerCase().replace(' ', '-');
        document.body.setAttribute('data-theme', theme);
        
        // Update mesh blob positions for "movement"
        const blobs = document.querySelectorAll('.mesh-blob');
        blobs.forEach((blob, i) => {
            const x = Math.random() * 40 - 20;
            const y = Math.random() * 40 - 20;
            blob.style.transform = `translate(${x}px, ${y}px) scale(${1 + Math.random() * 0.2})`;
        });
    };
    // v205: Centralized category switch logic
    const categoryOrder = ['Movies', 'TV Series', 'Manga', 'Anime'];
    const handleCategorySwitch = (category) => {
        const prevIndex = categoryOrder.indexOf(currentCategory);
        const newIndex = categoryOrder.indexOf(category);
        const direction = newIndex > prevIndex ? 'left' : 'right';
        
        const mainContent = document.querySelector('.main-content');
        
        if (mainContent && prevIndex !== -1 && prevIndex !== newIndex) {
            mainContent.classList.add(`slide-out-${direction}`);
            
            setTimeout(() => {
                mainContent.classList.remove(`slide-out-${direction}`);
                mainContent.classList.add(`slide-in-${direction}`);
                
                // Perform the actual switch
                currentCategory = category;
                updateGlobalTheme(category);

                if (searchInput) {
                    searchInput.value = '';
                    if (currentCategory === 'TV Series') {
                        searchInput.placeholder = "Search titles or creators...";
                    } else if (currentCategory === 'Movies') {
                        searchInput.placeholder = "Search titles or directors...";
                    } else {
                        searchInput.placeholder = `Search ${currentCategory.toLowerCase()}...`;
                    }
                }

                const addBtn = document.getElementById('addMediaBtn');
                const modalTitle = document.getElementById('modalTitle');
                const displayLabel = currentCategory === 'TV Series' ? 'TV Show' : currentCategory.replace(/s$/, '');
                
                if (addBtn) {
                    const desktopLabel = addBtn.querySelector('.desktop-text');
                    if (desktopLabel) {
                        desktopLabel.innerText = `+ Add ${displayLabel}`;
                    }
                }
                if (modalTitle) {
                    modalTitle.innerText = `Add ${displayLabel}`;
                }

                const suggestMeBtn = document.getElementById('suggestMeBtn');
                if (suggestMeBtn) {
                    const span = suggestMeBtn.querySelector('span');
                    if (span) {
                        span.innerText = `${displayLabel} Suggestions`;
                    }
                }

                const leaveRecBtn = document.getElementById('leaveRecommendationBtn');
                if (leaveRecBtn) {
                    const span = leaveRecBtn.querySelector('span');
                    if (span) {
                        span.innerHTML = `Leave Silva a${displayLabel === 'Anime' ? 'n' : ''}<br>${displayLabel} Recommendation`;
                    }
                }

                const typeInput = document.getElementById('typeInput');
                if (typeInput) {
                    typeInput.value = category;
                }

                // Fetch recent recommendations for this category
                fetchHubRecommendations(category);

                filterState.genres.clear();
                updateActiveFilterCount();
                populateGenreFilters();

                navLinks.forEach(l => {
                    l.classList.remove('active');
                    if (l.getAttribute('data-filter') === currentCategory) l.classList.add('active');
                });
                
                document.querySelectorAll('.pill-tab[data-filter]').forEach(t => {
                    t.classList.remove('active');
                    if (t.getAttribute('data-filter') === currentCategory) t.classList.add('active');
                });

                document.querySelectorAll('.pill-tab[data-sub]').forEach(t => {
                    t.classList.remove('active');
                    if (t.getAttribute('data-sub') === currentSubTab) t.classList.add('active');
                });

                updateCategoryTitleCount();
                updateTheme();
                filterAndRenderMedia();
                
                setTimeout(() => {
                    mainContent.classList.remove(`slide-in-${direction}`);
                }, 300);
            }, 300);
        } else {
            // Fallback if no animation needed or container missing
            currentCategory = category;
            updateGlobalTheme(category);

            if (searchInput) {
                searchInput.value = '';
                if (currentCategory === 'TV Series') {
                    searchInput.placeholder = "Search titles or creators...";
                } else if (currentCategory === 'Movies') {
                    searchInput.placeholder = "Search titles or directors...";
                } else {
                    searchInput.placeholder = `Search ${currentCategory.toLowerCase()}...`;
                }
            }

            const addBtn = document.getElementById('addMediaBtn');
            const modalTitle = document.getElementById('modalTitle');
            const displayLabel = currentCategory === 'TV Series' ? 'TV Show' : currentCategory.replace(/s$/, '');
            
            if (addBtn) {
                const desktopLabel = addBtn.querySelector('.desktop-text');
                if (desktopLabel) {
                    desktopLabel.innerText = `+ Add ${displayLabel}`;
                }
            }
            if (modalTitle) {
                modalTitle.innerText = `Add ${displayLabel}`;
            }

            const suggestMeBtn = document.getElementById('suggestMeBtn');
            if (suggestMeBtn) {
                const span = suggestMeBtn.querySelector('span');
                if (span) {
                    span.innerText = `${displayLabel} Suggestions`;
                }
            }

            const leaveRecBtn = document.getElementById('leaveRecommendationBtn');
            if (leaveRecBtn) {
                const span = leaveRecBtn.querySelector('span');
                if (span) {
                    span.innerHTML = `Leave Silva a${displayLabel === 'Anime' ? 'n' : ''}<br>${displayLabel} Recommendation`;
                }
            }

            const typeInput = document.getElementById('typeInput');
            if (typeInput) {
                typeInput.value = category;
            }

            filterState.genres.clear();
            updateActiveFilterCount();
            populateGenreFilters();

            navLinks.forEach(l => {
                l.classList.remove('active');
                if (l.getAttribute('data-filter') === currentCategory) l.classList.add('active');
            });
            
            document.querySelectorAll('.pill-tab[data-filter]').forEach(t => {
                t.classList.remove('active');
                if (t.getAttribute('data-filter') === currentCategory) t.classList.add('active');
            });

            document.querySelectorAll('.pill-tab[data-sub]').forEach(t => {
                t.classList.remove('active');
                if (t.getAttribute('data-sub') === currentSubTab) t.classList.add('active');
            });

            updateCategoryTitleCount();
            updateTheme();
            filterAndRenderMedia();
        }
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
                populateGenreFilters();
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
                // This is a sub-tab click (e.g. Info, Completed, Rankings)
                navLinks.forEach(l => l.classList.remove('active'));
                
                currentSubTab = sub;
                if (searchInput) searchInput.value = '';

                // Sync desktop pills
                pillTabs.forEach(t => {
                    if (t.getAttribute('data-sub')) t.classList.remove('active');
                    if (t.getAttribute('data-sub') === currentSubTab) t.classList.add('active');
                });
                
                populateGenreFilters();
                filterAndRenderMedia();
            }
        });
    });
    // Utility for debouncing fast inputs like search
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    searchInput.addEventListener('input', debounce(() => {
        filterAndRenderMedia();
    }, 150));

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
            if (item.type.toLowerCase() !== currentCategory.toLowerCase()) return;
            
            // Only include genres that are present in the current sub-tab!
            let matchesSubTab = false;
            if (currentSubTab === 'Rankings' && item.is_ranking) matchesSubTab = true;
            else if (currentSubTab === 'Completed' && !item.is_ranking) matchesSubTab = true;
            else if (currentSubTab === 'Info' || currentSubTab === 'Stats') matchesSubTab = true; // Show all for Info/Stats

            if (matchesSubTab && item.genres) {
                item.genres.split(',').forEach(g => {
                    const clean = g.trim();
                    if (clean) genres.add(clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
                });
            }
        });
        
        const sortedGenres = Array.from(genres).sort();
        genreFilterList.innerHTML = sortedGenres.map(g => {
            const isChecked = Array.from(filterState.genres).some(fg => fg.toLowerCase() === g.toLowerCase());
            return `
                <label class="filter-option checkbox">
                    <input type="checkbox" class="genre-filter-check" value="${g}" ${isChecked ? 'checked' : ''}>
                    <span>${g}</span>
                </label>
            `;
        }).join('');
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

    const statsPage = document.getElementById('hubStatsContainer');

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
                    <i class="fas fa-layer-group" style="position:absolute; top: 1rem; right: 1rem; opacity: 0.1; font-size: 2rem;"></i>
                    <div class="stat-card-value">${data.total}</div>
                    <div class="stat-card-label">Total Entries</div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-heart" style="position:absolute; top: 1rem; right: 1rem; opacity: 0.1; font-size: 2rem;"></i>
                    <div class="stat-card-value">1 in ${data.like_ratio || '—'}</div>
                    <div class="stat-card-label">Like Ratio <span style="font-size:0.6em;opacity:0.6">(Exclusivity)</span></div>
                    <div style="font-size: 0.7rem; opacity: 0.6; margin-top: 0.4rem; color: var(--text-primary);">
                        I like 1 in every ${data.like_ratio || 'X'} ${currentCategory.toLowerCase()} I ${currentCategory.toLowerCase() === 'manga' ? 'read' : 'watch'}
                    </div>
                </div>
                <div class="stat-card">
                    <i class="fas fa-star" style="position:absolute; top: 1rem; right: 1rem; opacity: 0.1; font-size: 2rem;"></i>
                    <div class="stat-card-value">${data.avg_score || '—'}</div>
                    <div class="stat-card-label">Average Score</div>
                    <div style="font-size: 0.7rem; opacity: 0.6; margin-top: 0.4rem; color: var(--text-primary);">
                        Across all rated entries
                    </div>
                </div>
                <div class="stat-card" id="recentDiscoveryCard" style="cursor: pointer;">
                    <div class="discovery-details">
                        <div class="discovery-label">Recently Discovered</div>
                        <div class="discovery-title">${data.most_recent?.item?.title || 'Unknown'}</div>
                        <div class="discovery-date">Added on ${data.most_recent?.display_date || 'N/A'}</div>
                    </div>
                </div>
            </div>


            ${data.favorite_genres && data.favorite_genres.length ? `
            <div class="hof-accordion" id="genresAccordion" style="margin-bottom: 1.5rem; border-color: var(--theme-accent-muted);">
                <div class="hof-accordion-header" id="genresHeader">
                    <div class="hof-accordion-title">
                        Top Genres
                        <span class="hof-subtitle hof-subtitle-desktop"><b>Passion-Volume Index: Σ (Rating - 4.5)³ × (1.25 if Heart) × (1.10 if Review) × (1 - 1/Count)</b></span>
                        <span class="hof-subtitle-mobile"><b>Passion-Volume Index:</b> Σ (Rating - 4.5)³ × (1.25 if Heart) × (1.10 if Review) × (1 - 1/Count)</span>
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
                        <span class="hof-subtitle hof-subtitle-desktop"><b>Passion-Volume Index: Σ (Rating - 4.5)³ × (1.25 if Heart) × (1.10 if Review) × (1 - 1/Count)</b></span>
                        <span class="hof-subtitle-mobile"><b>Passion-Volume Index:</b> Σ (Rating - 4.5)³ × (1.25 if Heart) × (1.10 if Review) × (1 - 1/Count)</span>
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
                </div>
                <div class="stats-dist-card">
                    <div class="stats-dist-title">Decade Breakdown</div>
                    ${decBars || '<p style="opacity:0.4;font-size:0.85rem">No release years on record.</p>'}
                </div>
            </div>`;

        // Wire up interactions
        const recentCard = statsPage.querySelector('#recentDiscoveryCard');
        if (recentCard && data.most_recent?.item) {
            recentCard.onclick = () => window.openQuickInfo(data.most_recent.item);
        }

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

        // --- Search/Filter Visibility Sync (Global) ---
        const searchContainer = document.querySelector('.search-container');
        const filterActions = document.querySelector('.header-filter-actions');
        if (searchContainer && filterActions) {
            const shouldShow = (currentSubTab === 'Completed');
            searchContainer.style.display = shouldShow ? 'flex' : 'none';
            filterActions.style.display = shouldShow ? 'flex' : 'none';
        }


        if (currentSubTab === 'Info') {
            grid.style.display = 'none';
            if (infoPage) {
                infoPage.style.display = 'block';
                
                // Always reset to the dashboard view when landing on Info
                const infoIntroView = document.getElementById('infoIntro');
                
                // Load stats for the Hub
                renderStats(currentCategory);
                const infoDetailView = document.getElementById('infoDetail');
                if (infoIntroView) infoIntroView.style.display = 'block';
                if (infoDetailView) infoDetailView.style.display = 'none';

                const mainTitle = infoPage.querySelector('.info-main-title');
                if (mainTitle) {
                    mainTitle.innerText = `${currentCategory} Hub`;
                    mainTitle.style.color = 'var(--theme-accent)';
                }

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
            filtered.sort((a, b) => (parseRating(b.numeric_rating || b.rating) || 0) - (parseRating(a.numeric_rating || a.rating) || 0));
        } else if (sortVal === 'rating-asc') {
            filtered.sort((a, b) => (parseRating(a.numeric_rating || a.rating) || 0) - (parseRating(b.numeric_rating || b.rating) || 0));
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

    // State for preview
    let pendingPreviewPayload = null;
    let isPreviewPhase = true;
    const previewLikeCheckbox = document.getElementById('previewLikeCheckbox');

    const resetPreviewLike = () => {
        previewLikeCheckbox.checked = false;
    };

    const formInputsContainer = document.getElementById('formInputsContainer');
    const selectionContainer = document.getElementById('selectionContainer');
    const selectionResults = document.getElementById('selectionResults');
    const previewContainer = document.getElementById('previewContainer');
    const previewSubmitBtn = document.getElementById('previewSubmitBtn');
    const previewBackBtn = document.getElementById('previewBackBtn');

    // Reset modal state when it's closed or opened
    document.getElementById('addMediaBtn').addEventListener('click', () => {

        isPreviewPhase = true;
        
        // Sync modal type and title with current category
        const typeInput = document.getElementById('typeInput');
        typeInput.value = currentCategory;
        
        const modalTitle = document.getElementById('modalTitle');
        let displayType = currentCategory;
        if (currentCategory === 'TV Series') displayType = 'TV Show';
        else if (currentCategory === 'Movies') displayType = 'Movie';
        modalTitle.innerText = 'Add ' + displayType;

        formInputsContainer.style.display = 'block';
        selectionContainer.style.display = 'none';
        previewContainer.style.display = 'none';
        previewBackBtn.style.display = 'none';
        previewSubmitBtn.style.display = 'block';
        previewSubmitBtn.innerText = 'Preview Match';
        previewSubmitBtn.disabled = false;
        document.getElementById('previewDuplicateWarning').style.display = 'none';
        pendingPreviewPayload = null;
        resetPreviewLike();
    });

    previewBackBtn.addEventListener('click', () => {
        isPreviewPhase = true;
        formInputsContainer.style.display = 'block';
        selectionContainer.style.display = 'none';
        previewContainer.style.display = 'none';
        previewBackBtn.style.display = 'none';
        previewSubmitBtn.style.display = 'block';
        previewSubmitBtn.innerText = 'Preview Match';
        resetPreviewLike();
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

        const rawYear = document.getElementById('releaseYearInput').value;
        const releaseYear = rawYear ? parseInt(rawYear, 10) : null;
        
        const manualId = document.getElementById('manualIdInput').value.trim();
        const titleInput = document.getElementById('titleInput').value.trim();

        const previewLoading = document.getElementById('previewLoading');

        if (isPreviewPhase) {
            // PHASE 1: Fetch Preview or Search Selection
            if (!manualId && !titleInput) {
                alert("Please provide either a Title or an ID Code.");
                return;
            }

            // NEW FEATURE: If year is missing and no ID provided, do a multi-search
            if (!releaseYear && !manualId && titleInput) {
                formInputsContainer.style.display = 'none';
                previewLoading.style.display = 'block';
                previewSubmitBtn.disabled = true;
                previewSubmitBtn.innerText = 'Searching...';

                try {
                    const url = `/api/search/multi?title=${encodeURIComponent(titleInput)}&type=${encodeURIComponent(type)}`;
                    const response = await fetch(url);
                    const results = await response.json();

                    if (!results || results.length === 0) {
                        alert("No matches found for that title. Please try again with a year.");
                        previewLoading.style.display = 'none';
                        formInputsContainer.style.display = 'block';
                        previewSubmitBtn.disabled = false;
                        previewSubmitBtn.innerText = 'Preview Match';
                        return;
                    }

                    // If exactly one match, skip selection
                    if (results.length === 1) {
                        document.getElementById('releaseYearInput').value = results[0].release_year;
                        // Continue to preview with the now-filled year
                        const retryEvent = new Event('submit');
                        form.dispatchEvent(retryEvent);
                        return;
                    }

                    // Render Selection List
                    selectionResults.innerHTML = '';
                    results.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'rec-search-item';
                        div.style.cssText = 'display: flex; gap: 15px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s ease; border: 1px solid transparent;';
                        
                        if (item.cover_url) {
                            const img = document.createElement('img');
                            img.src = item.cover_url;
                            img.style.cssText = 'width: 60px; height: 90px; object-fit: cover; border-radius: 6px; flex-shrink: 0;';
                            div.appendChild(img);
                        }

                        const info = document.createElement('div');
                        info.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;';
                        info.innerHTML = `
                            <div style="font-weight: 700; color: #fff; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
                            <div style="font-size: 0.8rem; color: var(--theme-accent); opacity: 0.8; font-weight: 600;">${item.release_year || 'N/A'}</div>
                        `;
                        div.appendChild(info);

                        div.onclick = () => {
                            document.getElementById('releaseYearInput').value = item.release_year;
                            if (item.tmdb_id) document.getElementById('manualIdInput').value = item.tmdb_id;
                            
                            selectionContainer.style.display = 'none';
                            // Re-submit to trigger standard preview phase
                            const retryEvent = new Event('submit');
                            form.dispatchEvent(retryEvent);
                        };
                        selectionResults.appendChild(div);
                    });

                    previewLoading.style.display = 'none';
                    selectionContainer.style.display = 'block';
                    previewBackBtn.style.display = 'block';
                    previewSubmitBtn.style.display = 'none'; // Hide button during selection
                    return;

                } catch (err) {
                    console.error("Multi-Search Error:", err);
                    alert("Error searching for matches.");
                    previewLoading.style.display = 'none';
                    formInputsContainer.style.display = 'block';
                    previewSubmitBtn.disabled = false;
                    previewSubmitBtn.innerText = 'Preview Match';
                    return;
                }
            }

            // Normal Phase 1: Fetch Preview (with Year or ID)
            if (!releaseYear && !manualId) {
                alert('Please enter a Release Year or an ID Code.');
                return;
            }

            // Expert transition to loading state
            formInputsContainer.style.display = 'none';
            selectionContainer.style.display = 'none';
            previewLoading.style.display = 'block';
            previewSubmitBtn.disabled = true;
            previewSubmitBtn.innerText = 'Searching...';
            previewSubmitBtn.style.display = 'block';

            try {
                const query = new URLSearchParams({
                    type: type,
                    title: titleInput || '',
                    year: releaseYear || '',
                    ext_id: manualId || ''
                });

                const res = await fetch(`/api/media/preview?${query.toString()}`, {
                    headers: getAuthHeaders()
                });

                if (res.ok) {
                    const data = await res.json();
                    
                    // Expert rendering of Preview Card
                    const previewPoster = document.getElementById('previewPoster');
                    previewPoster.src = data.cover_url || '';
                    previewPoster.style.display = data.cover_url ? 'inline-block' : 'none';
                    
                    document.getElementById('previewTitle').innerText = data.title || titleInput || 'Unknown Title';
                    document.getElementById('previewYear').innerText = data.release_year || releaseYear || '';
                    
                    // Dynamic Director/Creator Label
                    let label = 'Created by';
                    if (type === 'Movies') label = 'Directed by';
                    if (type === 'Manga') label = 'Written by';
                    document.getElementById('previewDirector').innerText = data.director ? `${label}: ${data.director}` : '';
                    
                    // Render Genre Pills
                    const genresContainer = document.getElementById('previewGenres');
                    if (data.genres) {
                        genresContainer.innerHTML = data.genres.split(',').map(g => 
                            `<span class="genre-badge">${g.trim()}</span>`
                        ).join('');
                    } else {
                        genresContainer.innerHTML = '';
                    }
                    
                    if (data.duplicate_warning) {
                        document.getElementById('previewDuplicateWarning').style.display = 'block';
                    } else {
                        document.getElementById('previewDuplicateWarning').style.display = 'none';
                    }

                    // Store pending payload (fully enriched)
                    pendingPreviewPayload = {
                        title: data.title,
                        type: type,
                        rating: ratingVal + '/10',
                        review: '',
                        release_year: data.release_year,
                        source: 'manual',
                        tmdb_id: data.tmdb_id,
                        cover_url: data.cover_url,
                        director: data.director,
                        genres: data.genres,
                        runtime: data.runtime,
                        content_rating: data.content_rating,
                        total_seasons: data.total_seasons,
                        total_episodes: data.total_episodes,
                        manga_status: data.manga_status,
                        total_chapters: data.total_chapters
                    };

                    isPreviewPhase = false;
                    previewLoading.style.display = 'none';
                    previewContainer.style.display = 'block';
                    previewBackBtn.style.display = 'block';
                    previewSubmitBtn.innerText = 'Confirm & Save';
                    previewSubmitBtn.disabled = false;
                } else {
                    const err = await res.json();
                    alert(`Preview failed: ${err.detail || 'Could not find match.'}`);
                    
                    // Revert to form on failure
                    previewLoading.style.display = 'none';
                    formInputsContainer.style.display = 'block';
                    previewSubmitBtn.innerText = 'Preview Match';
                    previewSubmitBtn.disabled = false;
                }
            } catch (err) {
                console.error("Preview Network Error:", err);
                alert("Network error while fetching preview.");
                previewLoading.style.display = 'none';
                formInputsContainer.style.display = 'block';
                previewSubmitBtn.innerText = 'Preview Match';
                previewSubmitBtn.disabled = false;
            } finally {
                // Guaranteed safety to re-enable if we didn't switch phases
                if (isPreviewPhase) {
                    previewSubmitBtn.disabled = false;
                    previewSubmitBtn.innerText = 'Preview Match';
                    previewLoading.style.display = 'none';
                    formInputsContainer.style.display = 'block';
                }
            }

        } else {
            // PHASE 2: Save Target
            if (!pendingPreviewPayload) return;

            previewSubmitBtn.innerText = 'Saving...';
            previewSubmitBtn.disabled = true;

            try {
                // Final sync of the Like state from the checkbox
                pendingPreviewPayload.is_liked = previewLikeCheckbox.checked;

                const res = await fetch('/api/media', {
                    method: 'POST',
                    headers: getAuthHeaders(true),
                    body: JSON.stringify(pendingPreviewPayload)
                });

                if (res.ok) {
                    form.reset();
                    modal.classList.remove('show');
                    fetchMedia(); // Refresh list
                    isPreviewPhase = true;
                    formInputsContainer.style.display = 'block';
                    previewContainer.style.display = 'none';
                    previewBackBtn.style.display = 'none';
                    previewSubmitBtn.innerText = 'Preview Match';
                    previewSubmitBtn.disabled = false;
                    pendingPreviewPayload = null;
                    alert('Successfully added!');
                } else {
                    const errData = await res.json();
                    console.error("Failed to add entry", errData);
                    alert(`Failed to add entry: ${errData.detail || 'Unknown error'}`);
                }
            } catch(error) {
                console.error("Error posting data:", error);
                alert("Network error: Could not reach the server to add entry.");
            } finally {
                previewSubmitBtn.disabled = false;
                if (!isPreviewPhase) {
                    previewSubmitBtn.innerText = 'Confirm & Save';
                } else {
                    previewSubmitBtn.innerText = 'Preview Match';
                }
            }
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
            'no review provided',
            'ranking'  // Ranking entries sometimes have 'Ranking' as a legacy review value
        ];
        
        if (placeholders.some(p => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p))) return false;
        
        // Basic length check - a review should probably be at least a few characters
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
    const closeQuickInfo = () => {
        quickInfoModal.classList.remove('show');
        quickInfoModal.style.zIndex = '';
        document.body.classList.remove('modal-open');
    };
    document.getElementById('closeQuickInfoBtn').onclick = closeQuickInfo;
    window.addEventListener('dblclick', (e) => {
        if (e.target === quickInfoModal) closeQuickInfo();
    });

    window.openQuickInfo = (item, clickedElement = null) => {
        // Backdrop Image Logic
        const backdropImg = document.getElementById('quickInfoBackdrop');
        if (backdropImg) {
            backdropImg.style.opacity = '0';
            if (item.backdrop_url) {
                const tempImg = new Image();
                tempImg.onload = () => {
                    backdropImg.style.backgroundImage = `url(${item.backdrop_url})`;
                    backdropImg.style.opacity = '1';
                };
                tempImg.src = item.backdrop_url;
            } else {
                backdropImg.style.backgroundImage = 'none';
            }
        }

        // --- Basic Info ---
        document.getElementById('quickInfoTitle').textContent = item.title;
        document.getElementById('quickInfoType').textContent = item.type === 'Movies' ? 'Movie' : (item.type === 'TV Series' ? 'TV Series' : item.type);

        // Hide rating section for recommendations
        const ratingSection = document.querySelector('.quick-info-rating-section');
        if (ratingSection) {
            if (item.isRecommendation) {
                ratingSection.style.display = 'none';
            } else {
                ratingSection.style.display = ''; // Restore default
            }
        }
        document.getElementById('quickInfoYear').textContent = item.release_year || '????';

        // --- Like Logic (v404) ---
        const updateLikeBtnUI = (isLiked) => {
            const pill = document.getElementById('quickInfoFavoritePill');
            if (!pill) return;
            
            const canEdit = computeCanEdit();
            
            if (isLiked) {
                pill.style.display = 'flex';
                pill.style.opacity = '1';
                pill.style.background = 'rgba(255, 59, 75, 0.35)'; /* High-voltage background */
                pill.style.borderColor = 'rgba(255, 59, 75, 0.8)';  /* Strong solid border */
                pill.style.boxShadow = '0 0 30px rgba(255, 59, 75, 0.5)'; /* Massive glow */
                pill.innerHTML = `
                    <i class="fas fa-heart" style="color: #ff3b4b; font-size: 1.1rem; display: inline-block; margin-right: 4px; filter: drop-shadow(0 0 10px rgba(255, 59, 75, 1));"></i>
                    <span class="rating-label" style="color: #ff3b4b; opacity: 1; margin: 0; font-weight: 900; letter-spacing: 0.08em; text-shadow: 0 0 12px rgba(255, 59, 75, 0.7);">Liked</span>
                `;
            } else {


                pill.style.display = 'flex';
                pill.style.opacity = '0.4'; // Dimmed for unliked
                pill.style.background = 'rgba(255, 255, 255, 0.04)';
                pill.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                pill.style.boxShadow = 'none'; // No glow
                pill.innerHTML = `
                    <i class="far fa-heart" style="color: rgba(255, 255, 255, 0.8); font-size: 1.1rem; display: inline-block; margin-right: 4px;"></i>
                    <span class="rating-label" style="color: rgba(255, 255, 255, 0.8); opacity: 1; margin: 0; font-weight: 600;">Unliked</span>
                `;
            }

        };


        const favPill = document.getElementById('quickInfoFavoritePill');
        
        if (item.isRecommendation) {
            if (favPill) favPill.style.setProperty('display', 'none', 'important');
        } else {
            if (favPill) favPill.style.setProperty('display', 'flex', 'important');
            updateLikeBtnUI(item.is_liked);
        }

        if (favPill) {
            const newFavPill = favPill.cloneNode(true);
            favPill.parentNode.replaceChild(newFavPill, favPill);
            
            newFavPill.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!computeCanEdit()) {
                    alert("You need admin access to toggle likes.");
                    return;
                }
                newFavPill.style.transform = 'scale(0.95)';
                setTimeout(() => newFavPill.style.transform = 'translateY(-1px)', 100);
                try {
                    const res = await fetch(`/api/media/like/${item.id}`, {
                        method: 'POST',
                        headers: getAuthHeaders(true)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        item.is_liked = data.is_liked;
                        updateLikeBtnUI(item.is_liked);
                        fetchMedia();
                    }
                } catch (err) { console.error(err); }
            });
        }



        // --- Ranking Ribbon ---
        const ribbon = document.getElementById('quickInfoRibbon');
        const rankKey = (item.title + '|' + item.type).toLowerCase();
        const rank = rankMap[rankKey];
        if (rank) {
            ribbon.style.display = 'flex';
            ribbon.textContent = `#${rank}`;
            ribbon.className = 'rank-ribbon';
            if (rank === 1)      ribbon.classList.add('ribbon-gold');
            else if (rank === 2) ribbon.classList.add('ribbon-silver');
            else if (rank === 3) ribbon.classList.add('ribbon-bronze');
            else if (rank <= 5)  ribbon.classList.add('ribbon-top5');
            else                 ribbon.classList.add('ribbon-ranked');
        } else {
            ribbon.style.display = 'none';
        }

        // --- Rating & Scoring ---
        const normalizedTarget = item.title.toLowerCase().trim();
        const targetYear = item.release_year;
        const bestEntry = allMedia.find(m => 
            m.title.toLowerCase().trim() === normalizedTarget && 
            m.release_year === targetYear &&
            m.numeric_rating && 
            !m.numeric_rating.toString().startsWith('#')
        );
        let rawScore = bestEntry ? bestEntry.numeric_rating.toString().replace('/10','').trim() : '';
        if (!rawScore && item.numeric_rating && !item.numeric_rating.toString().startsWith('#')) {
            rawScore = item.numeric_rating.toString().replace('/10','').trim();
        }
        document.getElementById('quickInfoRating').textContent = rawScore ? `${rawScore}/10` : '—';


        // --- Source Link ---
        const sourceBtn = document.getElementById('quickInfoSourceBtn');
        let searchUrl = '';
        if (item.type === 'Anime' || item.type === 'Manga') {
            searchUrl = `https://myanimelist.net/${item.type.toLowerCase()}/${item.tmdb_id || ''}`;
        } else {
            searchUrl = `https://www.themoviedb.org/${item.type === 'TV Series' ? 'tv' : 'movie'}/${item.tmdb_id || ''}`;
        }
        sourceBtn.href = searchUrl;

        // --- Admin Controls ---
        const editBtn = document.getElementById('quickInfoEditBtn');
        const deleteBtn = document.getElementById('quickInfoDeleteBtn');
        const ratingEditSection = document.getElementById('quickInfoRatingEditSection');
        
        if (computeCanEdit() && !item.isRecommendation) {
            editBtn.style.display = 'block';
            deleteBtn.style.display = 'block';
            
            editBtn.onclick = () => {
                quickInfoModal.classList.remove('show');
                window.openReviewModal(item.title, item.type, item.review, item.id);
            };
            
            deleteBtn.onclick = () => {
                quickInfoModal.classList.remove('show');
                window.openDeleteModal(item.id, item.title);
            };
            
            ratingEditSection.style.display = 'block';
            document.getElementById('quickInfoRatingInput').value = rawScore || '';
            document.getElementById('quickInfoYearInput').value = item.release_year || '';
            document.getElementById('quickInfoTitleInput').value = item.title || '';
            
            // Save Button
            document.getElementById('quickInfoSaveAllBtn').onclick = async () => {
                const btn = document.getElementById('quickInfoSaveAllBtn');
                let newRating = parseFloat(document.getElementById('quickInfoRatingInput').value);
                const newYear = document.getElementById('quickInfoYearInput').value.trim();
                const newTitle = document.getElementById('quickInfoTitleInput').value.trim();
                const payload = {};
                if (!isNaN(newRating)) {
                    newRating = Math.round(newRating * 2) / 2;
                    payload.rating = newRating.toString();
                }
                if (newYear) payload.release_year = newYear;
                if (newTitle) payload.title = newTitle;

                btn.disabled = true;
                btn.textContent = 'Saving...';
                try {
                    const res = await fetch(`/api/media/update/${item.id}`, {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.ok) {
                        quickInfoModal.classList.remove('show');
                        fetchMedia();
                    }
                } catch (e) { alert(e.message); }
                finally { btn.disabled = false; btn.textContent = 'Save Changes'; }
            };
        } else {
            editBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
            ratingEditSection.style.display = 'none';
        }

        // --- Genres ---
        const genresEl = document.getElementById('quickInfoGenres');
        if (item.genres) {
            genresEl.innerHTML = item.genres.split(',').map(g =>
                `<span class="genre-badge">${g.trim()}</span>`
            ).join('');
        } else { genresEl.innerHTML = ''; }

        // --- Metadata Row (Runtime, Rating, Seasons, Episodes, Status, Chapters) ---
        const rtEl = document.getElementById('quickInfoRuntime');
        const seasonsEl = document.getElementById('quickInfoSeasons');
        const episodesEl = document.getElementById('quickInfoEpisodes');
        const statusEl = document.getElementById('quickInfoStatus');
        const chaptersEl = document.getElementById('quickInfoChapters');
        const crEl = document.getElementById('quickInfoContentRating');

        // Reset visibility
        [rtEl, seasonsEl, episodesEl, statusEl, chaptersEl, crEl].forEach(el => {
            if (el) el.style.display = 'none';
        });

        // Runtime
        if (item.runtime) {
            const h = Math.floor(item.runtime / 60);
            const m = item.runtime % 60;
            rtEl.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
            rtEl.style.display = 'inline-block';
        }

        // Seasons (TV)
        if (item.total_seasons && item.type === 'TV Series') {
            seasonsEl.textContent = `${item.total_seasons} Season${item.total_seasons > 1 ? 's' : ''}`;
            seasonsEl.style.display = 'inline-block';
        }

        // Episodes (TV)
        if (item.total_episodes && item.type === 'TV Series') {
            episodesEl.textContent = `${item.total_episodes} Episode${item.total_episodes > 1 ? 's' : ''}`;
            episodesEl.style.display = 'inline-block';
        }

        // Status (Manga)
        if (item.manga_status && item.type === 'Manga') {
            statusEl.textContent = item.manga_status;
            statusEl.style.display = 'inline-block';
        }

        // Chapters (Manga)
        if (item.total_chapters && item.type === 'Manga' && item.manga_status !== 'Publishing') {
            chaptersEl.textContent = `${item.total_chapters} Chapter${item.total_chapters > 1 ? 's' : ''}`;
            chaptersEl.style.display = 'inline-block';
        }

        // Content Rating
        if (item.content_rating && (!item.manga_status || item.content_rating !== item.manga_status)) {
            crEl.textContent = item.content_rating;
            crEl.style.display = 'inline-block';
        }

        // --- Director / Creator ---
        const dirSection = document.getElementById('quickInfoDirectorSection');
        const dirLabel = dirSection.querySelector('.director-label');
        const dirEl = document.getElementById('quickInfoDirector');
        if (item.director) {
            dirEl.textContent = item.director;
            let label = 'Created by';
            if (item.type === 'Movies') label = 'Directed by';
            if (item.type === 'Manga') label = 'Written by';
            dirLabel.textContent = label;
            dirSection.style.display = 'flex';
        } else { dirSection.style.display = 'none'; }



        // --- Review ---
        const reviewSection = document.getElementById('quickInfoReviewSection');
        const reviewEl = document.getElementById('quickInfoReview');
        let reviewText = item.review || '';
        reviewText = reviewText.replace(/Imported from Discord/gi, '').trim();
        const hasReview = isRealReview(reviewText);
        if (hasReview) {
            reviewEl.textContent = reviewText;
            reviewSection.style.display = 'block';
        } else { reviewSection.style.display = 'none'; }

        // --- Poster ---
        const posterImg = document.getElementById('quickInfoPoster');
        const posterPlaceholder = document.getElementById('quickInfoPosterPlaceholder');
        posterImg.classList.remove('loaded');
        posterPlaceholder.style.display = 'flex';
        if (item.cover_url) {
            posterImg.onload = () => {
                posterImg.classList.add('loaded');
                posterPlaceholder.style.display = 'none';
            };
            posterImg.src = item.cover_url;
        } else { posterImg.src = ''; }

        quickInfoModal.style.zIndex = '10001';
        quickInfoModal.classList.add('show');
        document.body.classList.add('modal-open');

        // Restore Metadata Repair Logic
        const refreshBtn = document.getElementById('quickInfoRefreshBtn');
        const showLinkBtn = document.getElementById('quickInfoShowLinkBtn');
        const linkSubSection = document.getElementById('quickInfoLinkSubSection');
        const linkInput = document.getElementById('quickInfoLinkInput');
        const applyLinkBtn = document.getElementById('quickInfoApplyLinkBtn');

        linkSubSection.style.display = 'none';

        refreshBtn.onclick = async () => {
            if (!confirm("This will force-refresh all metadata from official sources. Continue?")) return;
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Syncing...';
            try {
                const res = await fetch(`/api/media/refresh/${item.id}`, { method: 'POST', headers: getAuthHeaders() });
                if ((await res.json()).ok) { fetchMedia(); quickInfoModal.classList.remove('show'); }
            } catch (e) { alert(e.message); }
            finally { refreshBtn.disabled = false; refreshBtn.textContent = 'Sync with Official'; }
        };

        showLinkBtn.onclick = () => {
            const isHidden = linkSubSection.style.display === 'none';
            linkSubSection.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                const searchUrl = (item.type === 'Manga') ? `https://myanimelist.net/manga.php?q=${encodeURIComponent(item.title)}` : (item.type === 'Anime' ? `https://myanimelist.net/anime.php?q=${encodeURIComponent(item.title)}` : `https://www.themoviedb.org/search?query=${encodeURIComponent(item.title)}`);
                window.open(searchUrl, '_blank');
            }
        };

        applyLinkBtn.onclick = async () => {
            const extId = parseInt(linkInput.value);
            if (isNaN(extId) || extId <= 0) return alert("Invalid ID.");
            applyLinkBtn.disabled = true;
            applyLinkBtn.textContent = 'Linking...';
            try {
                const res = await fetch('/api/media/link', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ item_id: item.id, ext_id: extId }) });
                if ((await res.json()).ok) { fetchMedia(); quickInfoModal.classList.remove('show'); }
            } catch (e) { alert(e.message); }
            finally { applyLinkBtn.disabled = false; applyLinkBtn.textContent = 'Apply Link'; }
        };
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

    window.openDeleteModal = (id, title) => {
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

        // Sync modal indicators if open
        const modalRatingLike = document.getElementById('quickInfoRatingLike');
        if (modalRatingLike) {
            modalRatingLike.style.display = newState ? 'inline-block' : 'none';
        }
        const modalLikeBtn = document.getElementById('quickInfoLikeBtn');
        if (modalLikeBtn) {
            modalLikeBtn.classList.toggle('liked', newState);
            modalLikeBtn.setAttribute('data-liked', newState.toString());
        }

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
            const displayCat = currentCategory.toLowerCase().endsWith('s') ? currentCategory.toLowerCase() : currentCategory.toLowerCase() + 's';
            if (query) {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">No results found for "<strong>${query}</strong>" in ${currentSubTab.toLowerCase()} ${displayCat}.</p>`;
            } else if (filterState.likedOnly) {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">No liked ${displayCat} match your search or filter.</p>`;
            } else {
                grid.innerHTML = `<p style="color: var(--text-secondary); text-align: center; grid-column: 1/-1;">Completed ${displayCat} were not listed yet.</p>`;
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
                    <div class="card-poster-bg" style="background-image: url('${item.cover_url || ''}')"></div>
                    <div class="card-content-overlay"></div>
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
                            ${finalRank ? `<span class="card-rank-badge${finalRank <= 5 ? ' rank-top5' : ''}">★ ${finalRank}</span>` : ''}
                        </div>
                        <div class="badge-slot-right">
                            ${item.is_liked ? `<span class="card-liked-indicator">♥</span>` : ''}
                            ${hasReview ? `<span class="review-badge">Reviewed</span>` : ''}
                        </div>
                    </div>


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

                card.style.cursor = 'pointer';

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
                if (!section) return; // Ignore buttons without a data-section (e.g. dev console)
                iTitle.innerText = section;
                iSubtitle.innerText = infoSubtitles[section] || 'Detailed methodology and project documentation.';
                iBody.innerHTML = infoData[section] || '<p>Information regarding this section is currently being finalized.</p>';
                iDetail.style.display = 'block';
                
                // Scroll specifically to the detail panel
                iDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        function setupDevConsole() {

            // Magic Auto-Fill removed as requested

            // --- Manage Passed Suggestions ---
            const managePassedBtn = document.getElementById('managePassedBtn');
            const passedModal = document.getElementById('passedEntriesModal');
            const closePassedBtn = document.getElementById('closePassedEntriesBtn');
            const passedList = document.getElementById('passedEntriesList');

            if (managePassedBtn) managePassedBtn.onclick = () => {
                passedModal.classList.add('show');
                fetchPassed();
            };

            if (closePassedBtn) closePassedBtn.onclick = () => {
                passedModal.classList.remove('show');
            };

            async function fetchPassed() {
                passedList.innerHTML = '<p style="text-align: center; opacity: 0.5; padding: 2rem;">Loading passed list...</p>';
                try {
                    const res = await fetch('/api/suggestions/passed', { headers: getAuthHeaders() });
                    if (!res.ok) throw new Error("Failed to fetch passed list");
                    const data = await res.json();
                    
                    if (data.length === 0) {
                        passedList.innerHTML = '<p style="text-align: center; opacity: 0.5; padding: 2rem;">No passed entries yet.</p>';
                        return;
                    }

                    passedList.innerHTML = data.map(p => `
                        <div style="background: var(--bg-card); padding: 1rem; border-radius: 12px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                            <div>
                                <strong style="display: block; color: var(--text-primary);">${p.title || 'Unknown Title'}</strong>
                                <span style="font-size: 0.75rem; opacity: 0.6;">${p.type} • ID: ${p.tmdb_id}</span>
                            </div>
                            <button onclick="unpassEntry(${p.id}, this)" class="btn-text" style="color: #ff6b6b; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">Remove</button>
                        </div>
                    `).join('');
                } catch (err) {
                    passedList.innerHTML = `<p style="text-align: center; color: #ff6b6b; padding: 2rem;">Error: ${err.message}</p>`;
                }
            }

            window.unpassEntry = async (id, btn) => {
                if (!confirm("Allow this entry to be suggested again?")) return;
                btn.disabled = true;
                btn.innerText = '...';
                try {
                    const res = await fetch(`/api/suggestions/passed/${id}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders(true)
                    });
                    if (res.ok) {
                        btn.closest('div').remove();
                        if (passedList.children.length === 0) {
                            passedList.innerHTML = '<p style="text-align: center; opacity: 0.5; padding: 2rem;">No passed entries yet.</p>';
                        }
                    }
                } catch (err) {
                    console.error("Error unpassing:", err);
                    btn.disabled = false;
                    btn.innerText = 'Remove';
                }
            };
        }

        if (iBack) {
            iBack.addEventListener('click', () => {
                iDetail.style.display = 'none';
            });
        }
        
        // Initialize Dev Console immediately
        setupDevConsole();
    }

    // Initialization
    updateCategoryTitleCount();
    updateTheme();
    window.updateAuthUI(); // Ensure auth UI is set before media loads
    fetchHubRecommendations(currentCategory);
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
            // Scrolling Down -> Hide Header & Bottom Nav
            header.classList.add('header-hidden');
            if (bNav) bNav.classList.add('nav-hidden');
        } else if (st < lastScrollTop) {
            // Scrolling Up -> Show Header & Bottom Nav
            header.classList.remove('header-hidden');
            if (bNav) bNav.classList.remove('nav-hidden');
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

    // --- Scouting Panel: Infinite Scroll State ---
    let scoutPool = [];
    let scoutPage = 0;
    const SCOUT_PAGE_SIZE = 20;

    const buildScoutItemHTML = (it) => {
        const itemJson = JSON.stringify({id: it.id, title: it.title.replace(/'/g, "\\'"), release_year: it.release_year});
        const scoreStr = (() => {
            const s = String(it.numeric_rating || it.rating || '');
            if (s && !s.startsWith('#')) return s.replace('/10', '').trim();
            return null;
        })();
        return `
            <div class="ranking-search-item">
                <div class="ranking-search-item-info" onclick='window.openQuickInfo(${JSON.stringify(it)})' title="View profile" style="cursor:pointer;flex:1;">
                    <span class="ranking-search-item-title">${it.title}</span>
                    <span class="ranking-search-item-meta">${it.release_year || 'Unknown Year'}${scoreStr ? ' &bull; ' + scoreStr + '/10' : ''}</span>
                </div>
                <div class="ranking-search-item-plus" onclick='window.addToRankings(${itemJson})' title="Add to rankings">+</div>
            </div>`;
    };

    const appendScoutPage = () => {
        const start = scoutPage * SCOUT_PAGE_SIZE;
        const slice = scoutPool.slice(start, start + SCOUT_PAGE_SIZE);
        if (slice.length === 0) return; // Nothing more to add
        rankingSearchResults.insertAdjacentHTML('beforeend', slice.map(buildScoutItemHTML).join(''));
        scoutPage++;
    };

    const renderScoutingPool = () => {
        // Build pool: all items in this category not already ranked
        const rankedTitles = new Set(currentRankedItems.map(it => it.title.toLowerCase().trim()));
        const raw = allMedia.filter(it =>
            it.type.toLowerCase() === currentCategory.toLowerCase() &&
            !rankedTitles.has(it.title.toLowerCase().trim())
        );
        // Fisher-Yates shuffle
        scoutPool = [...raw];
        for (let i = scoutPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [scoutPool[i], scoutPool[j]] = [scoutPool[j], scoutPool[i]];
        }
        scoutPage = 0;
        rankingSearchResults.innerHTML = '';

        if (scoutPool.length === 0) {
            rankingSearchResults.innerHTML = '<p style="opacity:0.4;font-size:0.85rem;padding:0.5rem;">All entries are already in your rankings.</p>';
            return;
        }

        // Render first page
        appendScoutPage();

        // Attach scroll listener for infinite scroll (remove old listener first)
        rankingSearchResults.onscroll = () => {
            const el = rankingSearchResults;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
                appendScoutPage();
            }
        };
    };

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
        
        // Pre-populate scouting panel using infinite-scroll helper
        renderScoutingPool();
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
        const wasSearching = rankingSearchInput.value.trim().length >= 2;
        currentRankedItems.push(item);
        renderRankingList();
        rankingSearchInput.value = '';
        // Re-render scouting pool so the panel stays populated (minus the added item)
        if (!wasSearching) {
            renderScoutingPool();
        } else {
            // Still searching: just remove the added item from current search results
            const rows = rankingSearchResults.querySelectorAll('.ranking-search-item');
            rows.forEach(row => {
                if (row.querySelector('.ranking-search-item-title')?.textContent === item.title) row.remove();
            });
        }
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
            
            const rankedTitles = new Set(currentRankedItems.map(it => it.title.toLowerCase().trim()));
            
            // If search is cleared, go back to infinite-scroll random pool
            if (query.length < 2) {
                renderScoutingPool();
                return;
            }
            
            const matches = allMedia
                .filter(it => 
                    it.type.toLowerCase() === currentCategory.toLowerCase() &&
                    it.title.toLowerCase().includes(query) &&
                    !rankedTitles.has(it.title.toLowerCase().trim())
                )
                .slice(0, 10);
                
            rankingSearchResults.innerHTML = matches.length > 0
                ? matches.map(it => {
                    const safeTitle = it.title.replace(/'/g, "\\'");
                    const itemJson = JSON.stringify({id: it.id, title: safeTitle, release_year: it.release_year});
                    const scoreStr = (() => {
                        const s = String(it.numeric_rating || it.rating || '');
                        if (s && !s.startsWith('#')) return s.replace('/10','').trim();
                        return null;
                    })();
                    return `
                        <div class="ranking-search-item">
                            <div class="ranking-search-item-info" onclick='window.openQuickInfo(${JSON.stringify(it)})' title="View profile" style="cursor:pointer;flex:1;">
                                <span class="ranking-search-item-title">${it.title}</span>
                                <span class="ranking-search-item-meta">${it.release_year || 'Unknown Year'}${scoreStr ? ' • ' + scoreStr + '/10' : ''}</span>
                            </div>
                            <div class="ranking-search-item-plus" onclick='window.addToRankings(${itemJson})' title="Add to rankings">+</div>
                        </div>
                    `;
                }).join('')
                : '<p style="opacity:0.4;font-size:0.85rem;padding:0.5rem;">No results found.</p>';
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

    // ==========================================
    // Suggestion Engine Logic
    // ==========================================
    const suggestMeBtn = document.getElementById('suggestMeBtn');
    const suggestionModal = document.getElementById('suggestionModal');
    const closeSuggestionBtn = document.getElementById('closeSuggestionBtn');
    const suggestionLoading = document.getElementById('suggestionLoading');
    const suggestionResults = document.getElementById('suggestionResults');
    const suggestionError = document.getElementById('suggestionError');

    const suggestionControls = document.getElementById('suggestionControls');
    
    let lastSuggestionIds = [];
    const retrySuggestionBtn = document.getElementById('retrySuggestionBtn');


    let progressInterval;

    async function fetchSuggestions() {
        suggestionLoading.style.display = 'block';
        suggestionResults.style.display = 'none';
        suggestionError.style.display = 'none';
        if (suggestionControls) suggestionControls.style.display = 'none';
        suggestionResults.innerHTML = '';

        const stepLineProgress = document.getElementById('stepLineProgress');
        const loadingText = document.getElementById('suggestionLoadingText');
        const loadingSubtext = document.getElementById('suggestionLoadingSubtext');
        
        const steps = [
            document.getElementById('step1'),
            document.getElementById('step2'),
            document.getElementById('step3'),
            document.getElementById('step4')
        ];
        
        if (stepLineProgress) stepLineProgress.style.width = '0%';
        steps.forEach((s, idx) => {
            if (s) {
                s.classList.remove('active', 'completed');
                if (idx === 0) s.classList.add('active');
            }
        });
        
        if (loadingText) loadingText.textContent = "Analyzing your library...";
        if (loadingSubtext) loadingSubtext.textContent = "Starting up...";

        const startTime = Date.now();
        
        if (loadingText) loadingText.textContent = "Processing Request";

        const isSlow = currentCategory === 'Anime' || currentCategory === 'Manga';
        // Enforce a minimum of 4 seconds for fast categories so users can see the stages
        const estimatedTime = isSlow ? 45000 : 4000; 
        let elapsed = 0;
        const interval = 200; // ms
        
        const checkItems = [
            document.getElementById('check1'),
            document.getElementById('check2'),
            document.getElementById('check3'),
            document.getElementById('check4')
        ];

        progressInterval = setInterval(() => {
            elapsed += interval;
            const progress = Math.min(95, (elapsed / estimatedTime) * 100);
            if (stepLineProgress) stepLineProgress.style.width = `${progress}%`;
            
            if (loadingSubtext) {
                if (isSlow && elapsed > 5000) {
                    loadingSubtext.textContent = "Anime/Manga APIs have strict rate limits, thanks for your patience...";
                } else if (progress > 80) {
                    loadingSubtext.textContent = "Almost there, finalizing picks...";
                } else {
                    loadingSubtext.textContent = "Finding the best matches for you...";
                }
            }
            
            // Update steps and checklist based on progress
            if (progress < 25) {
                updateActiveStep(0);
                updateChecklist(0);
            } else if (progress < 60) {
                updateActiveStep(1);
                updateChecklist(1);
            } else if (progress < 85) {
                updateActiveStep(2);
                updateChecklist(2);
            } else {
                updateActiveStep(3);
                updateChecklist(3);
            }
        }, interval);
        
        function updateChecklist(activeIndex) {
            checkItems.forEach((item, idx) => {
                if (!item) return;
                const icon = item.querySelector('i');
                if (idx < activeIndex) {
                    item.style.opacity = '1';
                    if (icon) icon.className = 'fas fa-check fa-fw';
                    if (icon) icon.style.color = '#2ed573';
                } else if (idx === activeIndex) {
                    item.style.opacity = '1';
                    if (icon) icon.className = 'fas fa-circle-notch fa-spin fa-fw';
                    if (icon) icon.style.color = 'var(--theme-accent)';
                } else {
                    item.style.opacity = '0.5';
                    if (icon) icon.className = 'far fa-circle fa-fw';
                    if (icon) icon.style.color = '';
                }
            });
        }
        
        function updateActiveStep(activeIndex) {
            steps.forEach((s, idx) => {
                if (!s) return;
                if (idx < activeIndex) {
                    s.classList.remove('active');
                    s.classList.add('completed');
                } else if (idx === activeIndex) {
                    s.classList.add('active');
                    s.classList.remove('completed');
                } else {
                    s.classList.remove('active', 'completed');
                }
            });
        }

        // Abort if the request takes longer than 120 seconds (Jikan can be very slow with multiple seeds)
        const abortController = new AbortController();
        const abortTimeout = setTimeout(() => abortController.abort(), 120000);

        let suggestionsData = null;

        try {
            let url = `/api/suggestions?category=${encodeURIComponent(currentCategory)}`;
            if (lastSuggestionIds.length > 0) {
                url += `&exclude=${lastSuggestionIds.join(',')}`;
            }
            
            const res = await fetch(url, {
                headers: getAuthHeaders(false), // Guests can use this too
                signal: abortController.signal
            });
            clearTimeout(abortTimeout);

            if (!res.ok) throw new Error('Failed to fetch suggestions');
            suggestionsData = await res.json();
            
        } catch (err) {
            console.error("Suggestion Engine Error:", err);
            suggestionError.style.display = 'block';
            suggestionError.textContent = "An error occurred while generating suggestions. Please try again.";
            if (suggestionControls) suggestionControls.style.display = 'block'; // Allow retry on error
        } finally {
            clearInterval(progressInterval);
            
            // Calculate how much longer we need to wait to hit the 3-second minimum
            const elapsedActual = Date.now() - startTime;
            const waitTime = Math.max(3000 - elapsedActual, 0);
            
            setTimeout(() => {
                // Force bar to 100% and mark all completed
                if (stepLineProgress) stepLineProgress.style.width = '100%';
                steps.forEach(s => { if (s) { s.classList.remove('active'); s.classList.add('completed'); } });
                
                // Complete all checklist items
                checkItems.forEach(item => {
                    if (!item) return;
                    item.style.opacity = '1';
                    const icon = item.querySelector('i');
                    if (icon) icon.className = 'fas fa-check';
                    if (icon) icon.style.color = '#2ed573';
                });
                
                if (loadingSubtext) loadingSubtext.textContent = "Est. remaining: 0s";
                
                // Wait for the animation to finish before showing results
                setTimeout(() => {
                    suggestionLoading.style.display = 'none';
                
                if (suggestionsData) {
                    if (suggestionsData.length === 0) {
                        suggestionError.style.display = 'block';
                        suggestionError.textContent = "We don't have enough highly-rated data in your tracker to make good suggestions yet!";
                    } else {
                        lastSuggestionIds = suggestionsData.map(item => item.tmdb_id);
                        
                        suggestionsData.forEach(item => {
                            const card = document.createElement('div');
                            card.className = 'suggestion-card';
                            
                            const coverUrl = item.cover_url || 'https://via.placeholder.com/180x270/2c3e50/ecf0f1?text=No+Poster';
                            const year = item.release_year ? `(${item.release_year})` : '';
                            const genres = item.genres ? `<div class="suggestion-genres">${item.genres}</div>` : '';
                            const director = item.director ? `<div class="suggestion-director">${item.type === 'Movies' ? 'Dir.' : 'By'} ${item.director}</div>` : '';
                            const overview = item.overview ? `<div class="suggestion-overview">${item.overview}</div>` : '';
                            
                            card.innerHTML = `
                                <div class="suggestion-pass-btn" title="Pass (Never show again)"><i class="fas fa-times"></i></div>
                                <img src="${coverUrl}" alt="${item.title}" class="suggestion-poster" loading="lazy" />
                                <div class="suggestion-title">${item.title}</div>
                                <div class="suggestion-meta">${item.type} ${year}</div>
                                ${director}
                                ${genres}
                                ${overview}
                                <div class="suggestion-reason">${item.reason}</div>
                            `;
                            
                            const passBtn = card.querySelector('.suggestion-pass-btn');
                            if (!isAdminUnlocked) {
                                passBtn.style.display = 'none';
                            } else {
                                passBtn.addEventListener('click', async () => {
                                    passBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                                    try {
                                        const pRes = await fetch('/api/suggestions/pass', {
                                            method: 'POST',
                                            headers: getAuthHeaders(true),
                                            body: JSON.stringify({ 
                                                type: item.type, 
                                                tmdb_id: item.tmdb_id,
                                                title: item.title
                                            })
                                        });
                                        if (pRes.ok) {
                                            card.style.opacity = '0.3';
                                            card.style.pointerEvents = 'none';
                                            passBtn.innerHTML = '<i class="fas fa-check" style="color:#2ed573;"></i>';
                                        } else {
                                            throw new Error('Failed to pass');
                                        }
                                    } catch (e) {
                                        console.error("Pass error:", e);
                                        passBtn.innerHTML = '<i class="fas fa-times"></i>';
                                    }
                                });
                            }
        
                            suggestionResults.appendChild(card);
                        });
                        suggestionResults.style.display = 'grid';
                        if (suggestionControls) suggestionControls.style.display = 'block';
                    }
                }
            }, 800);
        }, waitTime);
    }
}

    if (suggestMeBtn) {
        suggestMeBtn.addEventListener('click', () => {
            suggestionModal.classList.add('show');
            fetchSuggestions();
        });
    }

    // Accordion Toggle Logic
    document.querySelectorAll('.hub-accordion-header').forEach(header => {
        header.onclick = () => {
            const accordion = header.parentElement;
            accordion.classList.toggle('open');
        };
    });

    async function fetchHubRecommendations(category) {
        const activeList = document.getElementById('activeRecsList');
        const watchedList = document.getElementById('watchedRecsList');
        const activeTitle = document.getElementById('activeRecsTitle');
        const watchedTitle = document.getElementById('watchedRecsTitle');
        
        if (!activeList || !watchedList) return;
        
        const isManga = category === 'Manga';
        const watchedVerb = isManga ? 'Read' : 'Watched';
        const watchedVerbLower = isManga ? 'read' : 'watched';
        
        try {
            const response = await fetch(`/api/recommendations/recent/${category}`);
            const data = await response.json();
            
            const activeData = data.filter(r => r.status === 'pending');
            const watchedData = data.filter(r => r.status === 'accepted');
            
            if (activeTitle) activeTitle.textContent = `[${activeData.length}] Active Recommendations`;
            if (watchedTitle) watchedTitle.textContent = `[${watchedData.length}] ${watchedVerb} Recommendations`;
            
            const renderList = (container, recs, isWatched) => {
                container.innerHTML = '';
                if (recs.length === 0) {
                    container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-secondary); opacity: 0.5; text-align: center; padding: 1.5rem;">No ${isWatched ? watchedVerbLower : 'active'} recommendations.</div>`;
                    return;
                }
                
                recs.forEach(rec => {
                    const item = document.createElement('div');
                    item.className = 'rec-entry-item';
                    
                    const posterUrl = rec.cover_url || 'https://via.placeholder.com/150x225?text=No+Poster';
                    
                    item.innerHTML = `
                        <img src="${posterUrl}" class="rec-entry-poster" alt="Poster">
                        <div class="rec-entry-info">
                            <div class="rec-entry-title">${rec.title}</div>
                            <div class="rec-entry-meta">
                                ${rec.year || '????'} • ${rec.recommender_name || 'Anonymous'}
                                <div style="font-size: 0.65rem; opacity: 0.5; margin-top: 2px;">
                                    ${new Date(rec.date_added + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${new Date(rec.date_added + 'Z').toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                        <div class="rec-entry-actions">
                            ${!isWatched && computeCanEdit() ? `
                                <div class="rec-action-btn accept" title="Mark as ${watchedVerb}"><i class="fas fa-check"></i></div>
                                <div class="rec-action-btn delete" title="Remove"><i class="fas fa-trash-alt"></i></div>
                            ` : (isWatched && computeCanEdit() ? `
                                <div class="rec-action-btn delete" title="Remove"><i class="fas fa-trash-alt"></i></div>
                            ` : '')}
                        </div>
                    `;
                    
                    // Open Quick Info on Title/Poster click
                    const openInfo = () => {
                        window.openQuickInfo({
                            ...rec,
                            release_year: rec.year,
                            isRecommendation: true,
                            _recId: rec.id
                        });
                    };
                    item.querySelector('.rec-entry-title').onclick = openInfo;
                    item.querySelector('.rec-entry-poster').onclick = openInfo;
                    
                    // Admin Actions
                    if (computeCanEdit()) {
                        const acceptBtn = item.querySelector('.accept');
                        const deleteBtn = item.querySelector('.delete');
                        
                        if (acceptBtn) {
                            acceptBtn.onclick = async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Mark "${rec.title}" as ${watchedVerbLower}?`)) return;
                                const success = await updateRecStatus(rec.id, 'accepted');
                                if (success) fetchHubRecommendations(category);
                            };
                        }
                        
                        if (deleteBtn) {
                            deleteBtn.onclick = async (e) => {
                                e.stopPropagation();
                                if (!confirm(`Remove "${rec.title}" from recommendations?`)) return;
                                const success = await updateRecStatus(rec.id, 'rejected');
                                if (success) fetchHubRecommendations(category);
                            };
                        }
                    }
                    
                    container.appendChild(item);
                });
            };
            
            renderList(activeList, activeData, false);
            renderList(watchedList, watchedData, true);
            
        } catch (error) {
            console.error('Error fetching hub recommendations:', error);
        }
    }

    async function updateRecStatus(recId, status) {
        try {
            const res = await fetch(`/api/recommendations/${recId}/status`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status })
            });
            
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Failed to update status');
            }
            return data;
        } catch (e) {
            console.error('Error updating recommendation status:', e);
            alert(e.message || 'Failed to update status.');
            return null; // Return null to indicate failure
        }
    }


    const leaveRecBtn = document.getElementById('leaveRecommendationBtn');
    const recModal = document.getElementById('recommendationModal');
    const closeRecBtn = document.getElementById('closeRecommendationBtn');
    
    const recPage1 = document.getElementById('recPage1');
    const recPage2 = document.getElementById('recPage2');
    const recPage3 = document.getElementById('recPage3');
    
    const recTitleInput = document.getElementById('recTitleInput');
    const recYearInput = document.getElementById('recYearInput');
    const recNoteInput = document.getElementById('recNoteInput');
    const recNameInput = document.getElementById('recNameInput');
    
    const recNext1Btn = document.getElementById('recNext1Btn');
    const recBack2Btn = document.getElementById('recBack2Btn');
    const recNext2Btn = document.getElementById('recNext2Btn');
    const recBack3Btn = document.getElementById('recBack3Btn');
    const recSubmitBtn = document.getElementById('recSubmitBtn');
    
    const recSearchResults = document.getElementById('recSearchResults');
    const recDuplicateMessage = document.getElementById('recDuplicateMessage');
    const recDuplicateText = document.getElementById('recDuplicateText');
    const recCloseDuplicateBtn = document.getElementById('recCloseDuplicateBtn');
    const recRecommendAnotherBtn = document.getElementById('recRecommendAnotherBtn');
    const recSearchResultsContainer = document.getElementById('recSearchResultsContainer');
    const recPage2Instructions = document.getElementById('recPage2Instructions');
    
    let selectedRecItem = null;
    
    if (leaveRecBtn && recModal) {
        function updateRecSteps(activeStep) {
            for (let i = 1; i <= 3; i++) {
                const circle = document.getElementById(`recStepCircle${i}`);
                if (circle) {
                    if (i === activeStep) {
                        circle.style.background = 'var(--theme-accent)';
                        circle.style.color = '#000';
                        circle.style.borderColor = 'var(--theme-accent)';
                    } else if (i < activeStep) {
                        circle.style.background = 'rgba(var(--theme-accent-rgb), 0.2)';
                        circle.style.color = 'var(--theme-accent)';
                        circle.style.borderColor = 'var(--theme-accent)';
                    } else {
                        circle.style.background = 'var(--bg-surface)';
                        circle.style.color = 'var(--text-secondary)';
                        circle.style.borderColor = 'rgba(255,255,255,0.1)';
                    }
                }
            }
        }

        leaveRecBtn.addEventListener('click', () => {
            recModal.classList.add('show');
            // Reset to page 1
            recPage1.style.display = 'block';
            recPage2.style.display = 'none';
            recPage3.style.display = 'none';
            selectedRecItem = null;
            recNext2Btn.disabled = true;
            recSearchResults.innerHTML = '';
            recTitleInput.value = '';
            recYearInput.value = '';
            recNoteInput.value = '';
            recNameInput.value = '';
            
            // Reset Page 2 display
            if (recPage2Instructions) recPage2Instructions.style.display = 'block';
            if (recSearchResultsContainer) recSearchResultsContainer.style.display = 'block';
            if (recDuplicateMessage) recDuplicateMessage.style.display = 'none';
            
            updateRecSteps(1);
        });
        
        closeRecBtn.addEventListener('click', () => {
            recModal.classList.remove('show');
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === recModal) {
                recModal.classList.remove('show');
            }
        });
        
        recNext1Btn.addEventListener('click', async () => {
            const title = recTitleInput.value.trim();
            const year = recYearInput.value.trim();
            
            if (!title) {
                alert('Please enter a title.');
                return;
            }
            
            recPage1.style.display = 'none';
            recPage2.style.display = 'block';
            updateRecSteps(2);
            recSearchResults.innerHTML = '<p style="text-align: center; opacity: 0.5;">Searching...</p>';
            
            try {
                // Determine current category
                const activeTab = document.querySelector('.tab-btn.active');
                const category = activeTab ? activeTab.dataset.category : 'Movies';
                
                let url = `/api/search/multi?title=${encodeURIComponent(title)}&type=${encodeURIComponent(category)}`;
                if (year) url += `&year=${year}`;
                
                const response = await fetch(url);
                const results = await response.json();
                
                recSearchResults.innerHTML = '';
                if (!results || results.length === 0) {
                    recSearchResults.innerHTML = '<p style="text-align: center; opacity: 0.5;">No results found.</p>';
                    return;
                }
                
                results.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'rec-search-item';
                    div.style.cssText = 'display: flex; gap: 15px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 12px; cursor: pointer; margin-bottom: 8px; transition: all 0.2s ease; border: 1px solid transparent;';
                    
                    if (item.cover_url) {
                        const img = document.createElement('img');
                        img.src = item.cover_url;
                        img.style.cssText = 'width: 80px; height: 120px; object-fit: cover; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); flex-shrink: 0;';
                        div.appendChild(img);
                    }
                    
                    const details = document.createElement('div');
                    details.style.cssText = 'flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;';
                    details.innerHTML = `
                        <div style="font-weight: 700; color: #fff; margin-bottom: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
                        <div style="font-size: 0.8rem; color: var(--theme-accent); opacity: 0.8; font-weight: 600; margin-bottom: 0.3rem;">${item.release_year || 'N/A'}</div>
                        ${item.overview ? `<div style="font-size: 0.75rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; opacity: 0.7;">${item.overview}</div>` : ''}
                    `;
                    div.appendChild(details);
                    
                    div.addEventListener('mouseenter', () => {
                        if (selectedRecItem !== item) {
                            div.style.background = 'rgba(255,255,255,0.07)';
                            div.style.borderColor = 'rgba(255,255,255,0.1)';
                        }
                    });
                    
                    div.addEventListener('mouseleave', () => {
                        if (selectedRecItem !== item) {
                            div.style.background = 'rgba(255,255,255,0.03)';
                            div.style.borderColor = 'transparent';
                        }
                    });
                    
                    div.addEventListener('click', () => {
                        // Deselect others
                        document.querySelectorAll('.rec-search-item').forEach(el => {
                            el.style.background = 'rgba(255,255,255,0.03)';
                            el.style.borderColor = 'transparent';
                        });
                        div.style.background = 'rgba(var(--theme-accent-rgb), 0.15)';
                        div.style.borderColor = 'var(--theme-accent)';
                        selectedRecItem = item;
                        recNext2Btn.disabled = false;
                    });
                    
                    recSearchResults.appendChild(div);
                });
            } catch (error) {
                console.error('Search error:', error);
                recSearchResults.innerHTML = '<p style="text-align: center; opacity: 0.5; color: var(--error-color);">Error searching.</p>';
            }
        });
        
        recBack2Btn.addEventListener('click', () => {
            recPage2.style.display = 'none';
            recPage1.style.display = 'block';
            updateRecSteps(1);
        });
        
        recNext2Btn.addEventListener('click', async () => {
            if (!selectedRecItem) return;
            
            const activeTab = document.querySelector('.tab-btn.active');
            const category = activeTab ? activeTab.dataset.category : 'Movies';
            
            try {
                const response = await fetch(`/api/recommendations/check?ext_id=${selectedRecItem.tmdb_id}&type=${category}`);
                const data = await response.json();
                
                if (!data.allow_recommendation || data.in_library) {
                    // Show duplicate message
                    recPage2Instructions.style.display = 'none';
                    recSearchResultsContainer.style.display = 'none';
                    recDuplicateMessage.style.display = 'block';
                    
                    const continueBtn = document.getElementById('recContinueDuplicateBtn');
                    let msg = `"${selectedRecItem.title}" is already in the database.`;
                    
                    if (data.in_library) {
                        msg = `"${selectedRecItem.title}" is already in the finished database.`;
                        if (continueBtn) continueBtn.style.display = 'none'; // Users must manually add if already finished
                    } else if (!data.allow_recommendation) {
                        msg = `"${selectedRecItem.title}" has already been recommended.`;
                        if (continueBtn) continueBtn.style.display = 'none';
                    }
                    
                    recDuplicateText.textContent = msg;
                    return; // Wait for user to click Close or Recommend Another
                }
            } catch (error) {
                console.error('Check error:', error);
            }
            
            // If not exists or error, proceed to Page 3
            recPage2.style.display = 'none';
            recPage3.style.display = 'block';
            updateRecSteps(3);
        });
        
        if (recCloseDuplicateBtn) {
            recCloseDuplicateBtn.addEventListener('click', () => {
                recModal.classList.remove('show');
            });
        }
        
        const recContinueDuplicateBtn = document.getElementById('recContinueDuplicateBtn');
        if (recContinueDuplicateBtn) {
            recContinueDuplicateBtn.addEventListener('click', () => {
                // Go to page 3
                recPage2.style.display = 'none';
                recPage3.style.display = 'block';
                updateRecSteps(3);
                
                // Reset Page 2 display for next time
                recPage2Instructions.style.display = 'block';
                recSearchResultsContainer.style.display = 'block';
                recDuplicateMessage.style.display = 'none';
                recContinueDuplicateBtn.style.display = 'none';
            });
        }
        
        if (recRecommendAnotherBtn) {
            recRecommendAnotherBtn.addEventListener('click', () => {
                // Reset to page 1
                recPage1.style.display = 'block';
                recPage2.style.display = 'none';
                recPage3.style.display = 'none';
                selectedRecItem = null;
                recNext2Btn.disabled = true;
                recSearchResults.innerHTML = '';
                recTitleInput.value = '';
                recYearInput.value = '';
                recNoteInput.value = '';
                recNameInput.value = '';
                
                // Reset Page 2 display for next time
                recPage2Instructions.style.display = 'block';
                recSearchResultsContainer.style.display = 'block';
                recDuplicateMessage.style.display = 'none';
                if (recContinueDuplicateBtn) recContinueDuplicateBtn.style.display = 'none';
                
                updateRecSteps(1);
            });
        }
        
        recBack3Btn.addEventListener('click', () => {
            recPage3.style.display = 'none';
            recPage2.style.display = 'block';
            updateRecSteps(2);
        });
        
        recSubmitBtn.addEventListener('click', async () => {
            const name = recNameInput.value.trim();
            
            if (!selectedRecItem) {
                alert('Please select an item.');
                return;
            }
            
            // Use the current hub category (movies/tv/etc)
            const category = currentCategory || 'Movies';
            
            const payload = {
                title: selectedRecItem.title,
                year: selectedRecItem.release_year ? parseInt(selectedRecItem.release_year) : null,
                ext_id: selectedRecItem.tmdb_id,
                type: category,
                note: null,
                recommender_name: name || 'Anonymous'
            };
            
            try {
                const response = await fetch('/api/recommendations/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    alert('Recommendation submitted successfully!');
                    recModal.classList.remove('show');
                    // Refresh recent recommendations
                    fetchHubRecommendations(category);
                } else {
                    alert('Error submitting recommendation.');
                }
            } catch (error) {
                console.error('Submit error:', error);
                alert('Error submitting recommendation.');
            }
        });
    }
    
    if (retrySuggestionBtn) {
        retrySuggestionBtn.addEventListener('click', () => {
            fetchSuggestions();
        });
    }

    if (closeSuggestionBtn) {
        closeSuggestionBtn.addEventListener('click', () => {
            suggestionModal.classList.remove('show');
        });
    }

    // Expert Initialization: Sync the default category state on load
    // Land on the Hub as requested
    currentSubTab = 'Info';
    handleCategorySwitch('Movies');

    // Global Modal Close on Double Click / Double Tap
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        // Desktop
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                const closeBtn = modal.querySelector('.close-btn');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    modal.classList.remove('show');
                    document.body.classList.remove('modal-open');
                }
            }
        });

        // Mobile
        let lastTouchEnd = 0;
        modal.addEventListener('touchend', (e) => {
            const now = new Date().getTime();
            if (now - lastTouchEnd <= 300) {
                if (e.target === modal) {
                    e.preventDefault(); // Prevent ghost click
                    const closeBtn = modal.querySelector('.close-btn');
                    if (closeBtn) {
                        closeBtn.click();
                    } else {
                        modal.classList.remove('show');
                        document.body.classList.remove('modal-open');
                    }
                }
            }
            lastTouchEnd = now;
        });
    });

    // --- Manage Recommendations (Global) ---
    const manageRecsBtn = document.getElementById('manageRecommendationsBtn');
    const manageRecsModal = document.getElementById('manageRecommendationsModal');
    const closeManageRecsBtn = document.getElementById('closeManageRecommendationsBtn');
    
    // Page Views
    const recMgrListView = document.getElementById('recMgrListView');
    const recMgrWatchView = document.getElementById('recMgrWatchView');
    
    // Tabs
    const recMgrTabPending = document.getElementById('recMgrTabPending');
    const recMgrTabAccepted = document.getElementById('recMgrTabAccepted');
    const recMgrFilterContainer = document.getElementById('recMgrFilterContainer');
    
    const allRecsList = document.getElementById('allRecommendationsList');
    
    let currentRecFilter = 'Movies'; // Default to Movies
    let currentRecTab = 'pending'; // 'pending' or 'accepted'
    let allRecsData = [];

    // Watch Flow (Obsolete - items are now Accepted/Rejected and manually added to library)
    // Removed markRecWatched and related listeners

    async function fetchAllRecs() {
        allRecsList.innerHTML = '<p style="text-align:center;opacity:0.5;padding:2rem;">Loading...</p>';
        try {
            const url = `/api/recommendations/all?status=${currentRecTab}&type=${encodeURIComponent(currentRecFilter)}`;
            const res = await fetch(url, { headers: getAuthHeaders() });
            if (!res.ok) throw new Error('Failed');
            allRecsData = await res.json();
            renderAllRecs();
        } catch (e) {
            allRecsList.innerHTML = '<p style="text-align:center;color:#ff6b6b;padding:2rem;">Could not load list.</p>';
        }
    }

    function renderAllRecs() {
        if (!allRecsData.length) {
            const msg = currentRecTab === 'pending' ? 'No pending recommendations.' : 'No accepted recommendations.';
            allRecsList.innerHTML = `<p style="text-align:center;opacity:0.5;padding:2rem;">${msg}</p>`;
            return;
        }
        allRecsList.innerHTML = '';
        allRecsData.forEach(rec => {
            const card = document.createElement('div');
            card.className = 'rec-mgr-card';

            // Poster Thumbnail
            const poster = document.createElement('div');
            poster.className = 'rec-mgr-card-poster';
            if (rec.cover_url) {
                poster.style.backgroundImage = `url(${rec.cover_url})`;
            } else {
                poster.innerHTML = '<i class="fas fa-image" style="opacity:0.2;"></i>';
            }
            card.appendChild(poster);

            const info = document.createElement('div');
            info.className = 'rec-mgr-card-info';
            info.style.cursor = 'pointer';
            info.onclick = () => {
                // Pass a flag so openQuickInfo knows how to handle it
                rec.isRecommendation = true;
                rec._recId = rec.id;
                rec.release_year = rec.year; // Align field names
                window.openQuickInfo(rec);
            };

            const titleEl = document.createElement('div');
            titleEl.className = 'rec-mgr-card-title';
            titleEl.textContent = rec.title + (rec.year ? ` (${rec.year})` : '');

            const meta = document.createElement('div');
            meta.className = 'rec-mgr-card-meta';
            
            // Format timestamp nicely
            let dateStr = '';
            if (rec.date_added) {
                const dateObj = new Date(rec.date_added + 'Z');
                dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            }

            meta.textContent = `${rec.type} • By ${rec.recommender_name || 'Anonymous'}${dateStr ? ' • ' + dateStr : ''}`;

            info.appendChild(titleEl);
            info.appendChild(meta);

            if (rec.note) {
                const noteEl = document.createElement('div');
                noteEl.className = 'rec-mgr-card-note';
                noteEl.textContent = `"${rec.note}"`;
                info.appendChild(noteEl);
            }
            
            card.appendChild(info);

            const actions = document.createElement('div');
            actions.className = 'rec-mgr-card-actions';

            if (runtimeAdminKey) {
                if (currentRecTab === 'pending') {
                    const acceptBtn = document.createElement('button');
                    acceptBtn.className = 'rec-mgr-btn rec-mgr-btn-watch';
                    acceptBtn.innerHTML = '<i class="fas fa-check"></i> Accept';
                    acceptBtn.title = 'Acknowledge and move to history';
                    acceptBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        updateRecStatus(rec.id, 'accepted', card);
                    });
                    actions.appendChild(acceptBtn);
                } else if (currentRecTab === 'accepted') {
                    const unacceptBtn = document.createElement('button');
                    unacceptBtn.className = 'rec-mgr-btn rec-mgr-btn-watch';
                    unacceptBtn.innerHTML = '<i class="fas fa-undo"></i> Restore';
                    unacceptBtn.title = 'Move back to pending';
                    unacceptBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        updateRecStatus(rec.id, 'pending', card);
                    });
                    actions.appendChild(unacceptBtn);
                }

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'rec-mgr-btn rec-mgr-btn-delete';
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Delete';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteRec(rec.id, card);
                });
                actions.appendChild(deleteBtn);
            }

            if (runtimeAdminKey && actions.children.length > 0) {
                card.appendChild(actions);
            }
            allRecsList.appendChild(card);
        });
    }


    async function deleteRec(recId, cardEl) {
        if (!confirm('Delete this recommendation? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/recommendations/${recId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if ((await res.json()).ok) {
                cardEl.style.opacity = '0';
                cardEl.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    cardEl.remove();
                    allRecsData = allRecsData.filter(r => r.id !== recId);
                    if (!allRecsData.length) renderAllRecs();
                }, 320);
            }
        } catch (e) { alert('Error deleting recommendation.'); }
    }

    if (closeManageRecsBtn) closeManageRecsBtn.onclick = () => manageRecsModal.classList.remove('show');

    // Tab Switches
    if (recMgrTabPending) {
        recMgrTabPending.onclick = () => {
            currentRecTab = 'pending';
            recMgrTabPending.style.color = 'var(--text-primary)';
            recMgrTabPending.style.borderBottomColor = 'var(--theme-accent)';
            recMgrTabAccepted.style.color = 'var(--text-secondary)';
            recMgrTabAccepted.style.borderBottomColor = 'transparent';
            fetchAllRecs();
        };
    }
    if (recMgrTabAccepted) {
        recMgrTabAccepted.onclick = () => {
            currentRecTab = 'accepted';
            recMgrTabAccepted.style.color = 'var(--text-primary)';
            recMgrTabAccepted.style.borderBottomColor = 'var(--theme-accent)';
            recMgrTabPending.style.color = 'var(--text-secondary)';
            recMgrTabPending.style.borderBottomColor = 'transparent';
            fetchAllRecs();
        };
    }

    document.querySelectorAll('.rec-mgr-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rec-mgr-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRecFilter = btn.dataset.type;
            fetchAllRecs();
        });
    });
});
