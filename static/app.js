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

    const filterAndRenderMedia = () => {
        const infoPage = document.getElementById('infoPage');
        const controls = document.querySelector('.top-controls');

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
            def: "How the film is controlled and brought together—choices in tone, staging, and how scenes are presented.",
            well: "Everything feels intentional; scenes are easy to follow; tone stays consistent; all parts of the film work together.",
            poor: "Feels messy or unfocused; scenes are unclear; tone shifts unintentionally; elements feel disconnected."
        },
        "Acting": {
            def: "How believable and effective the performances are.",
            well: "Characters feel real; emotions come across naturally; performances fit the scene and tone.",
            poor: "Acting feels stiff, exaggerated, or fake; emotions don’t land; characters feel flat or inconsistent."
        },
        "Visual Craft": {
            def: "How the film looks—camera work, lighting, sets, and overall visual quality.",
            well: "Shots are clear and well-composed; lighting and design support the mood; visuals feel polished and intentional.",
            poor: "Shots are confusing or dull; visuals distract or feel cheap; noticeable visual mistakes break immersion."
        },
        "Flow": {
            def: "How the film moves over time—pacing, editing, and sound working together.",
            well: "Scenes transition smoothly; pacing feels right; sound and cuts support tension and clarity.",
            poor: "Feels choppy, rushed, or too slow; cuts are confusing; sound or timing disrupts the experience."
        },
        "Emotion": {
            def: "How strongly the film makes the viewer feel something.",
            well: "Creates clear, meaningful emotional reactions that last beyond the scene.",
            poor: "Feels empty, forced, or forgettable; emotional moments don’t land."
        },
        "Originality": {
            def: "How new or distinct the film feels in its ideas or execution.",
            well: "Offers a fresh perspective or unique style; stands out from similar films.",
            poor: "Feels generic, predictable, or heavily copied from other works."
        },
        "Genre Fit": {
            def: "How well the film delivers on what its genre is supposed to do.",
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
        return true;
    };

    // Globally accessible for dynamically generated onclick handlers
    window.openReviewModal = (title, type, existingReview) => {
        const hasReview = isRealReview(existingReview);
        
        if (hasReview) {
            document.getElementById('reviewTitleDisplay').innerHTML = `Reviewing: <strong>${title}</strong>`;
            const reviewText = existingReview;
            document.getElementById('reviewInputBox').value = reviewText;
            currentReviewContext = { title: title, type: type };
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
            const sourceIcon = item.source.toLowerCase() === 'discord' ? '🎮' : '✍️'; 

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
                if (canClickReview) {
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
                        10: ['My definition of "Peak" is a personal favorite.', 'Deep emotional and lasting impact.', 'Personally significant or defining experience.', 'Infinite rewatch value.', 'Absolute must-watch.', 'Would Never Forget.', 'Definitely have re-watched this movie over 3 times.'],
                        9: ['Outstanding in almost all aspects.', 'Strong emotional and intellectual impact.', 'Highly memorable.', 'Would rewatch freely with no specific reason.', 'Must-watch recommendation.', 'Hard to forget; vivid long-term recall.', 'Definitely have re-watched this movie over 3 times.'],
                        8: ['Strong performance across most categories.', 'Memorable and engaging experience.', 'Strong positive reaction.', 'Would rewatch at almost any time.', 'Highly recommended.', 'Easy to recall key moments in detail.', 'Definitely have re-watched this movie over 3 times.'],
                        7: ['The true middle-ground option.', 'Positive emotional response throughout.', 'Would rewatch occasionally.', 'Recommended.', 'Scenes or ideas stay with you over time.', 'Very Likely have re-watched this movie.'],
                        6: ['Noticeably better than average but inconsistent.', 'Some enjoyable or interesting parts.', 'Positive but restrained reaction.', 'Would rewatch only for specific reasons.', 'Mildly recommended.', 'Retains clear moments, but not strongly anchored.', 'Likely have re-watched this movie.'],
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
                    {title: 'Writing', text: 'Covers the core narrative construction: story, structure, dialogue, and themes. Evaluates plot logic, scene connectivity, and meaningful development. Strong writing is intentional; weak writing relies on coincidence.'},
                    {title: 'Directing', text: 'Covers the unified vision: tone consistency, staging, and department coordination. Good directing makes the film feel controlled; weak directing feels disjointed or inconsistent.'},
                    {title: 'Acting', text: 'Covers performance and believability. Evaluates whether actors convincingly portray characters through emotion and behavior. Strong acting is grounded; weak acting breaks immersion.'},
                    {title: 'Visual Craft', text: 'Covers cinematography, lighting, production design, and costumes. Evaluates how the film is visually constructed to support tone. Strong craft is immersive; weak craft is plain or distracting.'},
                    {title: 'Flow', text: 'Combined category (Editing + Sound). Measures pacing, transitions, and audio-visual rhythm. Strong flow feels seamless; weak flow feels choppy or disrupted by poor timing.'},
                    {title: 'Emotion', text: 'Covers the emotional effect on the viewer. Successfully generates feelings like tension, joy, or discomfort. Strong impact lingers; weak impact feels forced or forgettable.'},
                    {title: 'Originality', text: 'Covers freshness in concept or style. Evaluates whether the film offers something new or reinterprets ideas. Strong originality is inventive; weak originality is formulaic.'},
                    {title: 'Genre Fit', text: 'Covers effectiveness within an intended category (Comedy should be funny, etc.). Strong fit successfully delivers the intended experience regardless of general quality.'}
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
                    {title: 'Subjective Favorite Bias', text: 'Unlike the global list, the Rankings tab is **explicitly biased**. It represents my personal "Favorites" rather than just technically superior films. Emotional resonance and personal impact are the primary drivers here.'},
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
                        title: 'Genre & Theme Bias & Favoritism', 
                        text: `I have a naturally high interest in grounded dramas, high-concept sci-fi, and psychological thrillers. I also tend to give more weight to philosophical or socially relevant themes.<br><br>
                               <strong>The Result:</strong> This creates a "lower barrier to entry" where a drama might score an 8 simply because it's engaging with my favorite topics, while a comedy that's technically just as good might feel less "important."<br><br>
                               <strong>What to understand:</strong> My "Average" for a preferred genre can still rank higher than a "Good" for a genre I'm less connected to. It's a measurement of personal resonance as much as craft.`
                    },
                    {
                        title: 'Personnel & Hype Bias & Anticipation', 
                        text: `I'm often already biased toward directors or actors I've liked in the past, and my expectations are heavily tied to marketing and general reputation.<br><br>
                               <strong>The Result:</strong> I walk into these movies *wanting* them to be great. If there's a big gap between what I expected and what I got, the score is driven by that disappointment. Conversely, a hidden gem I expected to be bad might get an "inflation" bump because I was pleasantly surprised.<br><br>
                               <strong>What to understand:</strong> These scores are a measurement of my personal surprise or letdown relative to the talent involved and the hype surrounding the release.`
                    },
                    {
                        title: 'Recency Bias & Drift', 
                        text: `Newer movies are fresher in my head; the music, the visuals, and the emotions are all high clarity. Older movies suffer from "memory decay" where I might only remember the biggest flaws or broadest strokes.<br><br>
                               <strong>The Result:</strong> Without active re-reviews, my rankings will naturally drift toward whatever I've watched recently. Older ratings can start to feel deflated or disconnected over time.<br><br>
                               <strong>What to understand:</strong> A 10-year-old 8/10 was likely just as impactful at the time as a 9/10 released today. If you see an old rating that looks way off, message me and I'll re-evaluate it.`
                    },
                    {
                        title: 'Legacy Bias & Momentum', 
                        text: `I find it hard to judge sequels in a vacuum. My emotional connection to an entire franchise often fills in the narrative gaps for a weaker individual entry.<br><br>
                               <strong>The Result:</strong> A sequel can be "carried" by the momentum of a series I love, or unfairly punished for just not being as legendary as its predecessor.<br><br>
                               <strong>What to understand:</strong> My ratings often reflect the weight of the entire franchise journey, rather than just the isolated effort of that one movie.`
                    },
                    {
                        title: 'Scale Bias & Efficiency', 
                        text: `I pay close attention to how a movie uses its resources. I hold $200M blockbusters to a much higher technical standard and I definitely notice when that money produces uninspired "slop."<br><br>
                               <strong>The Result:</strong> I give a lot of credit to low-budget indies that perform well despite their limits. An indie "7" often feels more impressive to me than a massive studio "7."<br><br>
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
