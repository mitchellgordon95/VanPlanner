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
    console.log(`\nCalculating savings between: 
        Location 1: ${location1.name}
        Location 2: ${location2.name}`);
    
    const depot1Time = await GoogleMapsService.getDriveTime(depot, location1);
    const depot2Time = await GoogleMapsService.getDriveTime(depot, location2);
    const location1to2Time = await GoogleMapsService.getDriveTime(location1, location2);
    
    console.log(`Drive times:
        Depot → Location1: ${depot1Time} minutes
        Depot → Location2: ${depot2Time} minutes
        Location1 → Location2: ${location1to2Time} minutes`);
    
    if (depot1Time === null || depot2Time === null || location1to2Time === null) {
        console.log('Error: Could not calculate one or more drive times');
        return null;
    }
    
    const savings = (depot1Time * 2) + (depot2Time * 2) - (depot1Time + location1to2Time + depot2Time);
    console.log(`Calculated savings: ${savings} minutes`);
    return savings;
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
    
    // Add 2.5 minutes loading/unloading time per location
    totalTime += locationList.length * 2.5;
    
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
    // Show loading overlay
    document.querySelector('.loading-overlay').style.display = 'flex';
    
    try {
        console.log('\n=== Starting Route Calculation ===');
    console.log('Initial state:', 
        '\nDepot:', depot,
        '\nVans:', vans,
        '\nLocations:', locations);

    // Validation
    const unselectedLocations = document.querySelectorAll('.location-input[data-selected="false"]');
    if (unselectedLocations.length > 0) {
        console.log('Validation failed: Unselected locations found');
        alert('Error: Some addresses are not properly selected from the dropdown. Please select a complete address for each location.');
        return;
    }

    console.log('\n--- Calculating Savings Matrix ---');
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

    savingsList.sort((a, b) => b.savings - a.savings);
    console.log('\nSorted savings list:', savingsList.map(s => ({
        location1: s.location1.name,
        location2: s.location2.name,
        savings: s.savings
    })));

    console.log('\n--- Initializing Routes ---');
    let routes = locations.map(location => ({
        locations: [location],
        totalPassengers: location.passengerCount,
        vanAssigned: false
    }));
    console.log('Initial routes:', routes);

    console.log('\n--- Merging Routes Based on Savings ---');
    for (const saving of savingsList) {
        console.log(`\nProcessing saving pair:
            Location 1: ${saving.location1.name}
            Location 2: ${saving.location2.name}
            Potential saving: ${saving.savings} minutes`);

        const route1 = routes.find(r => r.locations.includes(saving.location1));
        const route2 = routes.find(r => r.locations.includes(saving.location2));

        if (route1.vanAssigned || route2.vanAssigned) {
            console.log('Skip: One or both routes already assigned to a van');
            continue;
        }

        if (route1 === route2) {
            console.log('Skip: Locations already in same route');
            continue;
        }

        const totalPassengers = route1.totalPassengers + route2.totalPassengers;
        console.log(`Combined passengers: ${totalPassengers}`);

        const suitableVan = vans.find(van => 
            van.seatCount >= totalPassengers && 
            !routes.some(r => r.vanAssigned && r.assignedVan === van)
        );

        if (suitableVan) {
            console.log(`Found suitable van: Van ${suitableVan.vanNumber} (${suitableVan.seatCount} seats)`);
            
            const mergedLocations = [...route1.locations, ...route2.locations];
            const estimatedMinutes = await getRouteTime(mergedLocations);
            
            console.log(`Merged route details:
                Locations: ${mergedLocations.map(l => l.name).join(' → ')}
                Total time: ${estimatedMinutes} minutes`);

            const mergedRoute = {
                locations: mergedLocations,
                totalPassengers: totalPassengers,
                vanAssigned: true,
                assignedVan: suitableVan,
                estimatedMinutes: estimatedMinutes
            };

            routes = routes.filter(r => r !== route1 && r !== route2);
            routes.push(mergedRoute);
            console.log('Routes after merge:', routes);
        } else {
            console.log('No suitable van found for merge');
        }
    }

    console.log('\n--- Processing Remaining Single-Location Routes ---');
    for (let route of routes) {
        if (!route.vanAssigned) {
            console.log(`\nProcessing unassigned route: ${route.locations[0].name}`);
            // Find van with sufficient seats and shortest current route
            const suitableVans = vans.filter(van => van.seatCount >= route.totalPassengers);
        
            if (suitableVans.length > 0) {
                // Find which van has the shortest current route
                let shortestTime = Infinity;
                let bestVan = null;
            
                for (const van of suitableVans) {
                    const currentRoute = routes.find(r => r.vanAssigned && r.assignedVan === van);
                    const routeTime = currentRoute ? currentRoute.estimatedMinutes : 0;
                    if (routeTime < shortestTime) {
                        shortestTime = routeTime;
                        bestVan = van;
                    }
                }
            
                console.log(`Assigned to Van ${bestVan.vanNumber} as second trip`);
                route.vanAssigned = true;
                route.assignedVan = bestVan;
                route.estimatedMinutes = await getRouteTime(route.locations);
                route.isSecondTrip = true;
            }
        }
    }

    console.log('\n--- Final Routes ---');
    const results = routes
        .filter(route => route.vanAssigned)
        .map(route => ({
            vanNumber: route.assignedVan.vanNumber,
            seatCount: route.assignedVan.seatCount,
            locations: route.locations,
            totalPassengers: route.totalPassengers,
            estimatedMinutes: route.estimatedMinutes
        }));
    console.log('Results:', results);

    const unassignedLocations = routes
        .filter(route => !route.vanAssigned)
        .flatMap(route => route.locations);

    if (unassignedLocations.length > 0) {
        console.log('Warning: Unassigned locations:', unassignedLocations);
        alert('Warning: Not all locations could be assigned to routes. Need more vans or seats.');
    }

    displayRoutes(results);
    } catch (error) {
        console.error('Error calculating routes:', error);
        alert('An error occurred while calculating routes. Please try again.');
    } finally {
        // Hide loading overlay
        document.querySelector('.loading-overlay').style.display = 'none';
    }
}

// Initialize Google Maps service
GoogleMapsService.init();
loadState();

function displayRoutes(routes) {
    console.log('displayRoutes called with:', routes);
    
    let resultsSection = document.getElementById('results-section');
    if (!resultsSection) {
        resultsSection = document.createElement('section');
        resultsSection.id = 'results-section';
        document.querySelector('.container').appendChild(resultsSection);
    }

    // Group routes by van
    const vanRoutes = {};
    routes.forEach(route => {
        const vanNumber = route.vanNumber || route.assignedVan.vanNumber;
        if (!vanRoutes[vanNumber]) {
            vanRoutes[vanNumber] = [];
        }
        vanRoutes[vanNumber].push(route);
    });

    console.log('Grouped vanRoutes:', vanRoutes);

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
                                `<li>${loc.name} (${loc.passengerCount} passengers)</li>`
                            ).join('')}
                        </ol>
                    </div>
                `).join('')}
            </div>
        `).join('')}
    `;
}
