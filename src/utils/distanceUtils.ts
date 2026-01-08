/**
 * Distance Calculation Utilities
 * Uses Haversine formula to calculate distances between coordinates
 */

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Check if a contact address is within a specified radius of a target location
 * @param contactLat - Contact's latitude
 * @param contactLng - Contact's longitude
 * @param targetLat - Target location's latitude
 * @param targetLng - Target location's longitude
 * @param radiusMeters - Radius in meters (default: 100m)
 * @returns True if contact is within radius
 */
export function isWithinRadius(
  contactLat: number,
  contactLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number = 100
): boolean {
  if (isNaN(contactLat) || isNaN(contactLng) || isNaN(targetLat) || isNaN(targetLng)) {
    return false;
  }
  
  const distance = calculateDistance(contactLat, contactLng, targetLat, targetLng);
  return distance <= radiusMeters;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

