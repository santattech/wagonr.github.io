// Initialize the map and set its view to the specified coordinates
const map = L.map('map').setView([22.6086179, 88.44061], 13);

// create a database
const db = new PouchDB('myTrackerData');

// Add the OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Array to store the location points
let locationPoints = [];

// Function to add a new point to the map and draw the route
function addLocation(lat, lng) {
    console.log('adding locations...' + Date.now())
    // locationPoints = [];
    // Prepare the data in the Pouch DB
    addLocationToPouch(lat, lng);

    // Get all the locations from DB
    getLocationsFromPouch();
    console.log(locationPoints)
    // Add the new point to the array
    locationPoints.push([lat, lng]);
    console.log('Size of the locationPoints: ' + locationPoints.length)
    if(locationPoints.length == 0) {
      return ;
    }
    // Keep only the latest 200 points
    // if (locationPoints.length > 200) {
    //     locationPoints.shift();
    // }

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

function addLocationToPouch(lat, lng) {
  // Prepare the DB
  const timestamp = new Date().toISOString();
  // prepare the document for pouch
  const document = {
    "_id": Date.now().toString(),
    latitude: lat,
    longitude: lng,
    timestamp: timestamp
  };

  // Insert the document
  db.put(document)
  .then(response => {
    console.log('Document inserted successfully:', response);
  })
  .catch(error => {
    console.error('Error inserting document:', error);
  });
}

function getLocationsFromPouch() {
  // first delete the old records

  db.allDocs()
  .then(result => {
    const documents = result.rows;
    console.log('All documents:', documents);
    locationPoints = []
    // Iterate through the documents and extract location data
    locationsArr = documents.map(doc => {
      locationObj = getLocationById(doc.id);
    });

    return locationsArr;
  })
  .catch(error => {
    console.error('Error retrieving documents:', error);
  });
}

function getLocationById(identifier) {
  db.get(identifier.toString()).then(function (doc) {
    timeDiff = (Date.parse(doc.timestamp) - Date.now())/ 60000

    // older than 30 mins
    if(timeDiff > 30 * 60 * 1000) {
      console.log('deleting....')
      db.remove(doc);
    } else {
      locationPoints.push([doc.latitude, doc.longitude]);
    }
  });
}

// Function to simulate location tracking every 2 minutes
function trackLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        randomLat = Math.round((Math.random()*360 - 180) * 1000)/1000
        addLocation(lat, lng);
    }, error => {
        console.error(error);
    });
}

// Track location every 2 minutes (120000 ms)
setInterval(trackLocation, 30000);

// Add the initial location point
addLocation(22.608517, 88.440602);
