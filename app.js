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
    
    const manufacturerFilter = document.getElementById('manufacturerFilter');
    manufacturers.forEach(mfr => {
        const option = document.createElement('option');
        option.value = mfr;
        option.textContent = mfr;
        manufacturerFilter.appendChild(option);
    });
    
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
    document.getElementById('manufacturerFilter').addEventListener('change', (e) => {
        currentFilters.manufacturer = e.target.value;
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
    
    document.getElementById('searchBox').addEventListener('input', (e) => {
        currentFilters.search = e.target.value.toLowerCase();
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
    
    return `art/${filename}.png`;
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
    variations.push(`art/${base}${variantSuffix}.png`);
    
    // Try with trailing underscore (common pattern)
    if (variantSuffix === '') {
        variations.push(`art/${base}_.png`);
    } else {
        variations.push(`art/${base}_${variantSuffix}.png`);
    }
    
    // Try lowercase last word (common pattern like Arcline_Shock_baton)
    const parts = base.split('_');
    if (parts.length > 1) {
        const lastLower = [...parts.slice(0, -1), parts[parts.length - 1].toLowerCase()].join('_');
        variations.push(`art/${lastLower}${variantSuffix}.png`);
        if (variantSuffix === '') {
            variations.push(`art/${lastLower}_.png`);
        }
    }
    
    // Try with -sheet pattern for variants (like Fluxline_G3_Caseless-sheet.png)
    if (variantSuffix === '_a') {
        variations.push(`art/${base}-sheet_a.png`);
        if (parts.length > 1) {
            const lastLower = [...parts.slice(0, -1), parts[parts.length - 1].toLowerCase()].join('_');
            variations.push(`art/${lastLower}-sheet_a.png`);
        }
    } else if (variantSuffix === '') {
        variations.push(`art/${base}-sheet.png`);
        if (parts.length > 1) {
            const lastLower = [...parts.slice(0, -1), parts[parts.length - 1].toLowerCase()].join('_');
            variations.push(`art/${lastLower}-sheet.png`);
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
        img.src = url;
    });
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

// Create weapon card with image variant support
async function createWeaponCard(weapon) {
    const card = document.createElement('div');
    card.className = 'weapon-card';
    card.onclick = () => openModal(weapon);
    
    const variants = await findImageVariants(weapon.name);
    const currentImage = variants.length > 0 ? variants[0].filename : null;
    
    const imageHTML = currentImage ?
        `<img src="${currentImage}" alt="${weapon.name}" class="weapon-image" id="img-${weapon.id}">` :
        `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext x='50' y='50' text-anchor='middle' dominant-baseline='middle' font-size='40' fill='%235c6bc0'%3E🔫%3C/text%3E%3C/svg%3E" alt="Placeholder" class="weapon-image placeholder">`;
    
    // Add missing image indicator if no image found
    const missingImageHTML = !currentImage ? `
        <div class="missing-image-indicator" data-weapon-name="${weapon.name.replace(/"/g, '&quot;')}" onclick="event.stopPropagation(); showExpectedFilename(this.getAttribute('data-weapon-name'))">✕</div>
    ` : '';
    
    const variantsHTML = variants.length > 1 ? `
        <div class="image-variant-indicator">
            ${variants.map((v, idx) => 
                `<span class="variant-dot ${idx === 0 ? 'active' : ''}" 
                      data-weapon-id="${weapon.id}" 
                      data-variant-index="${idx}" 
                      data-filename="${v.filename}"
                      onclick="event.stopPropagation(); switchVariant(${weapon.id}, ${idx}, '${v.filename}')"></span>`
            ).join('')}
        </div>
    ` : '';
    
    card.innerHTML = `
        <div class="weapon-image-container">
            <div class="weapon-id">#${weapon.id}</div>
            ${imageHTML}
            ${missingImageHTML}
            ${variantsHTML}
        </div>
        <div class="weapon-info">
            <h3 class="weapon-name">${weapon.name}</h3>
            <span class="weapon-category">${weapon.category}</span>
            <p class="weapon-manufacturer">🏢 ${weapon.manufacturer}</p>
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
    
    return card;
}

// Switch image variant
function switchVariant(weaponId, variantIndex, filename) {
    const img = document.getElementById(`img-${weaponId}`);
    if (img) {
        img.src = filename;
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
        img.src = filename;
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

// Render weapons
async function renderWeapons() {
    const filtered = getFilteredWeapons();
    const grid = document.getElementById('weaponGrid');
    grid.innerHTML = '';
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px; grid-column: 1/-1;">No weapons found matching your filters.</p>';
        updateDisplayedCount(0);
        return;
    }
    
    // Create all cards in parallel, then append them in order
    const cardPromises = filtered.map(weapon => createWeaponCard(weapon));
    const cards = await Promise.all(cardPromises);
    
    cards.forEach(card => grid.appendChild(card));
    
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
        `<img src="${currentImage}" alt="${weapon.name}" class="modal-weapon-image" id="modal-img-${weapon.id}">` :
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
    
    modalBody.innerHTML = `
        <div class="modal-header">
            <h2 class="modal-weapon-name">${weapon.name}</h2>
            <div class="modal-weapon-meta">
                <span class="weapon-category">${weapon.category}</span>
                <span class="weapon-manufacturer" style="display: inline-block; padding: 4px 10px; background: rgba(92, 107, 192, 0.2); border-radius: 5px; border: 1px solid var(--text-muted);">🏢 ${weapon.manufacturer}</span>
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
