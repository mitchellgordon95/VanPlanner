let vans = [];
let locations = [];
let depot = {
    name: '',
    id: 'depot'
};

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

async function calculateRoutes() {
    document.querySelector('.loading-overlay').style.display = 'flex';
    try {
        const response = await fetch('/api/calculate-routes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                depot,
                vans,
                locations
            })
        });
        
        const results = await response.json();
        displayRoutes(results);
    } catch (error) {
        console.error('Error calculating routes:', error);
        alert('An error occurred while calculating routes. Please try again.');
    } finally {
        document.querySelector('.loading-overlay').style.display = 'none';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initializeDepotAutocomplete();
});
