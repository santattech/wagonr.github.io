// Initialize the map and set its view to the specified coordinates
const map = L.map('map').setView([22.6086179, 88.44061], 13);


// Add the OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Array to store the location points
let locationPoints = [];

// Function to add a new point to the map and draw the route
function addLocation(lat, lng) {
    console.log('adding locations...')
    // Add the new point to the array
    locationPoints.push([lat, lng]);

    // Keep only the latest 200 points
    if (locationPoints.length > 200) {
        locationPoints.shift();
    }

    // Remove existing layers before adding the new polyline
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Add markers for each location point
    locationPoints.forEach(point => {
        L.marker(point).addTo(map);
    });

    // Draw the polyline connecting the points
    L.polyline(locationPoints, {color: 'blue'}).addTo(map);

    // Adjust the map view to fit the polyline
    map.fitBounds(L.polyline(locationPoints).getBounds());
}

// Function to simulate location tracking every 2 minutes
function trackLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        addLocation(lat, lng);
    }, error => {
        console.error(error);
    });
}

// Track location every 2 minutes (120000 ms)
setInterval(trackLocation, 10000);

// Add the initial location point
addLocation(22.608517, 88.440602);
