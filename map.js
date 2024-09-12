import { haversineDistance } from "./common.js";

// Initialize the map and set its view to the specified coordinates
export const map = L.map('map').setView([22.6086179, 88.44061], 13);

// custom marker for location
export var customIcon = L.icon({
  iconUrl: 'assets/my-marker-icon.png',
  iconSize: [20, 20], // Adjust the size as needed
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
    totalDistance = totalDistance + ' km <span class="extra">(Based on '+ filteredLocations.length +' route points)</span>'
    
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

export function determineColorBasedOnSpeed(lat, lng, timeRangeInSec) {
  var color = '';
  // distance in meter
  let distance = haversineDistance(lat, lng);
  let speed = ((distance/ timeRangeInSec) * 3600)/ 1000;

  if(speed < 2.5) {
    color = '#FF0000'
  } else if(speed < 5.0) {
    color = '#AAFF00'
  } else if(speed < 20.0) {
    color = '#7CFC00'
  } else if(speed < 40.0) {
    color = '#228B22'
  } else if(speed < 65.0) {
    color = '#0000FF'
  } else {
    color = '#FFA500'
  }

  return color;
}