let vans = [];
let locations = [];

function addVan() {
    const van = {
        id: Date.now().toString(),
        seatCount: 6
    };
    vans.push(van);
    renderVans();
    updateCalculateButton();
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
}

function renderVans() {
    const vanList = document.getElementById('van-list');
    vanList.innerHTML = vans.map(van => `
        <div class="van-item">
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
                   placeholder="Location name" 
                   value="${location.name}"
                   onchange="updateLocationName('${location.id}', this.value)">
            <input type="number" 
                   min="1" 
                   max="5" 
                   value="${location.passengerCount}"
                   onchange="updatePassengerCount('${location.id}', this.value)">
            <button onclick="deleteLocation('${location.id}')">Delete</button>
        </div>
    `).join('');
}

function updateVanSeats(id, seats) {
    const van = vans.find(v => v.id === id);
    if (van) van.seatCount = parseInt(seats);
}

function updateLocationName(id, name) {
    const location = locations.find(l => l.id === id);
    if (location) location.name = name;
}

function updatePassengerCount(id, count) {
    const location = locations.find(l => l.id === id);
    if (location) location.passengerCount = parseInt(count);
}

function deleteVan(id) {
    vans = vans.filter(v => v.id !== id);
    renderVans();
    updateCalculateButton();
}

function deleteLocation(id) {
    locations = locations.filter(l => l.id !== id);
    renderLocations();
    updateCalculateButton();
}

function updateCalculateButton() {
    const button = document.getElementById('calculate');
    button.disabled = vans.length === 0 || locations.length === 0;
}

function calculateRoutes() {
    // This will be implemented next
    console.log('Calculating routes for:', {vans, locations});
}
