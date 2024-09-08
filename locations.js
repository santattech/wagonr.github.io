// import { haversineDistance } from "./common.js";

// Initialize the map and set its view to the specified coordinates
const map = L.map('map').setView([22.6086179, 88.44061], 13);

// custom marker for location
var customIcon = L.icon({
  iconUrl: 'assets/my-marker-icon.png',
  iconSize: [20, 20], // Adjust the size as needed
  iconAnchor: [5, 5],
  popupAnchor: [1, -20]
});

// create a database
const db = new PouchDB('myTrackerData');

// Add the OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Array to store the location points which needed for rendering in the map
let locationPoints = [];
// Array to store the data set of locations with timestamp
let locationPointDataSet = [];

// Load this function when page is loaded or refreshed fully
document.addEventListener('DOMContentLoaded', function() {
  // here we will fetch the records from the DB
  // Get all the locations from DB
  getLocationsFromPouch();
}, false);

function refreshLocationInformation(lat, lng) {
  console.log('Starting adding the location...');
  addLocation(lat, lng);
  console.log('Finishing adding the location...');

  console.log('Starting calculation of locations for last 5 mins...');
  getDistanceforLastXMins(5);
  console.log('Finsihing calculation of locations for last 5 mins...');

  console.log('Starting calculation of locations for last 15 mins...');
  getDistanceforLastXMins(15);
  console.log('Finsihing calculation of locations for last 15 mins...');
  
  console.log('Starting calculation of locations for last 30 mins...');
  getDistanceforLastXMins(30);
  console.log('Finsihing calculation of locations for last 30 mins...');
}

function drawRoute() {
  // map is global declared above top.
  // Remove existing layers before adding the new polyline
  map.eachLayer((layer) => {
    if (layer instanceof L.Polyline || layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Add markers for each location point
  locationPoints.forEach(point => {
    L.marker(point, {icon: customIcon}).addTo(map);
  });

  // Draw the polyline connecting the points
  L.polyline(locationPoints, {color: 'blue'}).addTo(map);

  // Adjust the map view to fit the polyline
  // map.fitBounds(L.polyline(locationPoints).getBounds());
}

// Function to add a new point to the map and draw the route
function addLocation(lat, lng) {
  // locationPoints = [];
  // Prepare the data in the Pouch DB
  addLocationToPouch(lat, lng);

  // Add the new point to the array
  locationPointDataSet.push({ loc: [lat, lng], createdAt: Date.now() });
  locationPoints.push([lat, lng]);
  console.log('Size of the locationPoints: ' + locationPoints.length)
  if(locationPoints.length == 0) {
    return ;
  }

  // Draw the routes in map from the location points    
  drawRoute();
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
  console.log('Calling database to load all docs of locations')
  db.allDocs()
  .then(result => {
    const documents = result.rows;
    locationPoints = []
    locationPointDataSet = []
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
    timeDiff = (Date.now() - Date.parse(doc.timestamp))

    // older than 30 mins
    if(timeDiff > 30 * 60 * 1000) {
      console.log('deleting a location 30 mins older....')
      db.remove(doc);
    } else {
      locationPointDataSet.push({ loc: [doc.latitude, doc.longitude], createdAt: doc.timestamp });
      locationPoints.push([doc.latitude, doc.longitude]);
    }
  });
}

function getDistanceforLastXMins(mins) {
  if(locationPointDataSet.length > 0) {
    let totalDistance = 0;
    filteredLocations = locationPointDataSet.filter(function(l) {return ((Date.now() - Date.parse(l.createdAt)) < (mins * 60 * 1000)) } );

    for (let i = 0; i < filteredLocations.length - 1; i++) {
      const [lat1, lon1] = filteredLocations[i].loc;
      const [lat2, lon2] = filteredLocations[i + 1].loc;

      const distance = haversineDistance(lat1, lon1, lat2, lon2);
      totalDistance += distance;
    }

    // totalDistance is in meter. so converting to KM
    totalDistance = Math.round((totalDistance + Number.EPSILON) * 100) / (100 * 1000)
    totalDistance = totalDistance + ' km'
    
    // console.log('Distance calculated for ' + mins + 'minutes: '+ totalDistance + 'meter');

    if(mins == 5) {
      document.getElementById('five-mins').innerHTML = totalDistance;
    }

    if(mins == 15) {
      document.getElementById('fifteen-mins').innerHTML = totalDistance;
    }

    if(mins == 30) {
      document.getElementById('thirty-mins').innerHTML = totalDistance;
    }
  }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  // Convert latitude and longitude from degrees to radians
  lat1 = (Math.PI * lat1) / 180;
  lon1 = (Math.PI * lon1) / 180;
  lat2 = (Math.PI * lat2) / 180;
  lon2 = (Math.PI * lon2) / 180;

  // Calculate the differences between the latitudes and longitudes
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  // Calculate the Haversine formula
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Calculate the distance in meters   
  // (using Earth's radius in meters)
  const distanceInMeters = 6371000 * c;

  return distanceInMeters;
}


function getRandomInRange(from, to, fixed) {
  return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
  // .toFixed() returns string, so ' * 1' is a trick to convert to number
}
// Function to simulate location tracking every 2 minutes
function trackLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        // const lat = getRandomInRange(-180, 180, 3);
        // const lng = getRandomInRange(-180, 180, 3);
        randomLat = Math.round((Math.random()*360 - 180) * 1000)/1000;
        refreshLocationInformation(lat, lng);
    }, error => {
        console.error(error);
    });
}


function adjustLocation() {
  // Adjust the map view to fit the polyline
  // map.fitBounds(L.polyline(locationPoints).getBounds());
  let location = locationPoints[locationPoints.length - 1];
  map.flyTo(location, 14)
 }

// Track location every 10 secs (10000 ms), right now 10 secs
setInterval(trackLocation, 10000);

// Delete location every 10 minutes, for this we can load the DB function again 
// which will eventually check this for old records
setInterval(() => {
  // Refresh the global array by getting all the locations from DB
  getLocationsFromPouch();
}, 600000);
