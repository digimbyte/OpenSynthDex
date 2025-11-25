// Global state
let weaponsData = [];
let currentFilters = {
    manufacturer: 'all',
    category: 'all',
    search: '',
    sortBy: 'id'
};

// Image cache to track which variants exist
const imageCache = {};

// Card cache to avoid recreating DOM elements
const cardCache = new Map();

// Cache buster for images - use a stable version per deployment
// Only change this when you actually update the images
const cacheBuster = '1.0.0';

// Retry configuration for failed image loads
const IMAGE_RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000,    // 10 seconds
    backoffMultiplier: 2
};

// Track retry counts for images
const imageRetryCount = new Map();

// Request throttling to avoid rate limits
const IMAGE_LOAD_CONFIG = {
    maxConcurrent: 6,    // Max parallel image loads
    delayBetweenBatches: 100  // ms delay between batches
};

let activeImageLoads = 0;
const imageLoadQueue = [];

// Initialize the app
async function init() {
    try {
        // Load both weapon JSON files
        const [genericResponse, factionResponse] = await Promise.all([
            fetch('data/weapons_generic.json'),
            fetch('data/weapons_faction.json')
        ]);
        
        const genericData = await genericResponse.json();
        const factionData = await factionResponse.json();
        
        // Merge both weapon arrays
        weaponsData = [...genericData.weapons, ...factionData.weapons];
        
        populateFilters();
        updateStats();
        initializeCards();
        await updateManufacturerBanner(currentFilters.manufacturer);
        renderWeapons();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading weapon data:', error);
        document.getElementById('weaponGrid').innerHTML = 
            '<p style="color: var(--accent-secondary); text-align: center; padding: 40px;">Error loading weapon data. Please check that data files exist.</p>';
    }
}

// Populate filter dropdowns
function populateFilters() {
    const manufacturers = [...new Set(weaponsData.map(w => w.manufacturer))].sort();
    const categories = [...new Set(weaponsData.map(w => w.category))].sort();
    
    // Define faction manufacturers
    const factionManufacturers = [
        'Black Vein Syndicate', 'Chimera Protocol', 'Glass Harbor Collective',
        'Harvest Guild', 'HelioCrypt Overmind', 'Nexus Archives',
        'Night Censors', 'Null Sanctum', 'Pillar Ascendancy',
        'Proxy Choir', 'Radial Swarm', 'Rust Communion', 'Undercurrent Union'
    ];
    
    // Separate generic and faction manufacturers
    const genericMfrs = manufacturers.filter(m => !factionManufacturers.includes(m));
    const factionMfrs = manufacturers.filter(m => factionManufacturers.includes(m));
    
    const manufacturerFilter = document.getElementById('manufacturerFilter');
    
    // Add generic manufacturers
    genericMfrs.forEach(mfr => {
        const option = document.createElement('option');
        option.value = mfr;
        option.textContent = mfr;
        manufacturerFilter.appendChild(option);
    });
    
    // Add faction divider
    if (factionMfrs.length > 0) {
        const divider = document.createElement('option');
        divider.disabled = true;
        divider.textContent = '═══ Factions ═══';
        manufacturerFilter.appendChild(divider);
        
        // Add faction manufacturers
        factionMfrs.forEach(mfr => {
            const option = document.createElement('option');
            option.value = mfr;
            option.textContent = mfr;
            manufacturerFilter.appendChild(option);
        });
    }
    
    const categoryFilter = document.getElementById('categoryFilter');
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('manufacturerFilter').addEventListener('change', async (e) => {
        currentFilters.manufacturer = e.target.value;
        await updateManufacturerBanner(e.target.value);
        renderWeapons();
    });
    
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        currentFilters.category = e.target.value;
        renderWeapons();
    });
    
    document.getElementById('sortBy').addEventListener('change', (e) => {
        currentFilters.sortBy = e.target.value;
        renderWeapons();
    });
    
    const searchBox = document.getElementById('searchBox');
    const clearBtn = document.getElementById('clearSearch');
    
    searchBox.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.toLowerCase();
        clearBtn.style.display = e.target.value ? 'flex' : 'none';
        renderWeapons();
    });
    
    clearBtn.addEventListener('click', () => {
        searchBox.value = '';
        currentFilters.search = '';
        clearBtn.style.display = 'none';
        renderWeapons();
    });
    
    // Close modal on overlay click
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') {
            closeModal();
        }
    });
}

// Filter and sort weapons
function getFilteredWeapons() {
    let filtered = weaponsData.filter(weapon => {
        const matchesManufacturer = currentFilters.manufacturer === 'all' || 
                                   weapon.manufacturer === currentFilters.manufacturer;
        const matchesCategory = currentFilters.category === 'all' || 
                               weapon.category === currentFilters.category;
        const matchesSearch = currentFilters.search === '' || 
                             weapon.name.toLowerCase().includes(currentFilters.search) ||
                             weapon.description.toLowerCase().includes(currentFilters.search) ||
                             weapon.manufacturer.toLowerCase().includes(currentFilters.search);
        
        return matchesManufacturer && matchesCategory && matchesSearch;
    });
    
    // Sort
    filtered.sort((a, b) => {
        switch (currentFilters.sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'year':
                return b.yearOfManufacture - a.yearOfManufacture;
            case 'year-asc':
                return a.yearOfManufacture - b.yearOfManufacture;
            case 'damage':
                return (b.stats?.baseDamage || 0) - (a.stats?.baseDamage || 0);
            case 'range':
                return (b.stats?.range || 0) - (a.stats?.range || 0);
            case 'manufacturer':
                return a.manufacturer.localeCompare(b.manufacturer);
            case 'category':
                return a.category.localeCompare(b.category);
            default: // 'id'
                return a.id - b.id;
        }
    });
    
    return filtered;
}

// Generate image filename from weapon name
function generateImageFilename(weaponName, variant = '') {
    // Convert name to match the pattern in art folder
    // Handle various naming patterns in the art folder:
    // - Mixed case (e.g., "Arcline_Shock_baton")
    // - Numbers with dots/dashes (e.g., "5.56", "-556")
    // - Trailing underscores
    // - "-sheet" variants
    
    let filename = weaponName;
    
    // Handle special characters and numbers
    filename = filename
        .replace(/\./g, '_')  // Replace dots with underscores
        .replace(/-/g, '_')   // Replace dashes with underscores
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^\w_]/g, ''); // Remove other special chars
    
    // Try to match the mixed-case pattern in the art folder
    // Most files have title case for first words, then mixed case
    // We'll try multiple variations
    
    if (variant === '-sheet' || variant === '-sheet_a') {
        filename += variant;
    } else if (variant) {
        filename += variant;
    }
    
    return `art/weapons/${filename}.png`;
}

// Generate multiple filename variations to try
function generateFilenameVariations(weaponName, variantSuffix = '') {
    const variations = [];
    
    // Convert weapon name to base filename
    // Remove quotes first, then convert
    let base = weaponName
        .replace(/"/g, '')  // Remove quotes like "Shorty"
        .replace(/\./g, '_')
        .replace(/-/g, '_')
        .replace(/\s+/g, '_')
        .replace(/[^\w_]/g, '');
    
    // Try exact match
    variations.push(`art/weapons/${base}${variantSuffix}.png`);
    
    // Try with trailing underscore (common pattern)
    if (variantSuffix === '') {
        variations.push(`art/weapons/${base}_.png`);
    } else {
        variations.push(`art/weapons/${base}_${variantSuffix}.png`);
    }
    
    // Try lowercase last word (common pattern like Arcline_Shock_baton)
    const parts = base.split('_');
    if (parts.length > 1) {
        const lastLower = [...parts.slice(0, -1), parts[parts.length - 1].toLowerCase()].join('_');
        variations.push(`art/weapons/${lastLower}${variantSuffix}.png`);
        if (variantSuffix === '') {
            variations.push(`art/weapons/${lastLower}_.png`);
        }
    }
    
    // Try with -sheet pattern for variants (like Fluxline_G3_Caseless-sheet.png)
    if (variantSuffix === '_a') {
        variations.push(`art/weapons/${base}-sheet_a.png`);
        if (parts.length > 1) {
            const lastLower = [...parts.slice(0, -1), parts[parts.length - 1].toLowerCase()].join('_');
            variations.push(`art/weapons/${lastLower}-sheet_a.png`);
        }
    } else if (variantSuffix === '') {
        variations.push(`art/weapons/${base}-sheet.png`);
        if (parts.length > 1) {
            const lastLower = [...parts.slice(0, -1), parts[parts.length - 1].toLowerCase()].join('_');
            variations.push(`art/weapons/${lastLower}-sheet.png`);
        }
    }
    
    return variations;
}

// Check if image exists and cache the result
async function checkImageExists(url) {
    if (imageCache[url] !== undefined) {
        return imageCache[url];
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            imageCache[url] = true;
            resolve(true);
        };
        img.onerror = () => {
            imageCache[url] = false;
            resolve(false);
        };
        // Don't add cache buster to check requests - we just need to know if it exists
        img.src = url;
    });
}

// Process the image load queue
function processImageQueue() {
    while (activeImageLoads < IMAGE_LOAD_CONFIG.maxConcurrent && imageLoadQueue.length > 0) {
        const loadTask = imageLoadQueue.shift();
        activeImageLoads++;
        loadTask();
    }
}

// Load image with retry logic for rate limiting
function loadImageWithRetry(imgElement, url, retryCount = 0) {
    // Queue the image load to throttle requests
    imageLoadQueue.push(() => {
        const retryKey = `${imgElement.id}-${url}`;
        
        imgElement.onload = () => {
            // Success - clear any retry tracking
            imageRetryCount.delete(retryKey);
            activeImageLoads--;
            // Process next item in queue
            setTimeout(processImageQueue, IMAGE_LOAD_CONFIG.delayBetweenBatches);
        };
        
        imgElement.onerror = () => {
            const currentRetries = imageRetryCount.get(retryKey) || 0;
            
            if (currentRetries < IMAGE_RETRY_CONFIG.maxRetries) {
                // Calculate exponential backoff delay
                const delay = Math.min(
                    IMAGE_RETRY_CONFIG.initialDelay * Math.pow(IMAGE_RETRY_CONFIG.backoffMultiplier, currentRetries),
                    IMAGE_RETRY_CONFIG.maxDelay
                );
                
                imageRetryCount.set(retryKey, currentRetries + 1);
                
                console.log(`Retrying image load (${currentRetries + 1}/${IMAGE_RETRY_CONFIG.maxRetries}) for ${url} after ${delay}ms`);
                
                // Retry after delay
                setTimeout(() => {
                    // Remove cache buster and try again (in case it was a cache issue)
                    const cleanUrl = url.split('?')[0];
                    imgElement.src = cleanUrl;
                }, delay);
            } else {
                // Max retries reached
                console.warn(`Failed to load image after ${IMAGE_RETRY_CONFIG.maxRetries} retries: ${url}`);
                imageRetryCount.delete(retryKey);
                activeImageLoads--;
                // Process next item in queue
                setTimeout(processImageQueue, IMAGE_LOAD_CONFIG.delayBetweenBatches);
            }
        };
        
        imgElement.src = url;
    });
    
    // Start processing queue
    processImageQueue();
}

// Create weapon card (synchronous, without images)
function createWeaponCard(weapon) {
    // Check cache first
    if (cardCache.has(weapon.id)) {
        return cardCache.get(weapon.id);
    }
    
    const card = document.createElement('div');
    card.className = 'weapon-card';
    card.dataset.weaponId = weapon.id;
    card.onclick = () => openModal(weapon);
    
    // Start with placeholder image
    const imageHTML = `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext x='50' y='50' text-anchor='middle' dominant-baseline='middle' font-size='40' fill='%235c6bc0'%3E🔫%3C/text%3E%3C/svg%3E" alt="${weapon.name}" class="weapon-image placeholder" id="img-${weapon.id}">`;
    
    card.innerHTML = `
        <div class="weapon-image-container">
            <div class="weapon-id">#${weapon.id}</div>
            ${imageHTML}
            <div id="variant-container-${weapon.id}"></div>
        </div>
        <div class="weapon-info">
            <h3 class="weapon-name">${weapon.name}</h3>
            <span class="weapon-category">${weapon.category}</span>
            <p class="weapon-year">📅 ${weapon.yearOfManufacture}</p>
            <p class="weapon-description">${weapon.description}</p>
            <div class="weapon-stats-preview">
                <div class="stat-preview">
                    <span class="stat-preview-label">DMG</span>
                    <span class="stat-preview-value">${weapon.stats?.baseDamage || 0}</span>
                </div>
                <div class="stat-preview">
                    <span class="stat-preview-label">Range</span>
                    <span class="stat-preview-value">${weapon.stats?.range || 0}</span>
                </div>
                <div class="stat-preview">
                    <span class="stat-preview-label">Fire Rate</span>
                    <span class="stat-preview-value">${weapon.stats?.fireRate || 0}</span>
                </div>
            </div>
        </div>
    `;
    
    // Cache the card
    cardCache.set(weapon.id, card);
    
    // Load images asynchronously after card is created
    loadWeaponImages(weapon);
    
    return card;
}

// Generate manufacturer icon filename
function generateManufacturerIconPath(manufacturer) {
    // Convert manufacturer name to filename format
    const filename = manufacturer
        .replace(/\s+/g, '_')  // Replace spaces with underscores
        .replace(/[^\w_]/g, ''); // Remove special characters
    
    return `art/guilds/${filename}.png`;
}

// Update standalone manufacturer banner (image if found, X if missing, nothing for 'all')
async function updateManufacturerBanner(manufacturer) {
    const bannerImg = document.getElementById('selectedManufacturerBanner');
    const bannerX = document.getElementById('manufacturerBannerX');
    if (!bannerImg) return;

    if (manufacturer === 'all') {
        bannerImg.style.display = 'none';
        if (bannerX) bannerX.style.display = 'none';
        return;
    }

    const iconPath = generateManufacturerIconPath(manufacturer);
    const exists = await checkImageExists(iconPath);

    if (exists) {
        loadImageWithRetry(bannerImg, `${iconPath}?v=${cacheBuster}`);
        bannerImg.style.display = 'block';
        if (bannerX) bannerX.style.display = 'none';
    } else {
        bannerImg.style.display = 'none';
        if (bannerX) {
            bannerX.style.display = 'flex';
            // Add click handler to show expected filename
            bannerX.onclick = (e) => {
                e.stopPropagation();
                showExpectedManufacturerFilename(manufacturer);
            };
        }
    }
}

// Load manufacturer icon asynchronously
async function loadManufacturerIcon(weapon) {
    const iconPath = generateManufacturerIconPath(weapon.manufacturer);
    const iconImg = document.getElementById(`mfr-icon-${weapon.id}`);
    
    if (!iconImg) return;
    
    const exists = await checkImageExists(iconPath);
    
    if (exists) {
        loadImageWithRetry(iconImg, `${iconPath}?v=${cacheBuster}`);
        iconImg.classList.remove('placeholder');
    } else {
        // Show X for missing icon
        iconImg.style.display = 'none';
        const container = iconImg.parentElement;
        if (!container.querySelector('.missing-guild-icon')) {
            const missingIndicator = document.createElement('span');
            missingIndicator.className = 'missing-guild-icon';
            missingIndicator.textContent = '✕';
            missingIndicator.title = `Missing icon: ${iconPath.replace('art/guilds/', '')}`;
            container.insertBefore(missingIndicator, container.firstChild);
        }
    }
}

// Load images for a weapon card asynchronously
async function loadWeaponImages(weapon) {
    const variants = await findImageVariants(weapon.name);
    const currentImage = variants.length > 0 ? variants[0].filename : null;
    
    const img = document.getElementById(`img-${weapon.id}`);
    if (!img) return; // Card may have been removed
    
    if (currentImage) {
        loadImageWithRetry(img, `${currentImage}?v=${cacheBuster}`);
        img.classList.remove('placeholder');
    } else {
        // Add missing image indicator
        const container = img.parentElement;
        const missingIndicator = document.createElement('div');
        missingIndicator.className = 'missing-image-indicator';
        missingIndicator.dataset.weaponName = weapon.name;
        missingIndicator.textContent = '✕';
        missingIndicator.onclick = (e) => {
            e.stopPropagation();
            showExpectedFilename(weapon.name);
        };
        container.appendChild(missingIndicator);
    }
    
    // Add variant dots if multiple variants exist
    if (variants.length > 1) {
        const variantContainer = document.getElementById(`variant-container-${weapon.id}`);
        if (variantContainer) {
            const variantIndicator = document.createElement('div');
            variantIndicator.className = 'image-variant-indicator';
            variantIndicator.innerHTML = variants.map((v, idx) => 
                `<span class="variant-dot ${idx === 0 ? 'active' : ''}" 
                      data-weapon-id="${weapon.id}" 
                      data-variant-index="${idx}" 
                      data-filename="${v.filename}"
                      onclick="event.stopPropagation(); switchVariant(${weapon.id}, ${idx}, '${v.filename}')"></span>`
            ).join('');
            variantContainer.appendChild(variantIndicator);
        }
    }
}

// Initialize all weapon cards on first load
function initializeCards() {
    // Create all cards synchronously
    weaponsData.forEach(weapon => createWeaponCard(weapon));
}

// Find all image variants for a weapon
async function findImageVariants(weaponName) {
    const variantSuffixes = ['', '_a', '_b', '_c', '_d', '_e'];
    const availableVariants = [];
    
    for (const suffix of variantSuffixes) {
        const variations = generateFilenameVariations(weaponName, suffix);
        
        // Try each variation until we find one that exists
        for (const filename of variations) {
            const exists = await checkImageExists(filename);
            if (exists) {
                availableVariants.push({ variant: suffix, filename });
                break; // Found this variant, move to next suffix
            }
        }
    }
    
    return availableVariants;
}


// Switch image variant
function switchVariant(weaponId, variantIndex, filename) {
    const img = document.getElementById(`img-${weaponId}`);
    if (img) {
        loadImageWithRetry(img, `${filename}?v=${cacheBuster}`);
    }
    
    // Update active dot
    const card = img.closest('.weapon-card');
    const dots = card.querySelectorAll('.variant-dot');
    dots.forEach((dot, idx) => {
        if (idx === variantIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

// Switch image variant in modal
function switchModalVariant(weaponId, variantIndex, filename) {
    const img = document.getElementById(`modal-img-${weaponId}`);
    if (img) {
        loadImageWithRetry(img, `${filename}?v=${cacheBuster}`);
    }
    
    // Update active button
    const buttons = document.querySelectorAll('.skin-swap-btn');
    buttons.forEach((btn, idx) => {
        if (idx === variantIndex) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Fast render using cached cards
function renderWeapons() {
    const filtered = getFilteredWeapons();
    const grid = document.getElementById('weaponGrid');
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px; grid-column: 1/-1;">No weapons found matching your filters.</p>';
        updateDisplayedCount(0);
        return;
    }
    
    // Append cached cards from filtered weapons
    filtered.forEach(weapon => {
        const card = cardCache.get(weapon.id);
        if (card) {
            grid.appendChild(card);
        }
    });
    
    updateDisplayedCount(filtered.length);
}


// Update stats
function updateStats() {
    document.getElementById('totalCount').textContent = weaponsData.length;
    const categories = new Set(weaponsData.map(w => w.category));
    document.getElementById('categoryCount').textContent = categories.size;
}

function updateDisplayedCount(count) {
    document.getElementById('displayedCount').textContent = count;
}

// Open modal with detailed weapon info
async function openModal(weapon) {
    const modal = document.getElementById('modalOverlay');
    const modalBody = document.getElementById('modalBody');
    
    const variants = await findImageVariants(weapon.name);
    const currentImage = variants.length > 0 ? variants[0].filename : null;
    
    const imageHTML = currentImage ?
        `<img src="" alt="${weapon.name}" class="modal-weapon-image" id="modal-img-${weapon.id}">` :
        `<div style="font-size: 120px;">🔫</div>`;
    
    // Generate skin swapper controls if multiple variants exist
    const skinSwapperHTML = variants.length > 1 ? `
        <div class="modal-skin-swapper">
            <span class="skin-swapper-label">Skins:</span>
            <div class="skin-swapper-buttons">
                ${variants.map((v, idx) => {
                    const label = v.variant === '' ? 'Default' : v.variant.replace('_', '').toUpperCase();
                    return `<button class="skin-swap-btn ${idx === 0 ? 'active' : ''}" 
                                    data-weapon-id="${weapon.id}" 
                                    data-variant-index="${idx}" 
                                    data-filename="${v.filename}"
                                    onclick="switchModalVariant(${weapon.id}, ${idx}, '${v.filename}')">${label}</button>`;
                }).join('')}
            </div>
        </div>
    ` : '';
    
    const scriptsHTML = weapon.scripts ? `
        <div class="modal-scripts">
            <h3>📜 Scripts & Behaviors</h3>
            ${weapon.scripts.onFire && weapon.scripts.onFire !== '' ? `
                <div class="script-item">
                    <div class="script-label">On Fire:</div>
                    <div class="script-code">${weapon.scripts.onFire}</div>
                </div>
            ` : ''}
            ${weapon.scripts.onHit && weapon.scripts.onHit !== '' ? `
                <div class="script-item">
                    <div class="script-label">On Hit:</div>
                    <div class="script-code">${weapon.scripts.onHit}</div>
                </div>
            ` : ''}
            ${weapon.scripts.onCrit && weapon.scripts.onCrit !== '' ? `
                <div class="script-item">
                    <div class="script-label">On Crit:</div>
                    <div class="script-code">${weapon.scripts.onCrit}</div>
                </div>
            ` : ''}
            ${weapon.scripts.passive && weapon.scripts.passive !== '' ? `
                <div class="script-item">
                    <div class="script-label">Passive:</div>
                    <div class="script-code">${weapon.scripts.passive}</div>
                </div>
            ` : ''}
        </div>
    ` : '';
    
    // Load manufacturer icon
    const mfrIconPath = generateManufacturerIconPath(weapon.manufacturer);
    const mfrIconExists = await checkImageExists(mfrIconPath);
    const mfrIconHTML = mfrIconExists ?
        `<img src="" class="modal-manufacturer-icon" id="modal-mfr-icon-${weapon.id}" alt="${weapon.manufacturer}">` :
        '🏢';
    
    modalBody.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-weapon-name">${weapon.name}</h2>
            <div class="modal-weapon-meta">
                <span class="weapon-category">${weapon.category}</span>
                <span class="weapon-manufacturer" style="display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; background: rgba(92, 107, 192, 0.2); border-radius: 5px; border: 1px solid var(--text-muted);">${mfrIconHTML} ${weapon.manufacturer}</span>
                <span class="weapon-year" style="display: inline-block; padding: 4px 10px; background: rgba(255, 170, 0, 0.2); border-radius: 5px; border: 1px solid var(--accent-warning);">📅 ${weapon.yearOfManufacture}</span>
                <span style="display: inline-block; padding: 4px 10px; background: rgba(0, 217, 255, 0.2); border-radius: 5px; border: 1px solid var(--accent-primary); color: var(--accent-primary);">#${weapon.id}</span>
            </div>
        </div>
        
        <div class="modal-image-section">
            ${imageHTML}
            ${skinSwapperHTML}
        </div>
        
        <div class="modal-body-content">
            <div class="modal-description">
                ${weapon.description}
            </div>
            
            <h3 style="color: var(--accent-primary); margin-bottom: 15px;">📊 Statistics</h3>
            <div class="modal-stats-grid">
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Base Damage</span>
                    <span class="modal-stat-value">${weapon.stats?.baseDamage || 0}</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Crit Chance</span>
                    <span class="modal-stat-value">${weapon.stats?.critChance || 0}%</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Armor Pen</span>
                    <span class="modal-stat-value">${weapon.stats?.armorPenetration || 0}</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Range</span>
                    <span class="modal-stat-value">${weapon.stats?.range || 0}m</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Fire Rate</span>
                    <span class="modal-stat-value">${weapon.stats?.fireRate || 0}</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Projectile Speed</span>
                    <span class="modal-stat-value">${weapon.stats?.projectileSpeed || 0}</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Explosion Radius</span>
                    <span class="modal-stat-value">${weapon.stats?.explosionRadius || 0}m</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Ammo Type</span>
                    <span class="modal-stat-value" style="font-size: 1rem;">${weapon.stats?.ammoType || 'N/A'}</span>
                </div>
                <div class="modal-stat-item">
                    <span class="modal-stat-label">Ammo/Shot</span>
                    <span class="modal-stat-value">${weapon.stats?.ammoPerShot || 0}</span>
                </div>
            </div>
            
            ${weapon.stats?.aoeTickDamage && weapon.stats.aoeTickDamage !== 0 ? `
                <h3 style="color: var(--accent-secondary); margin-top: 20px; margin-bottom: 15px;">💥 Area Effects</h3>
                <div class="modal-stats-grid" style="grid-template-columns: repeat(2, 1fr);">
                    <div class="modal-stat-item">
                        <span class="modal-stat-label">Tick Damage</span>
                        <span class="modal-stat-value">${weapon.stats.aoeTickDamage}</span>
                    </div>
                    <div class="modal-stat-item">
                        <span class="modal-stat-label">Duration</span>
                        <span class="modal-stat-value">${weapon.stats.aoeDuration}s</span>
                    </div>
                </div>
            ` : ''}
            
            ${scriptsHTML}
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Load images with retry after modal is displayed
    if (currentImage) {
        const modalImg = document.getElementById(`modal-img-${weapon.id}`);
        if (modalImg) {
            loadImageWithRetry(modalImg, `${currentImage}?v=${cacheBuster}`);
        }
    }
    
    if (mfrIconExists) {
        const mfrIconImg = document.getElementById(`modal-mfr-icon-${weapon.id}`);
        if (mfrIconImg) {
            loadImageWithRetry(mfrIconImg, `${mfrIconPath}?v=${cacheBuster}`);
        }
    }
}

// Close modal
function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

// Toast notification system
function showToast(title, message, duration = 5000) {
    // Remove existing toast if present
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

// Show expected filename for missing image
function showExpectedFilename(weaponName) {
    const variations = generateFilenameVariations(weaponName, '');
    const primaryFilename = variations[0].replace('art/', '');
    
    showToast(
        '🖼️ Missing Image',
        `Expected: ${primaryFilename}<br><br>Tried ${variations.length} variations`
    );
}

// Show expected filename for missing manufacturer icon
function showExpectedManufacturerFilename(manufacturer) {
    const iconPath = generateManufacturerIconPath(manufacturer);
    const filename = iconPath.replace('art/', '');
    
    showToast(
        '🏢 Missing Icon',
        `Expected: ${filename}`
    );
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
