import { haversineDistance } from "./common.js";

// Initialize the map and set its view to the specified coordinates
export const map = L.map('map').setView([22.6086179, 88.44061], 13);

// custom marker for location
export var customIcon = L.icon({
  iconUrl: 'assets/my-marker-icon.png',
  iconSize: [10, 10], // Adjust the size as needed
  iconAnchor: [5, 5],
  popupAnchor: [1, -20]
});

export function getDistanceforLastXMins(mins, locationPointDataSet) {
  if(locationPointDataSet.length > 0) {
    let totalDistance = 0;
    let filteredLocations = locationPointDataSet.filter(function(l) {
      // different in seconds
      let diff = (Date.now() - Date.parse(l.createdAt))/ 1000;
      return diff < (mins * 60) 
    });

    for (let i = 0; i < filteredLocations.length - 1; i++) {
      const [lat1, lon1] = filteredLocations[i].loc;
      const [lat2, lon2] = filteredLocations[i + 1].loc;

      const distance = haversineDistance(lat1, lon1, lat2, lon2);
      totalDistance += distance;
    }

    // totalDistance is in meter. so converting to KM
    totalDistance = Math.round(totalDistance * 100) / (100 * 1000)
    // Here RPS means recent points
    totalDistance = totalDistance.toLocaleString('en-US', { maximumFractionDigits: 3 }) + ' km <span class="extra">('+ filteredLocations.length +' rps)</span>'
    
    if(mins == 5) {
      document.getElementById('five-mins').innerHTML = totalDistance;
    }

    if(mins == 15) {
      document.getElementById('fifteen-mins').innerHTML = totalDistance;
    }

    if(mins == 60) {
      document.getElementById('sixty-mins').innerHTML = totalDistance;
    }
  }
}

export function getCurrentSpeed(locationPointDataSet) {
  let mins = 1/4; //calculate with 15 sec

  if(locationPointDataSet.length > 0) {
    let totalDistance = 0;
    let filteredLocations = locationPointDataSet.filter(function(l) {
      // different in seconds
      let diff = (Date.now() - Date.parse(l.createdAt))/ 1000;
      return diff < (mins * 60) 
    });

    for (let i = 0; i < filteredLocations.length - 1; i++) {
      const [lat1, lon1] = filteredLocations[i].loc;
      const [lat2, lon2] = filteredLocations[i + 1].loc;

      const distance = haversineDistance(lat1, lon1, lat2, lon2);
      totalDistance += distance;
    }

    // totalDistance is in meter. so converting to KM
    totalDistance = Math.round(totalDistance * 100) / (100 * 1000)
    // calculate speed
    var currentSpeed;

    currentSpeed = (totalDistance * 60 * 4);
    currentSpeed = currentSpeed.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' km';
  
    document.getElementById('current-speed').innerHTML = currentSpeed;
  }
}

export function determineColorBasedOnSpeed(lat, lng, lat2, lng2, timeRangeInSec) {
  var color = '';
  if(typeof lat == "undefined") {
    lat = lat2;
  }

  if(typeof lng == "undefined") {
    lng = lng2;
  } 
  // distance in meter
  let distance = haversineDistance(lat, lng, lat2, lng2);
  // console.log(distance);
  let speed = ((distance/ timeRangeInSec) * 3600)/ 1000;
  console.log(speed)
  
  if(speed < 2.5) {
    color = '#FF0000'
  } else if(speed < 20.0) {
    color = '#7CFC00'
  } else if(speed < 40.0) {
    color = '#228B22'
  } else if(speed < 65.0) {
    color = '#0000FF'
  } else {
    color = '#800000'
  }

  return color;
}