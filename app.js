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
    
    // Mark loaded locations as selected
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

async function calculateSavings(location1, location2) {
    // Get costs (times) between locations
    const depot1Time = await GoogleMapsService.getDriveTime(depot, location1);
    const depot2Time = await GoogleMapsService.getDriveTime(depot, location2);
    const location1to2Time = await GoogleMapsService.getDriveTime(location1, location2);
    
    if (depot1Time === null || depot2Time === null || location1to2Time === null) {
        return null;
    }
    
    // Calculate savings: (depot→1→depot) + (depot→2→depot) - (depot→1→2→depot)
    return (depot1Time * 2) + (depot2Time * 2) - (depot1Time + location1to2Time + depot2Time);
}

async function getRouteTime(locationList) {
    let totalTime = 0;
    
    // Add time from depot to first location
    const startTime = await GoogleMapsService.getDriveTime(depot, locationList[0]);
    if (startTime === null) return null;
    totalTime += startTime;
    
    // Add up drive times between consecutive locations
    for (let i = 0; i < locationList.length - 1; i++) {
        const time = await GoogleMapsService.getDriveTime(
            locationList[i], 
            locationList[i + 1]
        );
        if (time === null) return null;
        totalTime += time;
    }
    
    // Add time from last location back to depot
    const endTime = await GoogleMapsService.getDriveTime(
        locationList[locationList.length - 1], 
        depot
    );
    if (endTime === null) return null;
    totalTime += endTime;
    
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

    // Initialize autocomplete for each location input
    document.querySelectorAll('.location-input').forEach(input => {
        const autocomplete = new google.maps.places.Autocomplete(input, {
            fields: ['formatted_address', 'geometry', 'address_components'],
            types: ['address']
        });

        // Mark as unselected when user types
        input.addEventListener('input', () => {
            input.dataset.selected = 'false';
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.formatted_address) {
                const locationId = input.dataset.locationId;
                
                // Check if address has a street number
                const hasStreetNumber = place.address_components?.some(
                    component => component.types.includes('street_number')
                );
                
                if (!hasStreetNumber) {
                    alert('Warning: This address may be missing a street number. Please enter a complete street address for accurate routing.');
                }
                
                input.dataset.selected = 'true';
                updateLocationName(locationId, place.formatted_address);
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
        // Check if address contains numbers (likely a street number)
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
    // Renumber remaining vans
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
    
    const autocomplete = new google.maps.places.Autocomplete(input, {
        fields: ['formatted_address'],
        types: ['address']
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
            depot.name = place.formatted_address;
            localStorage.setItem('depot', JSON.stringify(depot));
            updateCalculateButton();
        }
    });
}

function updateCalculateButton() {
    const button = document.getElementById('calculate');
    button.disabled = vans.length === 0 || 
                     locations.length === 0 || 
                     !depot.name;
}

async function calculateRoutes() {
    // Validation
    const unselectedLocations = document.querySelectorAll('.location-input[data-selected="false"]');
    if (unselectedLocations.length > 0) {
        alert('Error: Some addresses are not properly selected from the dropdown. Please select a complete address for each location.');
        return;
    }

    // Calculate savings for all location pairs
    const savingsList = [];
    for (let i = 0; i < locations.length; i++) {
        for (let j = i + 1; j < locations.length; j++) {
            const savings = await calculateSavings(locations[i], locations[j]);
            if (savings !== null) {
                savingsList.push({
                    location1: locations[i],
                    location2: locations[j],
                    savings: savings
                });
            }
        }
    }

    // Sort savings in descending order
    savingsList.sort((a, b) => b.savings - a.savings);

    // Initialize routes (one per location initially)
    let routes = locations.map(location => ({
        locations: [location],
        totalPassengers: location.passengerCount,
        vanAssigned: false
    }));

    // Merge routes based on savings
    for (const saving of savingsList) {
        // Find routes containing these locations
        const route1 = routes.find(r => r.locations.includes(saving.location1));
        const route2 = routes.find(r => r.locations.includes(saving.location2));

        // Skip if either location is already in a route with a van assigned
        if (route1.vanAssigned || route2.vanAssigned) continue;

        // Skip if they're already in the same route
        if (route1 === route2) continue;

        // Calculate total passengers for combined route
        const totalPassengers = route1.totalPassengers + route2.totalPassengers;

        // Find smallest van that can accommodate these passengers
        const suitableVan = vans.find(van => 
            van.seatCount >= totalPassengers && 
            !routes.some(r => r.vanAssigned && r.assignedVan === van)
        );

        if (suitableVan) {
            // Merge routes
            const mergedLocations = [...route1.locations];
            
            // Add route2 locations to the end
            mergedLocations.push(...route2.locations);

            // Create new merged route
            const mergedRoute = {
                locations: mergedLocations,
                totalPassengers: totalPassengers,
                vanAssigned: true,
                assignedVan: suitableVan,
                estimatedMinutes: await getRouteTime(mergedLocations)
            };

            // Remove old routes and add merged route
            routes = routes.filter(r => r !== route1 && r !== route2);
            routes.push(mergedRoute);
        }
    }

    // Assign remaining single-location routes to vans if possible
    for (let route of routes) {
        if (!route.vanAssigned) {
            const suitableVan = vans.find(van => 
                van.seatCount >= route.totalPassengers && 
                !routes.some(r => r.vanAssigned && r.assignedVan === van)
            );

            if (suitableVan) {
                route.vanAssigned = true;
                route.assignedVan = suitableVan;
                route.estimatedMinutes = await getRouteTime(route.locations);
            }
        }
    }

    // Format results for display
    const results = routes
        .filter(route => route.vanAssigned)
        .map(route => ({
            vanNumber: route.assignedVan.vanNumber,
            seatCount: route.assignedVan.seatCount,
            locations: route.locations,
            totalPassengers: route.totalPassengers,
            estimatedMinutes: route.estimatedMinutes
        }));

    // Check for unassigned locations
    const unassignedLocations = routes
        .filter(route => !route.vanAssigned)
        .flatMap(route => route.locations);

    if (unassignedLocations.length > 0) {
        alert('Warning: Not all locations could be assigned to routes. Need more vans or seats.');
    }

    displayRoutes(results);
}

// Initialize Google Maps service
GoogleMapsService.init();
loadState();

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
