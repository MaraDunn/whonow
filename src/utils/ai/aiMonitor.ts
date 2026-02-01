/**
 * AI Monitoring and Diagnostics System
 * Tracks AI performance, failures, and provides debugging capabilities
 * 
 * Features:
 * - Success/failure rate tracking
 * - Latency monitoring
 * - Circuit breaker pattern
 * - Diagnostic API for debugging
 * - Session persistence (IndexedDB)
 */

import { isDebugMode } from "./aiConfig";
import { devLog } from "@/lib/devLog";

export interface AIStats {
  // Usage stats
  totalQueries: number;
  aiEnhancedQueries: number;
  fallbackQueries: number;
  
  // Performance
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  
  // Reliability
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  
  // Model status
  t5ModelLoaded: boolean;
  embeddingsModelLoaded: boolean;
  
  // Timestamps
  lastSuccessAt?: number;
  lastFailureAt?: number;
  sessionStartAt: number;
}

export interface AIEvent {
  timestamp: number;
  type: 'query' | 'success' | 'failure' | 'timeout' | 'model_load' | 'fallback';
  query?: string;
  latencyMs?: number;
  error?: string;
  confidence?: number;
  aiUsed: boolean;
  fallbackReason?: string;
}

const DB_NAME = 'ai_monitoring';
const DB_VERSION = 1;
const STATS_STORE = 'stats';
const EVENTS_STORE = 'events';

let db: IDBDatabase | null = null;
let stats: AIStats = {
  totalQueries: 0,
  aiEnhancedQueries: 0,
  fallbackQueries: 0,
  avgLatencyMs: 0,
  maxLatencyMs: 0,
  minLatencyMs: Infinity,
  successCount: 0,
  failureCount: 0,
  consecutiveFailures: 0,
  t5ModelLoaded: false,
  embeddingsModelLoaded: false,
  sessionStartAt: Date.now(),
};

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
      
      if (!database.objectStoreNames.contains(STATS_STORE)) {
        database.createObjectStore(STATS_STORE);
      }
      
      if (!database.objectStoreNames.contains(EVENTS_STORE)) {
        const eventStore = database.createObjectStore(EVENTS_STORE, {
          keyPath: 'timestamp',
          autoIncrement: true,
        });
        eventStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

/**
 * Load stats from IndexedDB
 */
async function loadStats(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STATS_STORE], 'readonly');
    const store = transaction.objectStore(STATS_STORE);
    const request = store.get('current');
    
    const savedStats = await new Promise<AIStats | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    if (savedStats) {
      stats = { ...savedStats, sessionStartAt: Date.now() };
    }
  } catch (error) {
    console.warn('[AI Monitor] Failed to load stats:', error);
  }
}

/**
 * Save stats to IndexedDB
 */
async function saveStats(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STATS_STORE], 'readwrite');
    const store = transaction.objectStore(STATS_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(stats, 'current');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[AI Monitor] Failed to save stats:', error);
  }
}

/**
 * Record an event
 */
async function recordEvent(event: AIEvent): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(event);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    // Keep only last 100 events
    await pruneEvents();
  } catch (error) {
    console.warn('[AI Monitor] Failed to record event:', error);
  }
}

/**
 * Prune old events (keep last 100)
 */
async function pruneEvents(): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([EVENTS_STORE], 'readwrite');
    const store = transaction.objectStore(EVENTS_STORE);
    
    const countRequest = store.count();
    const count = await new Promise<number>((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    
    if (count > 100) {
      const request = store.openCursor();
      let deleteCount = count - 100;
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && deleteCount > 0) {
          cursor.delete();
          deleteCount--;
          cursor.continue();
        }
      };
    }
  } catch (error) {
    console.warn('[AI Monitor] Failed to prune events:', error);
  }
}

/**
 * Track a query
 */
export async function trackQuery(
  query: string,
  result: {
    aiUsed: boolean;
    confidence?: number;
    latencyMs: number;
    fallbackReason?: string;
    error?: string;
  }
): Promise<void> {
  stats.totalQueries++;
  
  if (result.aiUsed) {
    stats.aiEnhancedQueries++;
    stats.successCount++;
    stats.consecutiveFailures = 0;
    stats.lastSuccessAt = Date.now();
  } else {
    stats.fallbackQueries++;
    if (result.error) {
      stats.failureCount++;
      stats.consecutiveFailures++;
      stats.lastFailureAt = Date.now();
    }
  }
  
  // Update latency stats
  if (result.latencyMs > stats.maxLatencyMs) {
    stats.maxLatencyMs = result.latencyMs;
  }
  if (result.latencyMs < stats.minLatencyMs) {
    stats.minLatencyMs = result.latencyMs;
  }
  stats.avgLatencyMs = (stats.avgLatencyMs * (stats.totalQueries - 1) + result.latencyMs) / stats.totalQueries;
  
  // Record event
  await recordEvent({
    timestamp: Date.now(),
    type: result.aiUsed ? 'success' : (result.error ? 'failure' : 'fallback'),
    query: query.substring(0, 100), // Truncate for privacy
    latencyMs: result.latencyMs,
    error: result.error,
    confidence: result.confidence,
    aiUsed: result.aiUsed,
    fallbackReason: result.fallbackReason,
  });
  
  // Save stats periodically
  if (stats.totalQueries % 10 === 0) {
    await saveStats();
  }
  
  // Debug logging
  if (isDebugMode()) {
    devLog('[AI Monitor] Query tracked:', {
      aiUsed: result.aiUsed,
      latencyMs: result.latencyMs,
      confidence: result.confidence,
      fallbackReason: result.fallbackReason,
    });
  }
}

/**
 * Update model status
 */
export async function updateModelStatus(model: 't5' | 'embeddings', loaded: boolean): Promise<void> {
  if (model === 't5') {
    stats.t5ModelLoaded = loaded;
  } else {
    stats.embeddingsModelLoaded = loaded;
  }
  
  await recordEvent({
    timestamp: Date.now(),
    type: 'model_load',
    aiUsed: loaded,
    error: loaded ? undefined : 'Model failed to load',
  });
  
  await saveStats();
}

/**
 * Get current stats
 */
export function getStats(): AIStats {
  return { ...stats };
}

/**
 * Get success rate
 */
export function getSuccessRate(): number {
  if (stats.totalQueries === 0) return 1;
  return stats.successCount / stats.totalQueries;
}

/**
 * Check if circuit breaker should trip (too many consecutive failures)
 */
export function shouldTripCircuitBreaker(maxFailures: number = 3): boolean {
  return stats.consecutiveFailures >= maxFailures;
}

/**
 * Reset consecutive failures (e.g., after successful query)
 */
export function resetCircuitBreaker(): void {
  stats.consecutiveFailures = 0;
}

/**
 * Get recent events
 */
export async function getRecentEvents(limit: number = 20): Promise<AIEvent[]> {
  try {
    const database = await getDB();
    const transaction = database.transaction([EVENTS_STORE], 'readonly');
    const store = transaction.objectStore(EVENTS_STORE);
    
    return new Promise((resolve, reject) => {
      const events: AIEvent[] = [];
      const request = store.openCursor(null, 'prev'); // Reverse order (newest first)
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && events.length < limit) {
          events.push(cursor.value);
          cursor.continue();
        } else {
          resolve(events);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[AI Monitor] Failed to get recent events:', error);
    return [];
  }
}

/**
 * Clear all stats and events
 */
export async function clearStats(): Promise<void> {
  stats = {
    totalQueries: 0,
    aiEnhancedQueries: 0,
    fallbackQueries: 0,
    avgLatencyMs: 0,
    maxLatencyMs: 0,
    minLatencyMs: Infinity,
    successCount: 0,
    failureCount: 0,
    consecutiveFailures: 0,
    t5ModelLoaded: false,
    embeddingsModelLoaded: false,
    sessionStartAt: Date.now(),
  };
  
  try {
    const database = await getDB();
    const transaction = database.transaction([STATS_STORE, EVENTS_STORE], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STATS_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(EVENTS_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
    ]);
    
    devLog('[AI Monitor] Stats and events cleared');
  } catch (error) {
    console.warn('[AI Monitor] Failed to clear stats:', error);
  }
}

/**
 * Initialize diagnostics API (window.__aiDiagnostics)
 */
export function initializeDiagnostics(): void {
  if (typeof window === 'undefined') return;
  
  (window as any).__aiDiagnostics = {
    getStats: () => getStats(),
    getSuccessRate: () => getSuccessRate(),
    getRecentEvents: (limit?: number) => getRecentEvents(limit),
    clearStats: () => clearStats(),
    enableDebugMode: () => {
      localStorage.setItem('whonow_ai_debug_mode', 'true');
      devLog('[AI Monitor] Debug mode enabled');
    },
    disableDebugMode: () => {
      localStorage.removeItem('whonow_ai_debug_mode');
      devLog('[AI Monitor] Debug mode disabled');
    },
    printStats: () => {
      const s = getStats();
      console.table({
        'Total Queries': s.totalQueries,
        'AI Enhanced': s.aiEnhancedQueries,
        'Fallback': s.fallbackQueries,
        'Success Rate': `${((s.successCount / s.totalQueries) * 100).toFixed(1)}%`,
        'Avg Latency': `${s.avgLatencyMs.toFixed(0)}ms`,
        'Max Latency': `${s.maxLatencyMs}ms`,
        'Consecutive Failures': s.consecutiveFailures,
        'T5 Model Loaded': s.t5ModelLoaded ? 'Yes' : 'No',
        'Embeddings Loaded': s.embeddingsModelLoaded ? 'Yes' : 'No',
      });
    },
  };
  
  devLog('[AI Monitor] Diagnostics API initialized: window.__aiDiagnostics');
  devLog('Available commands:');
  devLog('  __aiDiagnostics.getStats()');
  devLog('  __aiDiagnostics.printStats()');
  devLog('  __aiDiagnostics.getRecentEvents()');
  devLog('  __aiDiagnostics.clearStats()');
  devLog('  __aiDiagnostics.enableDebugMode()');
}

// Initialize on module load
if (typeof window !== 'undefined') {
  loadStats().then(() => {
    initializeDiagnostics();
  });
}
