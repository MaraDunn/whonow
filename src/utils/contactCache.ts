/**
 * Contact Cache using IndexedDB for offline support
 * Provides local storage and search capabilities
 */

import { Contact } from "@/types/contact";

const DB_NAME = "whonow_contacts";
const DB_VERSION = 1;
const STORE_NAME = "contacts";
const INDEX_STORE = "search_index";

interface CachedContact extends Contact {
  cachedAt: number;
}

/**
 * Open IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create contacts store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("company", "company", { unique: false });
        store.createIndex("folderId", "folderId", { unique: false });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
      }
      
      // Create index store for search tokens
      if (!db.objectStoreNames.contains(INDEX_STORE)) {
        const indexStore = db.createObjectStore(INDEX_STORE, { keyPath: "token" });
        indexStore.createIndex("contactIds", "contactIds", { unique: false, multiEntry: true });
      }
    };
  });
}

/**
 * Cache contacts to IndexedDB
 */
export async function cacheContacts(contacts: Contact[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    const now = Date.now();
    
    for (const contact of contacts) {
      const cached: CachedContact = {
        ...contact,
        cachedAt: now,
      };
      store.put(cached);
    }
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (error) {
    console.warn("Failed to cache contacts:", error);
  }
}

/**
 * Get cached contacts from IndexedDB
 */
export async function getCachedContacts(): Promise<Contact[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        db.close();
        const contacts = request.result.map(({ cachedAt, ...contact }: CachedContact) => contact);
        resolve(contacts);
      };
      
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn("Failed to get cached contacts:", error);
    return [];
  }
}

/**
 * Clear all cached contacts
 */
export async function clearContactCache(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (error) {
    console.warn("Failed to clear contact cache:", error);
  }
}

/**
 * Get cache age (oldest contact timestamp)
 */
export async function getCacheAge(): Promise<number | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const index = store.index("cachedAt");
    
    return new Promise((resolve, reject) => {
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          db.close();
          resolve(Date.now() - cursor.value.cachedAt);
        } else {
          db.close();
          resolve(null);
        }
      };
      
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn("Failed to get cache age:", error);
    return null;
  }
}

/**
 * Check if cache is stale (older than specified minutes)
 */
export async function isCacheStale(maxAgeMinutes: number = 30): Promise<boolean> {
  const age = await getCacheAge();
  if (age === null) return true;
  return age > maxAgeMinutes * 60 * 1000;
}

/**
 * Update single contact in cache
 */
export async function updateCachedContact(contact: Contact): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    
    const cached: CachedContact = {
      ...contact,
      cachedAt: Date.now(),
    };
    store.put(cached);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (error) {
    console.warn("Failed to update cached contact:", error);
  }
}

/**
 * Remove contact from cache
 */
export async function removeCachedContact(contactId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(contactId);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (error) {
    console.warn("Failed to remove cached contact:", error);
  }
}
