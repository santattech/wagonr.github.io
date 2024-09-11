export function haversineDistance(lat1, lon1, lat2, lon2) {
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


export function getRandomInRange(from, to, fixed) {
  return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
  // .toFixed() returns string, so ' * 1' is a trick to convert to number
}
