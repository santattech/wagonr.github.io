const db = new PouchDB('destinationDB');
let start = null;
let destination = null;
let straightLine = null;
let initialDistance = null;
let map = L.map('map').setView([0, 0], 13);
let startMarker, destMarker;

// Leaflet Tile
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Get current location
navigator.geolocation.getCurrentPosition(pos => {
  const { latitude, longitude } = pos.coords;
  start = { lat: latitude, lon: longitude };
  map.setView([latitude, longitude], 15);
  startMarker = L.marker([latitude, longitude], { title: 'Start' }).addTo(map);
  checkSavedDestination(); // load destination if saved
});

// Collapsible toggle
document.querySelectorAll(".collapsible").forEach(btn => {
  btn.addEventListener("click", function () {
    this.classList.toggle("active");
    const content = this.nextElementSibling;
    content.style.display = content.style.display === "block" ? "none" : "block";
  });
});

// Input listener
document.querySelectorAll("#lat, #lon").forEach(input => {
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
      console.log("Initial distance:", initialDistance);

      // Save lat, lon, and initialDistance in PouchDB
      db.get('destination').then(doc => {
        // db.remove(doc); // remove old doc
        return db.put({
          ...doc,
          lat,
          lon,
          initialDistance
        });
      }).catch(err => {
        // If not found, create new
        if (err.name === 'not_found') {
          db.put({
            _id: 'destination',
            lat,
            lon,
            initialDistance
          });
        }
      });
    }

    updateDistance(); // trigger initial update
  }
}

// Save destination on button click
function checkSavedDestination() {
  db.get('destination').then(doc => {
    document.getElementById("lat").value = doc.lat;
    document.getElementById("lon").value = doc.lon;
    destination = { lat: doc.lat, lon: doc.lon };
    initialDistance = doc.initialDistance;

    // Add marker
    destMarker = L.marker([doc.lat, doc.lon], { title: "Destination" }).addTo(map);

    updateDistance();
  }).catch(() => {});
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function updateDistance() {
  console.log("Updating distance...");
  if (!start || !destination) return;

  navigator.geolocation.getCurrentPosition(pos => {
    start = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    if (startMarker) map.removeLayer(startMarker);
    
    startMarker = L.marker([start.lat, start.lon], { title: "Current" }).addTo(map);

    const remaining = haversineDistance(start.lat, start.lon, destination.lat, destination.lon);

    // Add this after setting start and destination
    updateGreenLine(start, destination);

    // If we already have initialDistance in memory, just use it
    if (initialDistance) {
      updateProgressBar(remaining, initialDistance);
    } else {
      // Else fetch it from DB
      db.get('destination').then(doc => {
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
      }).catch(err => {
        console.error("Could not load initialDistance from DB", err);
      });
    }

    updateTrackingInformation();
    
  });
}

function updateProgressBar(remaining, initial) {
  const progress = Math.min(100, ((initial - remaining) / initial) * 100);
  document.getElementById("distance").innerText = `${(remaining / 1000).toFixed(2)} km remaining`;

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
        [destination.lat, destination.lon]
      ],
      {
        color: 'green',
        weight: 4,
        // opacity: 0.7,
        // dashArray: '5,10' // optional: dashed line
      }
    ).addTo(map);
  }
}

function updateTrackingInformation() {
  navigator.geolocation.getCurrentPosition(pos => {
    start = { lat: pos.coords.latitude, lon: pos.coords.longitude };
  
    // Marker & line logic...
  
    const remaining = haversineDistance(start.lat, start.lon, destination.lat, destination.lon);
  
    // --- Speed ---
    const speed = pos.coords.speed; // in m/s
  
    let speedKmH = 0;
    if (speed !== null && !isNaN(speed)) {
      speedKmH = speed * 3.6; // Convert m/s to km/h
    }
  
    document.getElementById("current-speed").innerText = `${speedKmH.toFixed(1)} km/h`;
  
    // --- ETA ---
    let etaText = "N/A";
    if (speedKmH > 1 && remaining > 0) {
      const etaHours = (remaining / 1000) / speedKmH;
      const etaMinutes = etaHours * 60;
      const minutes = Math.floor(etaMinutes);
      const seconds = Math.round((etaMinutes - minutes) * 60);
      etaText = `${minutes} min ${seconds} sec`;
    }
  
    document.querySelector("#tracking-info p:last-child").innerHTML = `ETA: <strong>${etaText}</strong>`;
  });  
}


// Update every 10s
setInterval(updateDistance, 5000);
