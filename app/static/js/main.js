let vans = [];
let locations = [];
let depot = {
    name: '',
    id: 'depot'
};

function loadState() {
    const savedVans = localStorage.getItem('vans');
    const savedLocations = localStorage.getItem('locations');
    const savedDepot = localStorage.getItem('depot');
    
    if (savedVans) vans = JSON.parse(savedVans);
    if (savedLocations) locations = JSON.parse(savedLocations);
    if (savedDepot) depot = JSON.parse(savedDepot);
    
    renderVans();
    renderLocations();
    initializeDepotAutocomplete();
    
    document.querySelectorAll('.location-input').forEach(input => {
        if (input.value) {
            input.dataset.selected = 'true';
        }
    });
    
    updateCalculateButton();
}

function saveVans() {
    localStorage.setItem('vans', JSON.stringify(vans));
}

function saveLocations() {
    localStorage.setItem('locations', JSON.stringify(locations));
}

function addVan() {
    const van = {
        id: Date.now().toString(),
        seatCount: 6,
        vanNumber: vans.length + 1
    };
    vans.push(van);
    renderVans();
    updateCalculateButton();
    saveVans();
}

function addLocation() {
    const location = {
        id: Date.now().toString(),
        name: '',
        passengerCount: 1
    };
    locations.push(location);
    renderLocations();
    updateCalculateButton();
    saveLocations();
}

function renderVans() {
    const vanList = document.getElementById('van-list');
    vanList.innerHTML = vans.map(van => `
        <div class="van-item">
            <span>Van ${van.vanNumber}</span>
            <label>Seats:
                <select onchange="updateVanSeats('${van.id}', this.value)">
                    <option value="6" ${van.seatCount === 6 ? 'selected' : ''}>6</option>
                    <option value="7" ${van.seatCount === 7 ? 'selected' : ''}>7</option>
                </select>
            </label>
            <button onclick="deleteVan('${van.id}')">Delete</button>
        </div>
    `).join('');
}

function renderLocations() {
    const locationList = document.getElementById('location-list');
    locationList.innerHTML = locations.map(location => `
        <div class="location-item">
            <input type="text" 
                   class="location-input"
                   placeholder="Enter address" 
                   value="${location.name}"
                   data-location-id="${location.id}"
                   data-selected="false">
            <input type="number" 
                   min="1" 
                   value="${location.passengerCount}"
                   onchange="updatePassengerCount('${location.id}', this.value)">
            <button onclick="deleteLocation('${location.id}')">Delete</button>
        </div>
    `).join('');

    initializeLocationAutocomplete();
}

function initializeLocationAutocomplete() {
    document.querySelectorAll('.location-input').forEach(input => {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            fields: ['formatted_address'],
            types: ['address']
        });

        input.addEventListener('input', () => {
            input.dataset.selected = 'false';
            updateCalculateButton();
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
                const locationId = input.dataset.locationId;
                input.dataset.selected = 'true';
                updateLocationName(locationId, place.formatted_address);
                updateCalculateButton();
            }
        });
    });
}

function updateVanSeats(id, seats) {
    const van = vans.find(v => v.id === id);
    if (van) {
        van.seatCount = parseInt(seats);
        saveVans();
    }
}

function updateLocationName(id, name) {
    const location = locations.find(l => l.id === id);
    if (location) {
        if (!/\d/.test(name)) {
            alert('Warning: This address may be missing a street number. Please enter a complete street address for accurate routing.');
        }
        
        location.name = name;
        location.formattedAddress = name;
        saveLocations();
    }
}

function updatePassengerCount(id, count) {
    const location = locations.find(l => l.id === id);
    if (location) {
        location.passengerCount = parseInt(count);
        saveLocations();
    }
}

function deleteVan(id) {
    vans = vans.filter(v => v.id !== id);
    vans.forEach((van, index) => {
        van.vanNumber = index + 1;
    });
    renderVans();
    updateCalculateButton();
    saveVans();
}

function deleteLocation(id) {
    locations = locations.filter(l => l.id !== id);
    renderLocations();
    updateCalculateButton();
    saveLocations();
}

function initializeDepotAutocomplete() {
    const input = document.getElementById('depot-input');
    input.value = depot.name;
    input.dataset.selected = depot.name ? 'true' : 'false';
    
    const autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ['formatted_address'],
        types: ['address']
    });

    input.addEventListener('input', () => {
        input.dataset.selected = 'false';
        updateCalculateButton();
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
            depot.name = place.formatted_address;
            input.dataset.selected = 'true';
            localStorage.setItem('depot', JSON.stringify(depot));
            updateCalculateButton();
        }
    });
}

function updateCalculateButton() {
    const button = document.getElementById('calculate');
    const depotInput = document.getElementById('depot-input');
    const locationInputs = document.querySelectorAll('.location-input');
    const allLocationsSelected = Array.from(locationInputs).every(input => input.dataset.selected === 'true');
    const depotSelected = depotInput.dataset.selected === 'true';
    
    button.disabled = vans.length === 0 || 
                     locations.length === 0 || 
                     !depotSelected ||
                     !allLocationsSelected;
}

function clearData() {
    if (confirm('Are you sure you want to clear all saved data?')) {
        localStorage.clear();
        locations = [];
        vans = [];
        depot = { name: '', id: 'depot' };
        renderVans();
        renderLocations();
        document.getElementById('depot-input').value = '';
        updateCalculateButton();
        
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.innerHTML = '';
        }
    }
}

function displayRoutes(routes) {
    let resultsSection = document.getElementById('results-section');
    if (!resultsSection) {
        resultsSection = document.createElement('section');
        resultsSection.id = 'results-section';
        document.querySelector('.container').appendChild(resultsSection);
    }

    const vanRoutes = {};
    routes.forEach(route => {
        const vanNumber = route.vanNumber || route.assignedVan.vanNumber;
        if (!vanRoutes[vanNumber]) {
            vanRoutes[vanNumber] = [];
        }
        vanRoutes[vanNumber].push(route);
    });

    resultsSection.innerHTML = `
        <h2>Calculated Routes</h2>
        ${Object.entries(vanRoutes).map(([vanNumber, vanRoutes]) => `
            <div class="route-item">
                <h3>Van ${vanNumber}</h3>
                ${vanRoutes.map((route, index) => `
                    <div ${route.isSecondTrip ? 'style="color: red;"' : ''}>
                        <p>${route.isSecondTrip ? 'Second Trip - ' : ''}
                           ${route.totalPassengers}/${route.seatCount || route.assignedVan.seatCount} seats, 
                           Estimated time: ${route.estimatedMinutes} minutes RT</p>
                        <ol>
                            ${route.locations.map(loc => 
                                `<li>${loc.name} ${loc.splitInfo || ''} (${loc.passengerCount} passengers)</li>`
                            ).join('')}
                        </ol>
                    </div>
                `).join('')}
            </div>
        `).join('')}
    `;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initializeDepotAutocomplete();
});
