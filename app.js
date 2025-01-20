let vans = [];
let locations = [];

const GoogleMapsService = {
    distanceMatrix: null,

    init() {
        this.distanceMatrix = new google.maps.DistanceMatrixService();
    },

    async getDriveTime(location1, location2) {
        try {
            const response = await this.distanceMatrix.getDistanceMatrix({
                origins: [location1.name],
                destinations: [location2.name],
                travelMode: google.maps.TravelMode.DRIVING,
                unitSystem: google.maps.UnitSystem.METRIC,
            });

            if (response.rows[0].elements[0].status === 'OK') {
                // Convert seconds to minutes and round
                return Math.round(response.rows[0].elements[0].duration.value / 60);
            } else {
                console.error('Route not found between locations');
                return null;
            }
        } catch (error) {
            console.error('Error getting drive time:', error);
            return null;
        }
    }
};

async function getRouteTime(locationList) {
    let totalTime = 0;
    
    // Add up drive times between consecutive locations
    for (let i = 0; i < locationList.length - 1; i++) {
        const time = await GoogleMapsService.getDriveTime(
            locationList[i], 
            locationList[i + 1]
        );
        if (time === null) return null;
        totalTime += time;
    }
    
    // Add 5 minutes loading/unloading time per location
    totalTime += locationList.length * 5;
    
    return totalTime;
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
                   data-location-id="${location.id}">
            <input type="number" 
                   min="1" 
                   value="${location.passengerCount}"
                   onchange="updatePassengerCount('${location.id}', this.value)">
            <button onclick="deleteLocation('${location.id}')">Delete</button>
        </div>
    `).join('');

    // Initialize autocomplete for each location input
    document.querySelectorAll('.location-input').forEach(input => {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            fields: ['formatted_address', 'geometry'],
            types: ['address']
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
                const locationId = input.dataset.locationId;
                updateLocationName(locationId, place.formatted_address);
            }
        });
    });
}

function updateVanSeats(id, seats) {
    const van = vans.find(v => v.id === id);
    if (van) van.seatCount = parseInt(seats);
}

function updateLocationName(id, name) {
    const location = locations.find(l => l.id === id);
    if (location) {
        location.name = name;
        // Optionally store the formatted address for display
        location.formattedAddress = name;
    }
}

function updatePassengerCount(id, count) {
    const location = locations.find(l => l.id === id);
    if (location) location.passengerCount = parseInt(count);
}

function deleteVan(id) {
    vans = vans.filter(v => v.id !== id);
    // Renumber remaining vans
    vans.forEach((van, index) => {
        van.vanNumber = index + 1;
    });
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

async function calculateRoutes() {
    // Reset any previous results
    const results = [];
    let unassignedLocations = [...locations];
    
    // For each van, create a route
    for (const van of vans) {
        if (unassignedLocations.length === 0) break;
        
        const route = {
            vanNumber: van.vanNumber,
            seatCount: van.seatCount,
            locations: [],
            totalPassengers: 0,
            estimatedMinutes: 0
        };

        // Keep adding locations until we can't fit more passengers
        while (unassignedLocations.length > 0) {
            // Find the location that would add the least time to current route
            let bestLocation = null;
            let bestIndex = 0;
            let bestAddedTime = Infinity;

            for (const location of unassignedLocations) {
                // Skip if adding these passengers would exceed van capacity
                if (route.totalPassengers + location.passengerCount > van.seatCount) {
                    continue;
                }

                // Try inserting this location at each possible position
                for (let i = 0; i <= route.locations.length; i++) {
                    const testRoute = [...route.locations];
                    testRoute.splice(i, 0, location);
                    const newTime = await getRouteTime(testRoute);
                    if (newTime === null) continue;
                    const addedTime = newTime - route.estimatedMinutes;

                    if (addedTime < bestAddedTime) {
                        bestAddedTime = addedTime;
                        bestLocation = location;
                        bestIndex = i;
                    }
                }
            }

            // If we couldn't find a location to add, this van is done
            if (!bestLocation) break;

            // Add the best location found to the route
            route.locations.splice(bestIndex, 0, bestLocation);
            route.totalPassengers += bestLocation.passengerCount;
            route.estimatedMinutes = await getRouteTime(route.locations);
            
            // Remove this location from unassigned list
            unassignedLocations = unassignedLocations.filter(l => l.id !== bestLocation.id);
        }

        if (route.locations.length > 0) {
            results.push(route);
        }
    }

    // Check for unassigned locations
    if (unassignedLocations.length > 0) {
        alert('Warning: Not all locations could be assigned to routes. Need more vans or seats.');
    }

    displayRoutes(results);
}

// Initialize Google Maps service
GoogleMapsService.init();

function displayRoutes(routes) {
    // Create a results section if it doesn't exist
    let resultsSection = document.getElementById('results-section');
    if (!resultsSection) {
        resultsSection = document.createElement('section');
        resultsSection.id = 'results-section';
        document.querySelector('.container').appendChild(resultsSection);
    }

    resultsSection.innerHTML = `
        <h2>Calculated Routes</h2>
        ${routes.map(route => `
            <div class="route-item">
                <h3>Van ${route.vanNumber} (${route.totalPassengers}/${route.seatCount} seats)</h3>
                <p>Estimated time: ${route.estimatedMinutes} minutes</p>
                <ol>
                    ${route.locations.map(loc => 
                        `<li>${loc.name} (${loc.passengerCount} passengers)</li>`
                    ).join('')}
                </ol>
            </div>
        `).join('')}
    `;
}
