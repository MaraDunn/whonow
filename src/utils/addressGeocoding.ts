/**
 * Address Geocoding Utility
 * Uses OpenStreetMap Nominatim API to geocode addresses and find businesses
 * Reuses rate limiting from businessLookup utility
 */

export interface BusinessLocation {
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  type?: string;
  class?: string;
  amenity?: string;
  shop?: string;
  address?: {
    [key: string]: string;
  };
}

// Rate limiting state (shared with businessLookup)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second in milliseconds
const requestQueue: Array<{
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  url: string;
  isGeocode: boolean;
}> = [];
let isProcessingQueue = false;

/**
 * Wait for rate limit interval
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Process queued requests one at a time
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || requestQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (!request) break;

    try {
      await waitForRateLimit();
      const response = await fetch(request.url, {
        headers: {
          'User-Agent': 'WhoNow Contact Manager (https://whonow.app)',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait longer and retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          requestQueue.unshift(request); // Put back at front
          continue;
        }
        throw new Error(`Nominatim API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (request.isGeocode) {
        // Geocode request - return coordinates
        if (data && data.length > 0) {
          const result = data[0];
          request.resolve({
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          });
        } else {
          request.resolve(null);
        }
      } else {
        // Business search request - return business locations
        request.resolve(data);
      }
    } catch (error) {
      request.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  isProcessingQueue = false;
}

/**
 * Geocode an address string to coordinates
 * @param address - Address string to geocode
 * @returns Coordinates or null if not found
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address || address.trim().length === 0) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
    requestQueue.push({ resolve, reject, url, isGeocode: true });
    processQueue();
  });
}

/**
 * Find businesses/POIs matching a location name
 * @param location - Business name or location to search for (e.g., "mcdonalds", "starbucks")
 * @returns Array of business locations with coordinates
 */
export async function findBusinessesAtLocation(
  location: string
): Promise<BusinessLocation[]> {
  if (!location || location.trim().length === 0) {
    return [];
  }

  return new Promise((resolve, reject) => {
    // Search for businesses/amenities matching the location name
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=10&addressdetails=1`;
    
    requestQueue.push({
      resolve: (data: NominatimSearchResult[]) => {
        try {
          const businesses: BusinessLocation[] = [];
          
          for (const result of data) {
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            
            if (isNaN(lat) || isNaN(lng)) continue;
            
            // Only include results that look like businesses/POIs
            // Check for amenities, shops, or named places
            const isBusiness = 
              result.amenity || 
              result.shop || 
              result.class === 'amenity' ||
              result.class === 'shop' ||
              result.class === 'tourism' ||
              result.class === 'leisure' ||
              (result.name && result.type);
            
            if (isBusiness) {
              businesses.push({
                name: result.name || result.display_name.split(',')[0] || location,
                lat,
                lng,
                address: result.display_name,
              });
            }
          }
          
          resolve(businesses);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
      reject,
      url,
      isGeocode: false,
    });
    
    processQueue();
  });
}

