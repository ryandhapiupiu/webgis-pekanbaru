// ===== FITUR BARU: Search, Bookmark, Routing =====
let allFacilities = []; // Untuk menyimpan semua fasilitas
let currentRoute = null; // Untuk menyimpan rute saat ini
let bookmarks = JSON.parse(localStorage.getItem('webgisBookmarks') || '[]'); // Load bookmarks dari localStorage
let routeOrigin = null;
let routeDestination = null;
let routeLayer = null;
let routeMarkersLayer = null;
let routeSelectMode = null;

function initializeFeatures() {
    // Toggle Search Panel
    const toggleSearch = document.getElementById('toggleSearch');
    if (toggleSearch) {
        toggleSearch.addEventListener('click', () => {
            const panel = document.getElementById('searchPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Toggle Bookmarks Panel
    const toggleBookmarks = document.getElementById('toggleBookmarks');
    if (toggleBookmarks) {
        toggleBookmarks.addEventListener('click', () => {
            const panel = document.getElementById('bookmarksPanel');
            panel.classList.toggle('show');
            renderBookmarks();
        });
    }

    // Routing panel
    const routingToggle = document.getElementById('routingToggle');
    const routePanel = document.getElementById('routePanel');
    const useGpsBtn = document.getElementById('useGpsBtn');
    const pickOriginBtn = document.getElementById('pickOriginBtn');
    const pickDestBtn = document.getElementById('pickDestBtn');
    const routeButton = document.getElementById('routeButton');

    if (routingToggle && routePanel) {
        routingToggle.addEventListener('click', () => {
            const isActive = routingToggle.classList.toggle('active');
            routePanel.classList.toggle('active', isActive);
        });
    }

    if (useGpsBtn) {
        useGpsBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Browser Anda tidak mendukung GPS.');
                return;
            }
            navigator.geolocation.getCurrentPosition((position) => {
                setRoutePoint('origin', {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    name: 'Lokasi Saya'
                });
                if (typeof map !== 'undefined' && map) {
                    map.setView([position.coords.latitude, position.coords.longitude], 14);
                }
            }, () => {
                alert('Gagal mendapatkan lokasi GPS.');
            }, {
                enableHighAccuracy: true,
                timeout: 10000
            });
        });
    }

    if (pickOriginBtn) {
        pickOriginBtn.addEventListener('click', () => {
            beginRouteSelection('origin');
        });
    }

    if (pickDestBtn) {
        pickDestBtn.addEventListener('click', () => {
            beginRouteSelection('destination');
        });
    }

    if (routeButton) {
        routeButton.addEventListener('click', () => {
            calculateRoute();
        });
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const resultsDiv = document.getElementById('searchResults');
            resultsDiv.innerHTML = '';

            if (query.length < 2) return;

            const results = allFacilities.filter(f => 
                f.name.toLowerCase().includes(query) ||
                f.type.toLowerCase().includes(query)
            ).slice(0, 10);

            if (results.length === 0) {
                resultsDiv.innerHTML = '<div style="padding: 12px; color: var(--text-light); text-align: center;">Tidak ada hasil</div>';
                return;
            }

            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `<strong>${result.name}</strong><br><small>${result.type}</small>`;
                item.addEventListener('click', () => {
                    if (typeof map !== 'undefined' && map) {
                        map.setView([result.lat, result.lng], 16);
                        if (result.marker) {
                            result.marker.openPopup();
                        }
                    }
                });
                resultsDiv.appendChild(item);
            });
        });
    }

    // Hook hero search (landing) to main search
    const heroSearch = document.getElementById('heroSearch');
    const heroSearchBtn = document.getElementById('heroSearchBtn');
    if (heroSearch) {
        heroSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const q = heroSearch.value.trim();
                if (q && searchInput) {
                    searchInput.value = q;
                    searchInput.dispatchEvent(new Event('input'));
                    document.getElementById('toggleSearch')?.click();
                }
            }
        });
    }
    if (heroSearchBtn) {
        heroSearchBtn.addEventListener('click', () => {
            const q = heroSearch.value.trim();
            if (q && searchInput) {
                searchInput.value = q;
                searchInput.dispatchEvent(new Event('input'));
                document.getElementById('toggleSearch')?.click();
            }
        });
    }

    renderBookmarks();
    updateRouteFields();
}

function beginRouteSelection(type) {
    if (typeof map === 'undefined' || map === null) {
        alert('Peta belum tersedia. Silakan buka peta terlebih dahulu.');
        return;
    }

    alert(`Klik pada peta untuk memilih ${type === 'origin' ? 'titik awal' : 'titik tujuan'}.`);
    routeSelectMode = type;

    map.once('click', (event) => {
        setRoutePoint(type, {
            lat: event.latlng.lat,
            lng: event.latlng.lng,
            name: `Koordinat ${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`
        });
        routeSelectMode = null;
    });
}

function setRoutePoint(type, point) {
    if (type === 'origin') {
        routeOrigin = point;
    } else {
        routeDestination = point;
    }
    updateRouteFields();
}

function updateRouteFields() {
    const originInput = document.getElementById('routeOriginInput');
    const destInput = document.getElementById('routeDestInput');
    const routeButton = document.getElementById('routeButton');

    if (originInput) {
        originInput.value = routeOrigin ? routeOrigin.name : '';
        originInput.placeholder = routeOrigin ? routeOrigin.name : 'Ketik nama lokasi atau pilih GPS';
    }
    if (destInput) {
        destInput.value = routeDestination ? routeDestination.name : '';
        destInput.placeholder = routeDestination ? routeDestination.name : 'Ketik nama lokasi tujuan...' ;
    }
    if (routeButton) {
        routeButton.disabled = !(routeOrigin && routeDestination);
    }
}

function calculateRoute() {
    const routeSummary = document.getElementById('routeSummary');
    if (!routeOrigin || !routeDestination) {
        alert('Silakan pilih titik awal dan tujuan terlebih dahulu.');
        return;
    }

    if (routeLayer) {
        routeLayer.remove();
        routeLayer = null;
    }
    if (routeMarkersLayer) {
        routeMarkersLayer.remove();
        routeMarkersLayer = null;
    }

    const coordOrigin = `${routeOrigin.lng},${routeOrigin.lat}`;
    const coordDest = `${routeDestination.lng},${routeDestination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordOrigin};${coordDest}?overview=full&geometries=geojson&alternatives=false&steps=false`;

    routeSummary.style.display = 'block';
    routeSummary.innerHTML = 'Menghitung rute...';

    fetch(url)
        .then((response) => response.json())
        .then((data) => {
            if (!data.routes || data.routes.length === 0) {
                throw new Error('Rute tidak ditemukan');
            }

            const routeGeo = data.routes[0].geometry;
            const distance = data.routes[0].distance;
            const duration = data.routes[0].duration;

            routeLayer = L.geoJSON(routeGeo, {
                style: {
                    color: '#2563eb',
                    weight: 6,
                    opacity: 0.85
                }
            }).addTo(map);

            routeMarkersLayer = L.layerGroup();
            const startMarker = L.circleMarker([routeOrigin.lat, routeOrigin.lng], {
                radius: 8,
                color: '#0ea5e9',
                fillColor: '#bfdbfe',
                fillOpacity: 0.9
            }).bindPopup(`<strong>Awal</strong><br>${routeOrigin.name}`);
            const endMarker = L.circleMarker([routeDestination.lat, routeDestination.lng], {
                radius: 8,
                color: '#10b981',
                fillColor: '#d1fae5',
                fillOpacity: 0.9
            }).bindPopup(`<strong>Tujuan</strong><br>${routeDestination.name}`);

            routeMarkersLayer.addLayer(startMarker);
            routeMarkersLayer.addLayer(endMarker);
            routeMarkersLayer.addTo(map);

            const bounds = routeLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds.pad(0.2));
            }

            routeSummary.innerHTML = `
                <strong>Rute Ditemukan</strong>
                Jarak: ${formatDistance(distance)}<br>
                Estimasi waktu: ${formatDuration(duration)}
            `;
        })
        .catch((error) => {
            console.error(error);
            routeSummary.innerHTML = 'Gagal menghitung rute. Coba lagi nanti.';
        });
}

function formatDistance(meters) {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60);
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remaining = minutes % 60;
        return `${hours} jam ${remaining} menit`;
    }
    return `${minutes} menit`;
}

function addBookmark(facility) {
    if (!bookmarks.find(b => b.name === facility.name)) {
        bookmarks.push(facility);
        localStorage.setItem('webgisBookmarks', JSON.stringify(bookmarks));
        renderBookmarks();
    }
}

function removeBookmark(name) {
    bookmarks = bookmarks.filter(b => b.name !== name);
    localStorage.setItem('webgisBookmarks', JSON.stringify(bookmarks));
    renderBookmarks();
}

function renderBookmarks() {
    const list = document.getElementById('bookmarksList');
    if (!list) return;
    
    if (bookmarks.length === 0) {
        list.innerHTML = '<p style="color: var(--text-light); text-align: center; margin: 20px 0;">Belum ada favorit</p>';
        return;
    }

    list.innerHTML = bookmarks.map(b => `
        <div class="bookmark-item">
            <div class="bookmark-item-info" onclick="if(typeof map !== 'undefined' && map) map.setView([${b.lat}, ${b.lng}], 16)">
                <div class="bookmark-item-name">${b.name}</div>
                <div class="bookmark-item-type">${b.type}</div>
            </div>
            <button class="bookmark-remove" onclick="removeBookmark('${b.name.replace(/'/g, "\\'")}')">×</button>
        </div>
    `).join('');
}

function addFacilityToSearch(name, type, lat, lng, marker = null) {
    if (!allFacilities.find(f => f.name === name)) {
        allFacilities.push({ name, type, lat, lng, marker });
    }
}

// Initialize features when DOM is ready
document.addEventListener('DOMContentLoaded', initializeFeatures);
