/**
 * Model Cache for LLM Contact Parsing
 * IndexedDB caching for parsed contact results
 */

import { ParsedContactData } from "./contactTextParser";

const DB_NAME = "llm_cache";
const DB_VERSION = 2; // Incremented to trigger upgrade for new store
const CONTACT_STORE = "parsed_contacts";
const MODEL_STORE = "llm_models";
const MODEL_FAILED_KEY = "model_load_failed";

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
async function getDB(): Promise<IDBDatabase> {
  if (db) {
    // Check if store exists, if not we need to recreate the connection
    if (!db.objectStoreNames.contains(CONTACT_STORE)) {
      db = null; // Force recreation
    } else {
      return db;
    }
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains(CONTACT_STORE)) {
        database.createObjectStore(CONTACT_STORE);
      }

      if (!database.objectStoreNames.contains(MODEL_STORE)) {
        database.createObjectStore(MODEL_STORE);
      }
    };
  });
}

/**
 * Hash contact input text for cache key
 */
async function hashContactInput(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get cached parsed contact
 */
export async function getCachedParsedContact(
  input: string
): Promise<ParsedContactData | null> {
  try {
    const database = await getDB();
    
    // Check if store exists before using it
    if (!database.objectStoreNames.contains(CONTACT_STORE)) {
      console.warn("Contact store not found in database, skipping cache");
      return null;
    }
    
    const inputHash = await hashContactInput(input);
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = database.transaction([CONTACT_STORE], "readonly");
        const store = transaction.objectStore(CONTACT_STORE);
        const request = store.get(inputHash);

        request.onsuccess = () => {
          const cached = request.result;
          if (!cached) {
            resolve(null);
            return;
          }

          // Check if cache is expired (24 hours TTL)
          const now = Date.now();
          const cachedAt = cached.cachedAt || 0;
          const ttlMs = 24 * 60 * 60 * 1000; // 24 hours

          if (now - cachedAt > ttlMs) {
            // Cache expired, delete it
            try {
              const deleteTransaction = database.transaction([CONTACT_STORE], "readwrite");
              const deleteStore = deleteTransaction.objectStore(CONTACT_STORE);
              deleteStore.delete(inputHash);
            } catch (deleteError) {
              // Ignore delete errors
            }
            resolve(null);
            return;
          }

          resolve(cached.parsed as ParsedContactData);
        };

        request.onerror = () => {
          console.warn("Failed to get cached contact:", request.error);
          resolve(null); // Return null instead of rejecting
        };
      } catch (error) {
        console.warn("Failed to access contact cache:", error);
        resolve(null); // Return null instead of rejecting
      }
    });
  } catch (error) {
    console.warn("Failed to get cached parsed contact:", error);
    return null;
  }
}

/**
 * Cache parsed contact
 */
export async function cacheParsedContact(
  input: string,
  parsed: ParsedContactData
): Promise<void> {
  try {
    const database = await getDB();
    
    // Check if store exists before using it
    if (!database.objectStoreNames.contains(CONTACT_STORE)) {
      console.warn("Contact store not found in database, skipping cache");
      return;
    }
    
    const inputHash = await hashContactInput(input);
    
    const cacheEntry = {
      parsed,
      cachedAt: Date.now(),
    };

    const transaction = database.transaction([CONTACT_STORE], "readwrite");
    const store = transaction.objectStore(CONTACT_STORE);
    await store.put(cacheEntry, inputHash);
  } catch (error) {
    console.warn("Failed to cache parsed contact:", error);
  }
}

/**
 * Check if model loading has previously failed
 */
export async function isModelLoadFailed(): Promise<boolean> {
  try {
    const database = await getDB();
    
    // Check if store exists
    if (!database.objectStoreNames.contains(MODEL_STORE)) {
      return false;
    }
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = database.transaction([MODEL_STORE], "readonly");
        const store = transaction.objectStore(MODEL_STORE);
        const request = store.get(MODEL_FAILED_KEY);

        request.onsuccess = () => {
          const cached = request.result;
          if (!cached) {
            resolve(false);
            return;
          }
          // Check if failure was recent (within last 24 hours)
          const now = Date.now();
          const failedAt = cached.failedAt || 0;
          const retryAfterMs = 24 * 60 * 60 * 1000; // 24 hours
          
          if (now - failedAt > retryAfterMs) {
            resolve(false);
            return;
          }
          
          resolve(true);
        };

        request.onerror = () => {
          console.warn("Failed to check model load failure status:", request.error);
          resolve(false); // Return false instead of rejecting
        };
      } catch (error) {
        console.warn("Failed to access model failure status:", error);
        resolve(false);
      }
    });
  } catch (error) {
    console.warn("Failed to check model load failure status:", error);
    return false;
  }
}

/**
 * Mark model loading as failed
 */
export async function markModelLoadFailed(): Promise<void> {
  try {
    const database = await getDB();
    
    // Check if store exists
    if (!database.objectStoreNames.contains(MODEL_STORE)) {
      return;
    }
    
    const failureEntry = {
      failed: true,
      failedAt: Date.now(),
    };

    const transaction = database.transaction([MODEL_STORE], "readwrite");
    const store = transaction.objectStore(MODEL_STORE);
    await store.put(failureEntry, MODEL_FAILED_KEY);
  } catch (error) {
    console.warn("Failed to mark model load as failed:", error);
  }
}

/**
 * Clear model load failure status (allow retry)
 */
export async function clearModelLoadFailure(): Promise<void> {
  try {
    const database = await getDB();
    
    // Check if store exists
    if (!database.objectStoreNames.contains(MODEL_STORE)) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([MODEL_STORE], "readwrite");
      const store = transaction.objectStore(MODEL_STORE);
      const request = store.delete(MODEL_FAILED_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn("Failed to clear model load failure status:", request.error);
        resolve(); // Don't reject, just resolve
      };
    });
  } catch (error) {
    console.warn("Failed to clear model load failure status:", error);
  }
}
