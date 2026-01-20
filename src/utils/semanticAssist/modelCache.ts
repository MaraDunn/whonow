/**
 * Model Cache for LLM Query Parsing
 * IndexedDB caching for LLM models and parsed query results
 */

import { SearchQuery } from "@/types/searchQuery";

const DB_NAME = "llm_cache";
const DB_VERSION = 1;
const QUERY_STORE = "parsed_queries";
const MODEL_STORE = "llm_models";
const MODEL_VERSION_KEY = "model_version";
const MODEL_FAILED_KEY = "model_load_failed";

// Current model version - increment to invalidate cache
const CURRENT_MODEL_VERSION = 1;

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

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
      if (!database.objectStoreNames.contains(QUERY_STORE)) {
        database.createObjectStore(QUERY_STORE);
      }

      if (!database.objectStoreNames.contains(MODEL_STORE)) {
        database.createObjectStore(MODEL_STORE);
      }
    };
  });
}

/**
 * Hash query text for cache key
 */
async function hashQuery(query: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(query.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get cached parsed query
 */
export async function getCachedParsedQuery(
  query: string
): Promise<SearchQuery | null> {
  try {
    const database = await getDB();
    const queryHash = await hashQuery(query);
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([QUERY_STORE], "readonly");
      const store = transaction.objectStore(QUERY_STORE);
      const request = store.get(queryHash);

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
          const deleteTransaction = database.transaction([QUERY_STORE], "readwrite");
          const deleteStore = deleteTransaction.objectStore(QUERY_STORE);
          deleteStore.delete(queryHash);
          resolve(null);
          return;
        }

        resolve(cached.query as SearchQuery);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to get cached parsed query:", error);
    return null;
  }
}

/**
 * Cache parsed query
 */
export async function cacheParsedQuery(
  query: string,
  parsedQuery: SearchQuery
): Promise<void> {
  try {
    const database = await getDB();
    const queryHash = await hashQuery(query);
    
    const cacheEntry = {
      query: parsedQuery,
      cachedAt: Date.now(),
    };

    const transaction = database.transaction([QUERY_STORE], "readwrite");
    const store = transaction.objectStore(QUERY_STORE);
    await store.put(cacheEntry, queryHash);
  } catch (error) {
    console.warn("Failed to cache parsed query:", error);
  }
}

/**
 * Check if model version matches current version
 */
export async function isModelVersionCurrent(): Promise<boolean> {
  try {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([MODEL_STORE], "readonly");
      const store = transaction.objectStore(MODEL_STORE);
      const request = store.get(MODEL_VERSION_KEY);

      request.onsuccess = () => {
        const cached = request.result;
        if (!cached) {
          resolve(false);
          return;
        }

        resolve(cached.version === CURRENT_MODEL_VERSION);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to check model version:", error);
    return false;
  }
}

/**
 * Mark model version as cached
 */
export async function markModelVersionCached(): Promise<void> {
  try {
    const database = await getDB();
    
    const versionEntry = {
      version: CURRENT_MODEL_VERSION,
      cachedAt: Date.now(),
    };

    const transaction = database.transaction([MODEL_STORE], "readwrite");
    const store = transaction.objectStore(MODEL_STORE);
    await store.put(versionEntry, MODEL_VERSION_KEY);
  } catch (error) {
    console.warn("Failed to mark model version as cached:", error);
  }
}

/**
 * Clear all cached queries (useful for debugging or cache invalidation)
 */
export async function clearQueryCache(): Promise<void> {
  try {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([QUERY_STORE], "readwrite");
      const store = transaction.objectStore(QUERY_STORE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to clear query cache:", error);
  }
}

/**
 * Check if model loading has previously failed
 */
export async function isModelLoadFailed(): Promise<boolean> {
  try {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
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
        // After 24 hours, allow retry in case network/model issues are resolved
        const now = Date.now();
        const failedAt = cached.failedAt || 0;
        const retryAfterMs = 24 * 60 * 60 * 1000; // 24 hours
        
        if (now - failedAt > retryAfterMs) {
          // Failure was old, allow retry
          resolve(false);
          return;
        }
        
        resolve(true);
      };

      request.onerror = () => reject(request.error);
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
    
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([MODEL_STORE], "readwrite");
      const store = transaction.objectStore(MODEL_STORE);
      const request = store.delete(MODEL_FAILED_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to clear model load failure status:", error);
  }
}
