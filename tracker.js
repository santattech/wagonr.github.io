const db = new PouchDB("destinationDB");
const dbTracking = new PouchDB("trackingDB");
const dbTrips = new PouchDB("tripsDB");
let start = null;
let destination = null;
let straightLine = null;
let routeLine = null;
let initialDistance = 513;
let getRouteCounter = 0;
let adjustmentFactor = 1.24;
let map = L.map("map").setView([0, 0], 13);
let startMarker, destMarker;

// Trip management variables
let currentTrip = null;
let tripPath = [];
let tripPolyline = null;
let watchId = null;
let gpsUpdateInterval = 5000; // Default 5 seconds
let autoSaveInterval = null;

function startLocationTracking() {
  watchId = navigator.geolocation.watchPosition(updateTripLocation, null, {
    enableHighAccuracy: true,
    maximumAge: gpsUpdateInterval,
    timeout: gpsUpdateInterval + 2000
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then(() => console.log("Service Worker registered"))
    .catch((err) => console.error("Service Worker failed", err));
}

// Leaflet Tile
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Trip Controls
document.getElementById("start-trip").addEventListener("click", startTrip);
document.getElementById("end-trip").addEventListener("click", endTrip);

function startTrip() {
  if (currentTrip) return;
  
  const tripId = Date.now().toString();
  currentTrip = {
    _id: tripId,
    id: tripId,
    startTime: new Date(),
    startLocation: start,
    path: [],
    totalDistance: 0
  };
  
  tripPath = [];
  document.getElementById("start-trip").disabled = true;
  document.getElementById("end-trip").disabled = false;
  document.getElementById("trip-status").innerHTML = "🟢 Trip Active";
  
  // Start tracking with configurable interval
  startLocationTracking();
  
  // Start auto-save every 2 minutes
  autoSaveInterval = setInterval(autoSaveTripData, 120000);
}

function endTrip() {
  if (!currentTrip) return;
  
  navigator.geolocation.clearWatch(watchId);
  
  // Clear auto-save interval
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
  
  currentTrip.endTime = new Date();
  currentTrip.endLocation = start;
  currentTrip.duration = (currentTrip.endTime - currentTrip.startTime) / 1000 / 60; // minutes
  currentTrip.avgSpeed = currentTrip.totalDistance / (currentTrip.duration / 60); // km/h
  
  // Store trip ID before clearing currentTrip
  const tripId = currentTrip.id;
  
  // Save final trip to database
  dbTrips.put(currentTrip).then(() => {
    // Clean up backup data after successful save
    cleanupTripBackup(tripId);
  });
  
  // Show trip summary
  showTripSummary(currentTrip);
  
  // Reset trip state
  currentTrip = null;
  tripPath = [];
  if (tripPolyline) {
    map.removeLayer(tripPolyline);
    tripPolyline = null;
  }
  
  document.getElementById("start-trip").disabled = false;
  document.getElementById("end-trip").disabled = true;
  document.getElementById("trip-status").innerHTML = "";
}

function updateTripLocation(pos) {
  const { latitude, longitude, speed, accuracy } = pos.coords;
  console.log(pos.coords);
  const newPos = { lat: latitude, lon: longitude };
  
  // Update accuracy indicator
  updateAccuracyIndicator(accuracy);
  
  // Update current position
  start = newPos;
  map.setView([latitude, longitude], map.getZoom());
  
  if (startMarker) {
    startMarker.setLatLng([latitude, longitude]);
  }
  
  // Update speed display
  const speedKmh = speed ? (speed * 3.6).toFixed(1) : 0;
  document.getElementById("current-speed").textContent = `${speedKmh} kmph`;
  
  // Add to trip path
  if (currentTrip && tripPath.length > 0) {
    const lastPos = tripPath[tripPath.length - 1];
    const distance = calculateDistance(lastPos.lat, lastPos.lon, latitude, longitude);
    currentTrip.totalDistance += distance;
  }
  
  tripPath.push(newPos);
  currentTrip.path = tripPath;
  
  // Update trip polyline
  if (tripPath.length > 1) {
    if (tripPolyline) {
      map.removeLayer(tripPolyline);
    }
    tripPolyline = L.polyline(tripPath.map(p => [p.lat, p.lon]), {color: 'blue', weight: 4}).addTo(map);
  }
}

function updateAccuracyIndicator(accuracy) {
  const accuracyValue = document.getElementById("accuracy-value");
  const accuracyText = document.getElementById("accuracy-text");
  const bars = document.querySelectorAll(".bar");
  
  // Check if elements exist
  if (!accuracyValue || !accuracyText || bars.length === 0) return;
  
  accuracyValue.textContent = `${accuracy.toFixed(1)} meters`;
  // Reset all bars
  bars.forEach(bar => bar.classList.remove("active"));
  
  // Update signal strength based on accuracy
  let signalStrength = 0;
  let signalText = "";
  
  if (accuracy <= 5) {
    signalStrength = 4;
    signalText = "Excellent";
  } else if (accuracy <= 10) {
    signalStrength = 3;
    signalText = "Good";
  } else if (accuracy <= 20) {
    signalStrength = 2;
    signalText = "Fair";
  } else if (accuracy <= 50) {
    signalStrength = 1;
    signalText = "Poor";
  } else {
    signalStrength = 0;
    signalText = "Very Poor";
  }
  
  // Activate bars based on signal strength
  for (let i = 0; i < signalStrength; i++) {
    bars[i].classList.add("active");
  }
  
  accuracyText.textContent = signalText;
}

function autoSaveTripData() {
  if (!currentTrip) return;
  
  // Create a backup copy of current trip data
  const backupId = currentTrip.id + '_backup';
  const tripBackup = {
    ...currentTrip,
    _id: backupId,
    id: backupId,
    path: [...tripPath],
    lastSaved: new Date(),
    isBackup: true
  };
  
  // Save backup to database
  dbTrips.put(tripBackup).then(() => {
    const statusEl = document.getElementById("auto-save-status");
    if (statusEl) {
      statusEl.innerHTML = "💾 Auto-saved at " + new Date().toLocaleTimeString();
      setTimeout(() => {
        if (statusEl) statusEl.innerHTML = "";
      }, 3000);
    }
  }).catch(err => {
    console.error('Auto-save failed:', err);
  });
}

// Clean up backup data when trip ends successfully
function cleanupTripBackup(tripId) {
  const backupId = tripId + '_backup';
  dbTrips.get(backupId).then(doc => {
    return dbTrips.remove(doc);
  }).catch(err => {
    // Backup doesn't exist, which is fine
  });
}

function showTripSummary(trip) {
  const summary = `
    Trip Summary:
    Duration: ${trip.duration.toFixed(1)} minutes
    Distance: ${trip.totalDistance.toFixed(2)} km
    Average Speed: ${trip.avgSpeed.toFixed(1)} km/h
  `;
  alert(summary);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Get current location
navigator.geolocation.getCurrentPosition((pos) => {
  const { latitude, longitude, accuracy } = pos.coords;
  start = { lat: latitude, lon: longitude };
  map.setView([latitude, longitude], 15);
  startMarker = L.marker([latitude, longitude], { title: "Start" }).addTo(map);
  updateAccuracyIndicator(accuracy);
  checkSavedDestination(); // load destination if saved
});

// Add a click event listener to the map
map.on("click", function (e) {
  const { lat, lng } = e.latlng; // Get latitude and longitude from the event
  const latLngText = `Latitude: ${lat.toFixed(6)}, Longitude: ${lng.toFixed(6)}`;

  // Show the latitude and longitude in an alert
  alert(latLngText);

  // Copy the latitude and longitude to the clipboard
  navigator.clipboard
    .writeText(lat.toFixed(6))
    .then(() => {
      console.log("Latitide copied to clipboard:", lat.toFixed(6));
    })
    .catch((err) => {
      console.error("Failed to copy coordinates to clipboard:", err);
    });
});

// Collapsible toggle
document.querySelectorAll(".collapsible").forEach((btn) => {
  btn.addEventListener("click", function () {
    this.classList.toggle("active");
    const content = this.nextElementSibling;
    content.style.display =
      content.style.display === "block" ? "none" : "block";
  });
});

// location select dropdown onchange functionality
const locationSelect = document.getElementById("locationSelect");
const latInput = document.getElementById("lat");
const lonInput = document.getElementById("lon");

locationSelect.addEventListener("change", function () {
  const value = this.value;
  if (value) {
    const [lat, lon] = value.split(",");
    latInput.value = lat;
    lonInput.value = lon;
    handleDestinationInput();
  } else {
    latInput.value = "";
    lonInput.value = "";
  }
});

// Input listener
document.querySelectorAll("#lat, #lon").forEach((input) => {
  input.addEventListener("input", handleDestinationInput);
});

function handleDestinationInput() {
  const lat = parseFloat(document.getElementById("lat").value);
  const lon = parseFloat(document.getElementById("lon").value);

  if (!isNaN(lat) && !isNaN(lon)) {
    destination = { lat, lon };

    if (destMarker) map.removeLayer(destMarker);

    destMarker = L.marker([lat, lon], { title: "Destination" }).addTo(map);

    // Only set initialDistance once when setting destination and have current position
    if (start) {
      initialDistance = haversineDistance(start.lat, start.lon, lat, lon);

      // Save lat, lon, and initialDistance in PouchDB
      db.get("destination")
        .then((doc) => {
          // db.remove(doc); // remove old doc
          return db.put({
            ...doc,
            lat,
            lon,
            initialDistance,
          });
        })
        .catch((err) => {
          // If not found, create new
          if (err.name === "not_found") {
            db.put({
              _id: "destination",
              lat,
              lon,
              initialDistance,
            });
          }
        });
    }

    updateDistance(); // trigger initial update
  }
}

// Save destination on button click
function checkSavedDestination() {
  db.get("destination")
    .then((doc) => {
      document.getElementById("lat").value = doc.lat;
      document.getElementById("lon").value = doc.lon;
      destination = { lat: doc.lat, lon: doc.lon };
      initialDistance = doc.initialDistance;

      // Add marker
      destMarker = L.marker([doc.lat, doc.lon], { title: "Destination" }).addTo(
        map
      );

      updateDistance();
    })
    .catch(() => {});
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function updateDistance() {
  console.log("Updating distance...");
  if (!start || !destination) return;

  navigator.geolocation.getCurrentPosition((pos) => {
    start = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    if (startMarker) map.removeLayer(startMarker);

    startMarker = L.marker([start.lat, start.lon], { title: "Current" }).addTo(
      map
    );
    addLocationToPouch(start.lat, start.lon);

    const remaining = haversineDistance(
      start.lat,
      start.lon,
      destination.lat,
      destination.lon
    );

    // Add this after setting start and destination
    updateGreenLine(start, destination);

    // If we already have initialDistance in memory, just use it
    if (initialDistance) {
      updateProgressBar(remaining, initialDistance);
    } else {
      // Else fetch it from DB
      db.get("destination")
        .then((doc) => {
          // debugger
          if (doc.initialDistance) {
            initialDistance = doc.initialDistance;
            console.log("Initial distance:", initialDistance);
          } else {
            // Fallback: compute and store it
            initialDistance = remaining;
            db.put({ ...doc, initialDistance });
          }

          updateProgressBar(remaining, initialDistance);
        })
        .catch((err) => {
          console.error("Could not load initialDistance from DB", err);
        });
    }

    updateTrackingInformation();
    calculateETA();

    if (getRouteCounter % 20 == 0) {
      getRoute(start.lat, start.lon, destination.lat, destination.lon);
    }
    console.log("getRouteCounter", getRouteCounter);
    getRouteCounter++;
  });
}

function updateProgressBar(remaining, initial) {
  remaining = remaining * adjustmentFactor; // Adjust for route distance estimation
  const progress = Math.min(100, ((initial - remaining) / initial) * 100);
  document.getElementById("distance").innerText = `${(remaining / 1000).toFixed(
    2
  )} km remaining out of ${(initial / 1000).toFixed(2)} km`;

  const bar = document.getElementById("progress-bar");
  bar.style.width = `${progress.toFixed(1)}%`;
  bar.innerText = `${progress.toFixed(1)}%`;
}

function updateGreenLine(start, destination) {
  if (start && destination) {
    // Remove existing line if any
    if (straightLine) map.removeLayer(straightLine);

    // Draw a new green line
    straightLine = L.polyline(
      [
        [start.lat, start.lon],
        [destination.lat, destination.lon],
      ],
      {
        color: "green",
        weight: 4,
        // opacity: 0.7,
        // dashArray: '5,10' // optional: dashed line
      }
    ).addTo(map);
  }
}

function updateTrackingInformation() {
  const trackingInfo = document.getElementById("tracking-info");
  // getDistanceFromTrackingHistory(15);
  getDistanceFromTrackingHistory(60);
  getDistanceFromTrackingHistory(1430);
  const currentPosition = document.getElementById("current-position");
  currentPosition.innerText = `${start.lat}, ${start.lon}`;
}

// Update every 10s
setInterval(updateDistance, 5 * 1000);
// Run cleanup every hour
setInterval(deleteOldTrackingData, 2 * 60 * 1000);

function addLocationToPouch(lat, lng) {
  // Prepare the DB
  const timestamp = new Date().toISOString();

  // prepare the document for pouch
  const document = {
    _id: Date.now().toString() + "_tracking",
    latitude: lat,
    longitude: lng,
    timestamp: timestamp,
  };
  // Save to PouchDB
  dbTracking
    .put(document)
    .then(() => {
      console.log("Tracking location saved", document);
    })
    .catch((err) => {
      console.error("Failed to save tracking location", err);
    });
}

async function getDistanceFromTrackingHistory(xMins) {
  const now = Date.now();
  const cutoff = now - xMins * 60 * 1000; // milliseconds

  try {
    const result = await dbTracking.allDocs({ include_docs: true });

    const recentPoints = result.rows
      .map((row) => row.doc)
      .filter((doc) => {
        const time = new Date(doc.timestamp).getTime();
        return time >= cutoff;
      })
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (recentPoints.length < 2) return 0;

    let totalDistance = 0;

    for (let i = 0; i < recentPoints.length - 1; i++) {
      const { latitude: lat1, longitude: lon1 } = recentPoints[i];
      const { latitude: lat2, longitude: lon2 } = recentPoints[i + 1];

      totalDistance += haversineDistance(lat1, lon1, lat2, lon2);
    }

    // return distance in meters (or convert to km)
    const totalKm = totalDistance / 1000;
    const estimatedTotalKm = totalKm * adjustmentFactor;

    if (xMins == 15)
      document.getElementById(
        "fifteen-mins"
      ).innerHTML = `Aerial: ${totalKm.toFixed(
        3
      )} km | Estimated Route distance: ${estimatedTotalKm.toFixed(3)} km`;

    if (xMins == 60)
      document.getElementById(
        "sixty-mins"
      ).innerHTML = `Aerial: ${totalKm.toFixed(
        3
      )} km | Estimated Route distance: ${estimatedTotalKm.toFixed(3)} km`;
    if (xMins == 1430)
      document.getElementById(
        "fourteen-hundred-mins"
      ).innerHTML = `Aerial: ${totalKm.toFixed(
        3
      )} km | Estimated Route distance: ${estimatedTotalKm.toFixed(3)} km`;

    return totalKm.toFixed(3); // limit to 3 decimal places
  } catch (err) {
    console.error("Error reading from tracking history:", err);
    return 0;
  }
}

async function calculateETA() {
  const fifteenMinDistance = await getDistanceFromTrackingHistory(15); // in KM

  // Calculate average speed over last 15 minutes
  const speedKmPerMin = fifteenMinDistance / 15;
  const speedKmPerHr = speedKmPerMin * 60;

  // Retrieve initialDistance and destination from DB
  const doc = await db.get("destination");
  const { initialDistance } = doc;

  // Get current position
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        // const remainingDistance = haversineDistance(currentLat, currentLng, destination.lat, destination.lng) / 1000;
        const remainingDistance =
          haversineDistance(
            currentLat,
            currentLng,
            destination.lat,
            destination.lon
          ) / 1000;

        // ETA in minutes
        const etaMinutes = remainingDistance / speedKmPerMin;

        // Format nicely
        const etaFormatted = isFinite(etaMinutes)
          ? formatMinutesToHHMM(etaMinutes)
          : "Calculating...";

        // Update UI
        document.querySelector(".floating-speed-div .speed").innerText = `${speedKmPerHr.toFixed(
          1
        )} \n kmph`;
        document.querySelector(
          "#tracking-info p:last-child"
        ).innerText = `ETA: ${etaFormatted}`;

        resolve(etaFormatted);
      },
      (error) => {
        console.error("Location error in ETA:", error);
        document.querySelector(
          "#tracking-info p:last-child"
        ).innerText = `ETA: N/A`;
        reject();
      }
    );
  });
}

function formatMinutesToHHMM(mins) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + mins); // Add the calculated minutes to the current time

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const period = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12; // Convert to 12-hour format
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds} ${period}`;
}

async function deleteOldTrackingData() {
  // getSizeOfDB();
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  try {
    const result = await dbTracking.allDocs({ include_docs: true });

    const oldDocs = result.rows
      .map((row) => row.doc)
      .filter((doc) => {
        const time = new Date(doc.timestamp).getTime();
        return time < cutoff;
      });

    if (oldDocs.length > 0) {
      const deletions = oldDocs.map((doc) => ({
        _id: doc._id,
        _rev: doc._rev,
        _deleted: true,
      }));

      const response = await dbTracking.bulkDocs(deletions);
      console.log(`${response.length} old tracking records deleted.`);
    } else {
      console.log("No old tracking data found to delete.");
    }
  } catch (err) {
    console.error("Error deleting old tracking data:", err);
  }
}

document.getElementById("go-to-current").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      map.flyTo([lat, lng], 17);
    },
    (error) => {
      console.error("Error getting current location:", error);
      alert("Unable to retrieve your location.");
    }
  );
});

function getRoute(start_lat, start_lon, destination_lat, destination_lon) {
  return;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
  }).addTo(map);

  console.log("Getting route...");
  // get the start location from current location
  let routeUrl = `https://router.project-osrm.org/route/v1/driving/${start_lon},${start_lat};${destination_lon},${destination_lat}?overview=false&alternatives=true&steps=true&hints=Wnbeg1x23oMhAAAAUAAAAAAAAABtAAAAdlo5QZAO3EEAAAAAC40XQhAAAAAoAAAAAAAAADYAAAAQPgAA58xdBhF1oP_ozF0GC3Wg_wAAfxBDe8rE;ImAiif___38EAAAABgAAAAQAAAAFAAAA90GjQBOi6T9X_4xAibemQAQAAAAGAAAABAAAAAUAAAAQPgAAyBVdBonkof_MFV0GeeSh_wEA3wRDe8rE4YYpgGKMhIQEAAAAAgAAAAQAAAAFAAAA90GjQBOi6T9X_4xAibemQAQAAAACAAAABAAAAAUAAAAQPgAAyBVdBonkof_MFV0GeeSh_wEA3wRDe8rEAXIiif___38BAAAABgAAAAQAAAAFAAAA90GjQBOi6T9X_4xAibemQAEAAAAGAAAABAAAAAUAAAAQPgAAyBVdBonkof_MFV0GeeSh_wEAHxBDe8rE`;

  //"https://router.project-osrm.org/route/v1/driving/106.8105998,#{start_lat};106.7637239,-6.167430899999999?overview=false&alternatives=true&steps=true&hints=Wnbeg1x23oMhAAAAUAAAAAAAAABtAAAAdlo5QZAO3EEAAAAAC40XQhAAAAAoAAAAAAAAADYAAAAQPgAA58xdBhF1oP_ozF0GC3Wg_wAAfxBDe8rE;ImAiif___38EAAAABgAAAAQAAAAFAAAA90GjQBOi6T9X_4xAibemQAQAAAAGAAAABAAAAAUAAAAQPgAAyBVdBonkof_MFV0GeeSh_wEA3wRDe8rE4YYpgGKMhIQEAAAAAgAAAAQAAAAFAAAA90GjQBOi6T9X_4xAibemQAQAAAACAAAABAAAAAUAAAAQPgAAyBVdBonkof_MFV0GeeSh_wEA3wRDe8rEAXIiif___38BAAAABgAAAAQAAAAFAAAA90GjQBOi6T9X_4xAibemQAEAAAAGAAAABAAAAAUAAAAQPgAAyBVdBonkof_MFV0GeeSh_wEAHxBDe8rE"
  if (routeLine) map.removeLayer(routeLine);

  // get the destination location from input
  fetch(routeUrl)
    .then((res) => res.json())
    .then((data) => {
      const steps = data.routes[0].legs[0].steps;
      let routeCoords = [];
      steps.forEach((step) => {
        const coords = polyline.decode(step.geometry);
        coords.forEach((c) => routeCoords.push([c[0], c[1]])); // format for Leaflet
      });

      // if (routeLine) map.removeLayer(routeLine);

      routeLine = L.polyline(routeCoords, { color: "blue" }).addTo(map);
      map.fitBounds(routeCoords);
    });
}

function getSizeOfDB() {
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate()
      .then(estimate => {
        alert('Total storage used (bytes):', estimate.usage);
        alert('Total storage quota (bytes):', estimate.quota);
        // console.log('Percentage used:', (estimate.usage / estimate.quota) * 100 + '%');
      });
  }
}

// Initialize event listeners
document.getElementById("start-trip").addEventListener("click", startTrip);
document.getElementById("end-trip").addEventListener("click", endTrip);

// Battery optimization settings
document.getElementById("gps-interval").addEventListener("change", function(e) {
  gpsUpdateInterval = parseInt(e.target.value);
  document.getElementById("current-interval").textContent = (gpsUpdateInterval / 1000) + "s";
  
  // Restart tracking with new interval if trip is active
  if (currentTrip && watchId) {
    navigator.geolocation.clearWatch(watchId);
    startLocationTracking();
  }
});