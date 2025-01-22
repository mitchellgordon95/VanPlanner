let vans = [];
let locations = [];
let depot = {
    name: '',
    id: 'depot'
};

function splitOverflowLocations(locationList, maxCapacity) {
    return locationList.flatMap(loc => {
        // If location doesn't exceed capacity, return as is
        if (loc.passengerCount <= maxCapacity) {
            return [{
                ...loc,
                vanAssigned: false,
                assignedVan: null,
                isSecondTrip: false
            }];
        }
        
        // Calculate how many trips needed
        const numTrips = Math.ceil(loc.passengerCount / maxCapacity);
        let remainingPassengers = loc.passengerCount;
        const splits = [];
        
        // Create each trip
        for (let i = 0; i < numTrips; i++) {
            const passengersThisTrip = Math.min(maxCapacity, remainingPassengers);
            splits.push({
                ...loc,
                id: `${loc.id}-trip${i + 1}`,
                passengerCount: passengersThisTrip,
                originalLocation: true,
                splitInfo: `Trip ${i + 1} of ${numTrips}`,
                vanAssigned: false,
                assignedVan: null,
                isSecondTrip: false
            });
            remainingPassengers -= passengersThisTrip;
        }
        
        return splits;
    });
}

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
        Location 1: ${location1.name} ${location1.splitInfo || ''}
        Location 2: ${location2.name} ${location2.splitInfo || ''}`);
    
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
                    ${[...Array(10)].map((_, i) => 
                        `<option value="${i + 1}" ${van.seatCount === i + 1 ? 'selected' : ''}>${i + 1}</option>`
                    ).join('')}
                </select>
            </label>
            <button onclick="deleteVan('${van.id}')">Delete</button>
        </div>
    `).join('');
}

function renderLocations() {
    console.log('Rendering locations:', locations);
    const locationList = document.getElementById('location-list');
    locationList.innerHTML = locations.map(location => `
        <div class="location-item">
            <input type="text" 
                   class="location-input"
                   placeholder="Enter address" 
                   value="${location.name}"
                   data-location-id="${location.id}"
                   data-selected="${location.name ? 'true' : 'false'}">
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
    
    console.log('Calculate button status check:', {
        vansCount: vans.length,
        locationsCount: locations.length,
        depotSelected: depotSelected,
        allLocationsSelected: allLocationsSelected,
        locationStatuses: Array.from(locationInputs).map(input => ({
            value: input.value,
            selected: input.dataset.selected
        }))
    });
    
    button.disabled = vans.length === 0 || 
                     locations.length === 0 || 
                     !depotSelected ||
                     !allLocationsSelected;
                     
    console.log('Button disabled:', button.disabled);
}

async function calculateRoutes() {
    document.querySelector('.loading-overlay').style.display = 'flex';
    
    try {
        console.log('\n=== Starting Route Calculation ===');
        console.log('Initial state:', 
            '\nDepot:', depot,
            '\nVans:', vans,
            '\nLocations:', locations);

        // Validate inputs
        const unselectedLocations = document.querySelectorAll('.location-input[data-selected="false"]');
        if (unselectedLocations.length > 0) {
            console.log('Validation failed: Unselected locations found');
            alert('Error: Some addresses are not properly selected from the dropdown. Please select a complete address for each location.');
            return;
        }

        // Find maximum van capacity
        const maxVanCapacity = Math.max(...vans.map(van => van.seatCount));
        console.log('Maximum van capacity:', maxVanCapacity);

        // Split locations that exceed max capacity
        const processedLocations = locations.flatMap(loc => {
            if (loc.passengerCount <= maxVanCapacity) {
                return [loc];
            }
            
            // Calculate splits needed
            const numSplits = Math.ceil(loc.passengerCount / maxVanCapacity);
            let remainingPassengers = loc.passengerCount;
            const splits = [];
            
            for (let i = 0; i < numSplits; i++) {
                const passengersThisSplit = Math.min(maxVanCapacity, remainingPassengers);
                splits.push({
                    ...loc,
                    id: `${loc.id}-split${i + 1}`,
                    passengerCount: passengersThisSplit,
                    originalLocation: loc,
                    splitInfo: `Split ${i + 1} of ${numSplits}`
                });
                remainingPassengers -= passengersThisSplit;
            }
            
            return splits;
        });

        console.log('Processed locations after splitting:', processedLocations);

        // Calculate savings between each pair of locations
        const savingsList = [];
        for (let i = 0; i < processedLocations.length; i++) {
            for (let j = i + 1; j < processedLocations.length; j++) {
                const loc1 = processedLocations[i];
                const loc2 = processedLocations[j];
                
                // Skip if these are split parts of the same original location
                if (loc1.originalLocation && 
                    loc2.originalLocation && 
                    loc1.originalLocation.id === loc2.originalLocation.id) {
                    console.log(`Skipping savings calculation between split locations: ${loc1.id} and ${loc2.id}`);
                    continue;
                }
                
                const savings = await calculateSavings(loc1, loc2);
                
                if (savings !== null) {
                    savingsList.push({
                        location1: loc1,
                        location2: loc2,
                        savings: savings
                    });
                }
            }
        }

        // Sort savings by highest first
        savingsList.sort((a, b) => b.savings - a.savings);

        console.log('Calculated savings:', savingsList);

        // Sort vans by capacity descending
        const sortedVans = [...vans].sort((a, b) => b.seatCount - a.seatCount);
        let currentVanIndex = 0;
        let currentMaxCapacity = sortedVans[currentVanIndex].seatCount;

        // Initialize routes - one location per route
        let routes = processedLocations.map(location => ({
            locations: [location],
            totalPassengers: location.passengerCount
        }));

        console.log('Initial routes:', routes);

        // Process savings list
        console.log('\nProcessing savings list...');
        console.log(`Target number of routes: ${vans.length}`);

        for (const saving of savingsList) {
            // Check if we've hit our target number of routes
            if (routes.length <= vans.length) {
                console.log(`\n→ Stopping early: We have ${routes.length} routes for ${vans.length} vans - no need to merge further`);
                break;
            }

            const { location1, location2, savings } = saving;
            console.log(`\nConsidering merge between:
    Location 1: ${location1.name} ${location1.splitInfo || ''} (${location1.passengerCount} passengers)
    Location 2: ${location2.name} ${location2.splitInfo || ''} (${location2.passengerCount} passengers)
    Savings: ${savings} minutes`);

            // Find routes containing these locations
            const route1 = routes.find(r => r.locations.includes(location1));
            const route2 = routes.find(r => r.locations.includes(location2));

            console.log('\nFound routes:');
            console.log('Route 1:', route1.locations.map(l => `${l.name}${l.splitInfo ? ` (${l.splitInfo})` : ''}`).join(' → '), 
                `(${route1.totalPassengers} passengers)`);
            console.log('Route 2:', route2.locations.map(l => `${l.name}${l.splitInfo ? ` (${l.splitInfo})` : ''}`).join(' → '), 
                `(${route2.totalPassengers} passengers)`);

            // Skip if locations are already in the same route
            if (route1 === route2) {
                console.log('→ Skipping: Locations already in same route');
                continue;
            }
            
            // Check if locations are interior nodes
            const isLoc1Interior = route1.locations.indexOf(location1) !== 0 && 
                                 route1.locations.indexOf(location1) !== route1.locations.length - 1;
            const isLoc2Interior = route2.locations.indexOf(location2) !== 0 && 
                                 route2.locations.indexOf(location2) !== route2.locations.length - 1;
            
            if (isLoc1Interior || isLoc2Interior) {
                console.log('→ Skipping: One or both locations are interior nodes');
                if (isLoc1Interior) console.log(`   ${location1.name} is interior`);
                if (isLoc2Interior) console.log(`   ${location2.name} is interior`);
                continue;
            }
            
            // Check combined passenger count
            const totalPassengers = route1.totalPassengers + route2.totalPassengers;
            if (totalPassengers > currentMaxCapacity) {
                console.log(`→ Skipping: Combined passengers (${totalPassengers}) exceeds current capacity (${currentMaxCapacity})`);
                continue;
            }
            
            // Log current routes before merge
            console.log('\nBefore merge:');
            console.log('Route 1:', route1.locations.map(l => l.name).join(' → '));
            console.log('Route 2:', route2.locations.map(l => l.name).join(' → '));
            
            // Merge the routes
            let mergedLocations;
            const loc1Index = route1.locations.indexOf(location1);
            const loc2Index = route2.locations.indexOf(location2);
            
            // Order locations based on where connecting nodes are
            if (loc1Index === 0) {
                mergedLocations = [...route1.locations.reverse(), ...route2.locations];
            } else if (loc1Index === route1.locations.length - 1) {
                mergedLocations = [...route1.locations, ...route2.locations];
            } else if (loc2Index === 0) {
                mergedLocations = [...route2.locations, ...route1.locations];
            } else {
                mergedLocations = [...route1.locations, ...route2.locations.reverse()];
            }
            
            const mergedRoute = {
                locations: mergedLocations,
                totalPassengers: totalPassengers
            };
            
            // Remove old routes and add merged route
            routes = routes.filter(r => r !== route1 && r !== route2);
            routes.push(mergedRoute);
            
            console.log('\nAfter merge:');
            console.log('New route:', mergedRoute.locations.map(l => l.name).join(' → '));
            console.log('\nCurrent routes:');
            routes.forEach((route, i) => {
                console.log(`Route ${i + 1}: ${route.locations.map(l => l.name).join(' → ')} (${route.totalPassengers} passengers)`);
            });

            // After successful merge, if we hit capacity exactly, move to next van size
            if (totalPassengers === currentMaxCapacity) {
                if (currentVanIndex < sortedVans.length - 1) {
                    currentVanIndex++;
                    currentMaxCapacity = sortedVans[currentVanIndex].seatCount;
                    console.log(`→ Reached exact capacity (${totalPassengers}), reducing max capacity to: ${currentMaxCapacity}`);
                }
            }
        }

        // Create dedicated routes for remaining single-location routes
        const finalRoutes = [];
        const vanRouteCount = {}; // Track number of routes per van

        // Initialize route count for all vans
        sortedVans.forEach(van => {
            vanRouteCount[van.vanNumber] = 0;
        });

        for (const route of routes) {
            // Find all vans that can handle this route's capacity
            const suitableVans = sortedVans.filter(van => van.seatCount >= route.totalPassengers);
            
            if (suitableVans.length > 0) {
                // Sort by number of routes assigned (ascending)
                suitableVans.sort((a, b) => vanRouteCount[a.vanNumber] - vanRouteCount[b.vanNumber]);
                const suitableVan = suitableVans[0]; // Pick van with fewest routes
                
                const routeTime = await getRouteTime(route.locations);
                finalRoutes.push({
                    locations: route.locations,
                    totalPassengers: route.totalPassengers,
                    vanNumber: suitableVan.vanNumber,
                    seatCount: suitableVan.seatCount,
                    estimatedMinutes: routeTime,
                    isSecondTrip: vanRouteCount[suitableVan.vanNumber] > 0
                });
                
                vanRouteCount[suitableVan.vanNumber]++;
                console.log(`Assigned ${vanRouteCount[suitableVan.vanNumber] > 1 ? 'additional' : 'first'} trip to van ${suitableVan.vanNumber}. Current route counts:`, vanRouteCount);
            } else {
                console.error('Could not find any suitable van for route:', route);
            }
        }

        console.log('Final routes:', finalRoutes);
        displayRoutes(finalRoutes);
    } catch (error) {
        console.error('Error calculating routes:', error);
        alert('An error occurred while calculating routes. Please try again.');
    } finally {
        document.querySelector('.loading-overlay').style.display = 'none';
    }
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
        
        // Clear results section if it exists
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.innerHTML = '';
        }
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
                                `<li>${loc.name} ${loc.splitInfo || ''} (${loc.passengerCount} passengers)</li>`
                            ).join('')}
                        </ol>
                    </div>
                `).join('')}
            </div>
        `).join('')}
    `;
}
