/**
 * Browser/PWA Offline Caching
 * IndexedDB caching for embedding models and query embeddings
 */

const DB_NAME = "search_cache";
const DB_VERSION = 1;
const MODEL_STORE = "embedding_models";
const EMBEDDING_STORE = "query_embeddings";
const MODEL_VERSION_KEY = "model_version";

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
      if (!database.objectStoreNames.contains(MODEL_STORE)) {
        database.createObjectStore(MODEL_STORE);
      }

      if (!database.objectStoreNames.contains(EMBEDDING_STORE)) {
        database.createObjectStore(EMBEDDING_STORE);
      }
    };
  });
}

/**
 * Cache embedding model in IndexedDB
 */
export async function cacheEmbeddingModel(
  modelName: string,
  modelData: ArrayBuffer
): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([MODEL_STORE], "readwrite");
    const store = transaction.objectStore(MODEL_STORE);

    // Store model data
    await new Promise<void>((resolve, reject) => {
      const request = store.put(modelData, modelName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Store version
    await new Promise<void>((resolve, reject) => {
      const request = store.put(
        CURRENT_MODEL_VERSION,
        `${MODEL_VERSION_KEY}_${modelName}`
      );
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to cache embedding model:", error);
  }
}

/**
 * Retrieve cached embedding model from IndexedDB
 */
export async function getCachedEmbeddingModel(
  modelName: string
): Promise<ArrayBuffer | null> {
  try {
    const database = await getDB();
    const transaction = database.transaction([MODEL_STORE], "readonly");
    const store = transaction.objectStore(MODEL_STORE);

    // Check version first
    const versionRequest = store.get(`${MODEL_VERSION_KEY}_${modelName}`);
    const version = await new Promise<number | null>((resolve, reject) => {
      versionRequest.onsuccess = () => resolve(versionRequest.result);
      versionRequest.onerror = () => reject(versionRequest.error);
    });

    if (version !== CURRENT_MODEL_VERSION) {
      // Version mismatch - cache invalid
      return null;
    }

    // Get model data
    const modelRequest = store.get(modelName);
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      modelRequest.onsuccess = () => resolve(modelRequest.result);
      modelRequest.onerror = () => reject(modelRequest.error);
    });
  } catch (error) {
    console.warn("Failed to retrieve cached embedding model:", error);
    return null;
  }
}

/**
 * Cache query embedding for faster lookup
 */
export async function cacheQueryEmbedding(
  query: string,
  embedding: number[]
): Promise<void> {
  try {
    // Compute hash BEFORE creating transaction to avoid transaction timeout
    const queryHash = await hashQuery(query);
    
    const database = await getDB();
    const transaction = database.transaction([EMBEDDING_STORE], "readwrite");
    const store = transaction.objectStore(EMBEDDING_STORE);

    await new Promise<void>((resolve, reject) => {
      const request = store.put(embedding, queryHash);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to cache query embedding:", error);
  }
}

/**
 * Get cached query embedding
 */
export async function getCachedQueryEmbedding(
  query: string
): Promise<number[] | null> {
  try {
    // Compute hash BEFORE creating transaction to avoid transaction timeout
    const queryHash = await hashQuery(query);
    
    const database = await getDB();
    const transaction = database.transaction([EMBEDDING_STORE], "readonly");
    const store = transaction.objectStore(EMBEDDING_STORE);

    return await new Promise<number[] | null>((resolve, reject) => {
      const request = store.get(queryHash);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to retrieve cached query embedding:", error);
    return null;
  }
}

/**
 * Simple hash function for query strings
 */
async function hashQuery(query: string): Promise<string> {
  // Use Web Crypto API if available, otherwise fallback to simple hash
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(query.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback: simple hash
  let hash = 0;
  const normalized = query.toLowerCase().trim();
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Clear all cached data (useful for debugging or cache invalidation)
 */
export async function clearCache(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction(
      [MODEL_STORE, EMBEDDING_STORE],
      "readwrite"
    );

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(MODEL_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(EMBEDDING_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
  } catch (error) {
    console.warn("Failed to clear cache:", error);
  }
}
