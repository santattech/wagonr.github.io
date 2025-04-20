const db = new PouchDB("destinationDB");
const dbTracking = new PouchDB("trackingDB");
let start = null;
let destination = null;
let straightLine = null;
let routeLine = null;
let initialDistance = null;
let getRouteCounter = 0;
let map = L.map("map").setView([0, 0], 13);
let startMarker, destMarker;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then(() => console.log("Service Worker registered"))
    .catch((err) => console.error("Service Worker failed", err));
}

// Leaflet Tile
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Get current location
navigator.geolocation.getCurrentPosition((pos) => {
  const { latitude, longitude } = pos.coords;
  start = { lat: latitude, lon: longitude };
  map.setView([latitude, longitude], 15);
  startMarker = L.marker([latitude, longitude], { title: "Start" }).addTo(map);
  checkSavedDestination(); // load destination if saved
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

    if (getRouteCounter % 5 == 0) {
      getRoute(start.lat, start.lon, destination.lat, destination.lon);
    }
    getRouteCounter++;
  });
}

function updateProgressBar(remaining, initial) {
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
setInterval(updateDistance, 20 * 1000);
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
    const estimatedTotalKm = totalKm * 1.5;
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
        document.querySelector(
          "#tracking-info p:last-child"
        ).innerText = `ETA: ${etaFormatted} (at ${speedKmPerHr.toFixed(
          1
        )} km/h)`;

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
  const totalMinutes = Math.round(mins);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
}

async function deleteOldTrackingData() {
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
