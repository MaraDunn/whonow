/**
 * Business Lookup Utility
 * Uses OpenStreetMap Nominatim API to find businesses at addresses
 * Implements rate limiting (1 request/second) as required by Nominatim
 */

export interface BusinessInfo {
  name: string;
  type: string; // e.g., "restaurant", "retail", "office"
}

interface NominatimResponse {
  name?: string;
  display_name?: string;
  type?: string;
  class?: string;
  amenity?: string;
  shop?: string;
  office?: string;
  extratags?: {
    [key: string]: string;
  };
  address?: {
    [key: string]: string;
  };
}

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second in milliseconds
const requestQueue: Array<{
  resolve: (value: BusinessInfo | null) => void;
  reject: (error: Error) => void;
  address: string;
  lat?: number;
  lng?: number;
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
      const result = await performLookup(request.address, request.lat, request.lng);
      request.resolve(result);
    } catch (error) {
      request.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  isProcessingQueue = false;
}

/**
 * Perform the actual Nominatim API lookup
 */
async function performLookup(
  address: string,
  lat?: number,
  lng?: number
): Promise<BusinessInfo | null> {
  try {
    let url: string;
    
    if (lat !== undefined && lng !== undefined) {
      // Use reverse geocoding with coordinates
      url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&extratags=1`;
    } else {
      // Use forward geocoding with address, then reverse
      // First, geocode the address to get coordinates
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=1`;
      
      const geocodeResponse = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'WhoNow Contact Manager (https://whonow.app)',
        },
      });

      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding failed: ${geocodeResponse.statusText}`);
      }

      const geocodeData = await geocodeResponse.json();
      
      if (!geocodeData || geocodeData.length === 0) {
        return null; // Address not found
      }

      const firstResult = geocodeData[0];
      const resultLat = parseFloat(firstResult.lat);
      const resultLon = parseFloat(firstResult.lon);

      if (isNaN(resultLat) || isNaN(resultLon)) {
        return null;
      }

      // Now do reverse geocoding to get business info
      url = `https://nominatim.openstreetmap.org/reverse?lat=${resultLat}&lon=${resultLon}&format=json&addressdetails=1&extratags=1`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WhoNow Contact Manager (https://whonow.app)',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        // Rate limited - wait longer and retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        return performLookup(address, lat, lng);
      }
      throw new Error(`Nominatim API error: ${response.statusText}`);
    }

    const data: NominatimResponse = await response.json();

    if (!data) {
      return null;
    }

    // Extract business information
    const businessName = extractBusinessName(data);
    const businessType = extractBusinessType(data);

    if (businessName) {
      return {
        name: businessName,
        type: businessType || 'unknown',
      };
    }

    return null;
  } catch (error) {
    console.error('Business lookup error:', error);
    // Don't throw - return null to allow contact save to continue
    return null;
  }
}

/**
 * Extract business name from Nominatim response
 */
function extractBusinessName(data: NominatimResponse): string | null {
  // Priority order for business name:
  // 1. name field (most specific)
  // 2. amenity name from extratags
  // 3. shop name from extratags
  // 4. office name from extratags
  
  if (data.name && !isGenericPlaceName(data.name)) {
    return data.name;
  }

  if (data.extratags) {
    const extratags = data.extratags;
    
    // Check for business names in extratags
    if (extratags.name && !isGenericPlaceName(extratags.name)) {
      return extratags.name;
    }
    
    if (extratags['brand:name'] && !isGenericPlaceName(extratags['brand:name'])) {
      return extratags['brand:name'];
    }
    
    if (extratags['operator'] && !isGenericPlaceName(extratags['operator'])) {
      return extratags['operator'];
    }
  }

  // Check if this is a named amenity/shop/office
  if (data.amenity && data.name) {
    return data.name;
  }

  if (data.shop && data.name) {
    return data.name;
  }

  if (data.office && data.name) {
    return data.name;
  }

  return null;
}

/**
 * Check if a name is too generic (e.g., "Building", "Address")
 */
function isGenericPlaceName(name: string): boolean {
  const genericNames = [
    'building',
    'address',
    'house',
    'residential',
    'apartment',
    'unit',
    'suite',
    'floor',
    'room',
  ];
  
  const lowerName = name.toLowerCase().trim();
  return genericNames.some(generic => lowerName === generic || lowerName.startsWith(generic + ' '));
}

/**
 * Extract business type from Nominatim response
 */
function extractBusinessType(data: NominatimResponse): string | null {
  // Priority order:
  // 1. amenity (restaurants, cafes, etc.)
  // 2. shop (retail stores)
  // 3. office
  // 4. tourism (hotels, attractions)
  // 5. leisure (parks, sports)
  
  if (data.amenity) {
    return data.amenity;
  }

  if (data.shop) {
    return `shop:${data.shop}`;
  }

  if (data.office) {
    return 'office';
  }

  if (data.extratags) {
    if (data.extratags.tourism) {
      return `tourism:${data.extratags.tourism}`;
    }
    
    if (data.extratags.leisure) {
      return `leisure:${data.extratags.leisure}`;
    }
  }

  // Fall back to class/type
  if (data.class) {
    return data.class;
  }

  if (data.type) {
    return data.type;
  }

  return null;
}

/**
 * Look up business at an address using OpenStreetMap Nominatim API
 * Implements rate limiting (1 request/second) as required by Nominatim
 * 
 * @param address - Full address string
 * @param lat - Optional latitude (if available, more accurate)
 * @param lng - Optional longitude (if available, more accurate)
 * @returns BusinessInfo if found, null otherwise
 */
export async function lookupBusinessAtAddress(
  address: string,
  lat?: number,
  lng?: number
): Promise<BusinessInfo | null> {
  // Validate input
  if (!address || address.trim().length === 0) {
    return null;
  }

  // If we have coordinates, use them directly
  if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
    return new Promise((resolve, reject) => {
      requestQueue.push({ resolve, reject, address, lat, lng });
      processQueue();
    });
  }

  // Otherwise use address string
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, address });
    processQueue();
  });
}

