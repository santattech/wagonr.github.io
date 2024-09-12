import {  } from "./common.js";
import { map, customIcon, getDistanceforLastXMins, determineColorBasedOnSpeed } from "./map.js";

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

const locationCenterBtn = document.querySelector(".location-center");
locationCenterBtn.addEventListener("click", adjustLocation);

function refreshLocationInformation(lat, lng) {
  console.log('Starting adding the location...');
  addLocation(lat, lng);
  console.log('Finishing adding the location...');

  // console.log('Starting calculation of locations for last 5 mins...');
  getDistanceforLastXMins(5, locationPointDataSet);
  // console.log('Finsihing calculation of locations for last 5 mins...');

  // console.log('Starting calculation of locations for last 15 mins...');
  getDistanceforLastXMins(15, locationPointDataSet);
  // console.log('Finsihing calculation of locations for last 15 mins...');
  
  // console.log('Starting calculation of locations for last 30 mins...');
  getDistanceforLastXMins(30, locationPointDataSet);
  // console.log('Finsihing calculation of locations for last 30 mins...');
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
  locationPointDataSet.forEach(locationObj => {
    let point = locationObj['loc'];
    L.marker(point, { icon: customIcon }).addTo(map);
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
  console.log(document)
  // Add the new point to the array
  // locationPointDataSet.push({ loc: [lat, lng], createdAt: document['timestamp'], colorCode: document['colorCode'] });
  locationPoints.push([lat, lng]);
  if(locationPoints.length == 0) {
    return ;
  }

  // Draw the routes in map from the location points    
  drawRoute();
}

function addLocationToPouch(lat, lng) {
  // Prepare the DB
  const timestamp = new Date().toISOString();
  // here the timeDiff is 5 secs
  const colorCode = determineColorBasedOnSpeed(lat, lng, 5);
  // prepare the document for pouch
  const document = {
    "_id": Date.now().toString(),
    latitude: lat,
    longitude: lng,
    timestamp: timestamp,
    colorCode: colorCode
  };

  // Insert the document
  db.put(document)
  .then(response => {
    console.log('Document inserted successfully:', response);
    locationPointDataSet.push({ loc: [lat, lng], createdAt: document['timestamp'], colorCode: document['colorCode'] || 'blue' });
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
    let locationsArr = documents.map(doc => {
      return getLocationById(doc.id);
    });

    return locationsArr;
  })
  .catch(error => {
    console.error('Error retrieving documents:', error);
  });
}

function getLocationById(identifier) {
  db.get(identifier.toString()).then(function (doc) {
    let timeDiff = (Date.now() - Date.parse(doc.timestamp))

    // older than 30 mins
    if(timeDiff > 60 * 60 * 1000) {
      console.log('deleting a location 30 mins older....')
      db.remove(doc);
    } else {
      locationPointDataSet.push({ loc: [doc.latitude, doc.longitude], createdAt: doc.timestamp });
      locationPoints.push([doc.latitude, doc.longitude]);
    }
  });
}

// Function to simulate location tracking every 2 minutes
function trackLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        // const lat = getRandomInRange(21, 5, 3);
        // const lng = getRandomInRange(86, 69, 3);
        // randomLat = Math.round((Math.random()*360 - 180) * 1000)/1000;
        refreshLocationInformation(lat, lng);
    }, error => {
        console.error(error);
    });
}


function adjustLocation() {
  // Adjust the map view to fit the polyline
  // map.fitBounds(L.polyline(locationPoints).getBounds());
  let location = locationPoints[locationPoints.length - 1];
  map.flyTo(location, 17)
 }

// Track location every 10 secs (10000 ms), right now 10 secs
setInterval(trackLocation, 5000);

// Delete location every 2 minutes, for this we can load the DB function again 
// which will eventually check this for old records
setInterval(() => {
  // Refresh the global array by getting all the locations from DB
  getLocationsFromPouch();
}, 120000);
