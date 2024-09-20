import {  getRandomInRange } from "./common.js";
import { map, customIcon, getDistanceforLastXMins, determineColorBasedOnSpeed } from "./map.js";

// create a database
const db = new PouchDB('myTrackerData');

// Add the OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Add the wakeF function to keep the screen on from mobile
let wakeLock = null;
const wakeF = async () => {
  if ('wakeLock' in navigator) {
    console.log("waked")
  } else {
    return
  }

  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('Wake Lock is active!');
  } catch (err) {
    // The Wake Lock request has failed - usually system related, such as battery.
    console.log(`${err.name}, ${err.message}`);
  }
}

wakeF();

// Array to store the location points which needed for rendering in the map
let prev_lat = '';
let prev_lng = '';
let deleteThreashold = 60;
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

const toggleDisplayLink = document.querySelector(".toggle-display");
toggleDisplayLink.addEventListener("click", toggleDisplayFunc);

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
  getDistanceforLastXMins(60, locationPointDataSet);
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
  // L.polyline(locationPoints, {color: 'blue'}).addTo(map);

  // Assuming locationPointDataSet contains objects with loc, createdAt, and colorCode
  for (let i = 0; i < locationPointDataSet.length - 1; i++) {
    // console.log(locationPointDataSet[i].colorCode);
    // Get the current and next points
    let point1 = locationPointDataSet[i].loc;
    let point2 = locationPointDataSet[i + 1].loc;

    // Create a polyline between the two points with the respective colorCode
    L.polyline([point1, point2], { color: locationPointDataSet[i].colorCode || 'blue' }).addTo(map);
  }

  // Adjust the map view to fit the polyline
  // map.fitBounds(L.polyline(locationPoints).getBounds());
}

// Function to add a new point to the map and draw the route
function addLocation(lat, lng) {
  // Prepare the data in the Pouch DB
  addLocationToPouch(lat, lng);

  // Add the new point to the array
  // locationPointDataSet.push({ loc: [lat, lng], createdAt: document['timestamp'], colorCode: document['colorCode'] });
  
  if(locationPointDataSet.length == 0) {
    return ;
  }

  // Draw the routes in map from the location points    
  drawRoute();
}

function addLocationToPouch(lat, lng) {
  // Prepare the DB
  const timestamp = new Date().toISOString();
  // here the timeDiff is 5 secs
  let colorCode = determineColorBasedOnSpeed(prev_lat, prev_lng, lat, lng, 5);

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
    prev_lat = lat
    prev_lng = lng
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
    if(timeDiff > deleteThreashold * 60 * 1000) {
      console.log('deleting a location 30 mins older....')
      db.remove(doc);
    } else {
      // console.log(doc.colorCode)
      locationPointDataSet.push({ loc: [doc.latitude, doc.longitude], createdAt: doc.timestamp, colorCode: doc.colorCode   });
    }
  });
}

// Function to simulate location tracking every 2 minutes
function trackLocation() {
    navigator.geolocation.getCurrentPosition(position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        // const lat = getRandomInRange(21, 22, 3);
        // const lng = getRandomInRange(86, 89, 3);
        // randomLat = Math.round((Math.random()*360 - 180) * 1000)/1000;
        refreshLocationInformation(lat, lng);
    }, error => {
        console.error(error);
    });
}


function adjustLocation() {
  let location = locationPointDataSet[locationPointDataSet.length - 1].loc;
  map.flyTo(location, 17)
}

function toggleDisplayFunc() {
  let display = '';
  const elements = document.querySelectorAll("p.distance-info");
  const infoPanel = document.querySelector('.info-panel');

  elements.forEach(function(elem) {
    if(elem.style.display == 'none') {
      elem.style.display = 'block';
    } else {
      elem.style.display = 'none';
      display = 'hide'
    }
  });

  if(display == 'hide') {
    infoPanel.classList.add('large-display');
  } else {
    infoPanel.classList.remove('large-display');
  }
  
}

// Track location every 10 secs (10000 ms), right now 10 secs
setInterval(trackLocation, 5000);

// Delete location every 2 minutes, for this we can load the DB function again 
// which will eventually check this for old records
setInterval(() => {
  // Refresh the global array by getting all the locations from DB
  getLocationsFromPouch();
}, 120000);
