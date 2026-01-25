/**
 * Contact Embedding Generation and Caching
 * Generates embeddings for contacts and caches them in IndexedDB
 * Uses same model as semantic assist (all-MiniLM-L6-v2)
 */

import { Contact } from "@/types/contact";

const DB_NAME = "contact_embeddings";
const DB_VERSION = 1;
const EMBEDDING_STORE = "contact_embeddings";
const CONTACT_VERSION_STORE = "contact_versions";

// Current embedding version - increment to invalidate cache
const CURRENT_EMBEDDING_VERSION = 1;

let db: IDBDatabase | null = null;
let embeddingModel: any = null;
let modelLoading: Promise<any> | null = null;

/**
 * Initialize IndexedDB for contact embeddings
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
      if (!database.objectStoreNames.contains(EMBEDDING_STORE)) {
        database.createObjectStore(EMBEDDING_STORE);
      }

      if (!database.objectStoreNames.contains(CONTACT_VERSION_STORE)) {
        database.createObjectStore(CONTACT_VERSION_STORE);
      }
    };
  });
}

/**
 * Load embedding model (lazy load, cached)
 */
async function loadEmbeddingModel(): Promise<any> {
  if (embeddingModel) return embeddingModel;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      // TODO: Re-implement with ONNX Runtime after T5 query parser is working
      // const { pipeline } = await import("@xenova/transformers");
      //
      // embeddingModel = await pipeline(
      //   "feature-extraction",
      //   "Xenova/all-MiniLM-L6-v2",
      //   {
      //     quantized: true,
      //     device: typeof window !== "undefined" ? "wasm" : "cpu",
      //   }
      // );

      console.log("[Embeddings] Temporarily disabled - using deterministic search only");
      return null;
    } catch (error) {
      console.warn("Failed to load embedding model:", error);
      return null;
    } finally {
      modelLoading = null;
    }
  })();

  return modelLoading;
}

/**
 * Generate text representation of contact for embedding
 * Combines name, company, role, description, and tags
 */
function getContactText(contact: Contact): string {
  const parts: string[] = [];

  if (contact.name) parts.push(contact.name);
  if (contact.company) parts.push(contact.company);
  if (contact.role) parts.push(contact.role);
  if (contact.description) parts.push(contact.description);
  if (contact.businessName) parts.push(contact.businessName);
  if (contact.businessType) parts.push(contact.businessType);
  if (contact.tags && contact.tags.length > 0) {
    parts.push(...contact.tags);
  }

  return parts.join(" ").trim();
}

/**
 * Generate embedding for a contact
 */
async function generateContactEmbedding(contact: Contact): Promise<number[] | null> {
  try {
    const model = await loadEmbeddingModel();
    if (!model) return null;

    const contactText = getContactText(contact);
    if (!contactText) return null;

    const output = await model(contactText, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data);
  } catch (error) {
    console.warn("Failed to generate contact embedding:", error);
    return null;
  }
}

/**
 * Get contact version key for cache invalidation
 */
function getContactVersionKey(contactId: string): string {
  return `version_${contactId}`;
}

/**
 * Get cached contact embedding
 */
export async function getCachedContactEmbedding(
  contactId: string
): Promise<number[] | null> {
  try {
    const database = await getDB();
    const transaction = database.transaction([EMBEDDING_STORE, CONTACT_VERSION_STORE], "readonly");
    const embeddingStore = transaction.objectStore(EMBEDDING_STORE);
    const versionStore = transaction.objectStore(CONTACT_VERSION_STORE);

    // Check version first
    const versionKey = getContactVersionKey(contactId);
    const versionRequest = versionStore.get(versionKey);
    const version = await new Promise<number | null>((resolve, reject) => {
      versionRequest.onsuccess = () => resolve(versionRequest.result);
      versionRequest.onerror = () => reject(versionRequest.error);
    });

    if (version !== CURRENT_EMBEDDING_VERSION) {
      // Version mismatch - cache invalid
      return null;
    }

    // Get embedding
    const embeddingRequest = embeddingStore.get(contactId);
    return await new Promise<number[] | null>((resolve, reject) => {
      embeddingRequest.onsuccess = () => resolve(embeddingRequest.result);
      embeddingRequest.onerror = () => reject(embeddingRequest.error);
    });
  } catch (error) {
    console.warn("Failed to retrieve cached contact embedding:", error);
    return null;
  }
}

/**
 * Cache contact embedding
 */
export async function cacheContactEmbedding(
  contactId: string,
  embedding: number[]
): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([EMBEDDING_STORE, CONTACT_VERSION_STORE], "readwrite");
    const embeddingStore = transaction.objectStore(EMBEDDING_STORE);
    const versionStore = transaction.objectStore(CONTACT_VERSION_STORE);

    // Store embedding
    await new Promise<void>((resolve, reject) => {
      const request = embeddingStore.put(embedding, contactId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Store version
    const versionKey = getContactVersionKey(contactId);
    await new Promise<void>((resolve, reject) => {
      const request = versionStore.put(CURRENT_EMBEDDING_VERSION, versionKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to cache contact embedding:", error);
  }
}

/**
 * Get or generate contact embedding (with caching)
 */
export async function getContactEmbedding(contact: Contact): Promise<number[] | null> {
  // Check cache first
  const cached = await getCachedContactEmbedding(contact.id);
  if (cached) {
    return cached;
  }

  // Generate new embedding
  const embedding = await generateContactEmbedding(contact);
  if (embedding) {
    // Cache it
    await cacheContactEmbedding(contact.id, embedding);
  }

  return embedding;
}

/**
 * Batch generate embeddings for multiple contacts
 * Returns a map of contactId -> embedding
 * Optimized to prioritize cached embeddings and avoid blocking
 */
export async function getContactEmbeddings(
  contacts: Contact[]
): Promise<Map<string, number[]>> {
  const embeddings = new Map<string, number[]>();

  // First, try to get all cached embeddings in parallel (fast path)
  const cachedPromises = contacts.map(async (contact) => {
    const cached = await getCachedContactEmbedding(contact.id);
    if (cached) {
      embeddings.set(contact.id, cached);
      return { contact, embedding: cached, cached: true };
    }
    return { contact, embedding: null, cached: false };
  });

  const cachedResults = await Promise.all(cachedPromises);
  
  // Only generate embeddings for contacts that weren't cached
  const uncachedContacts = cachedResults
    .filter(r => !r.cached)
    .map(r => r.contact);

  if (uncachedContacts.length === 0) {
    return embeddings; // All were cached, return immediately
  }

  // Process uncached contacts in smaller batches to avoid blocking
  const BATCH_SIZE = 5; // Reduced batch size for better responsiveness
  for (let i = 0; i < uncachedContacts.length; i += BATCH_SIZE) {
    const batch = uncachedContacts.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (contact) => {
      const embedding = await getContactEmbedding(contact);
      if (embedding) {
        embeddings.set(contact.id, embedding);
      }
    });

    await Promise.all(batchPromises);
    
    // Yield to UI thread between batches to prevent blocking
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return embeddings;
}

/**
 * Invalidate cached embedding for a contact (e.g., when contact is updated)
 */
export async function invalidateContactEmbedding(contactId: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([EMBEDDING_STORE, CONTACT_VERSION_STORE], "readwrite");
    const embeddingStore = transaction.objectStore(EMBEDDING_STORE);
    const versionStore = transaction.objectStore(CONTACT_VERSION_STORE);

    // Delete embedding
    await new Promise<void>((resolve, reject) => {
      const request = embeddingStore.delete(contactId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Delete version
    const versionKey = getContactVersionKey(contactId);
    await new Promise<void>((resolve, reject) => {
      const request = versionStore.delete(versionKey);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to invalidate contact embedding:", error);
  }
}

/**
 * Clear all cached contact embeddings
 */
export async function clearContactEmbeddings(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction(
      [EMBEDDING_STORE, CONTACT_VERSION_STORE],
      "readwrite"
    );

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(EMBEDDING_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(CONTACT_VERSION_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
  } catch (error) {
    console.warn("Failed to clear contact embeddings:", error);
  }
}
