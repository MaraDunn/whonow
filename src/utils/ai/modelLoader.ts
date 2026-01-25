/**
 * Platform-Aware Model Loader
 * Handles loading AI models from different sources based on platform and user preferences
 * 
 * NOTE: Classical NLP (query parsing) does NOT use this module - it requires no models.
 * This module is only used for optional Semantic Ranking (embeddings model, 80MB).
 * 
 * - Tauri Desktop: Load from bundled resources (instant, offline)
 * - Browser/PWA: Download from Supabase Storage (user opt-in required)
 */

import { detectPlatform } from "../platformDetection";
import { getAIConfig, isQueryParsingEnabled, isSemanticRankingEnabled } from "./aiConfig";

export interface ModelLoadProgress {
  modelName: string;
  fileName: string;
  status: 'downloading' | 'loading' | 'done' | 'error';
  progress: number; // 0-100
  bytesLoaded?: number;
  bytesTotal?: number;
}

export interface ModelLoadResult {
  success: boolean;
  modelPath?: string;
  error?: string;
  loadTimeMs: number;
}

type ProgressCallback = (progress: ModelLoadProgress) => void;

/**
 * Get model URL based on platform and configuration
 */
export function getModelUrl(modelName: string): string | null {
  const platform = detectPlatform();
  const config = getAIConfig();
  
  // Tauri: Use bundled resources
  if (platform === 'desktop') {
    // Map model name to bundled path
    if (modelName.includes('LaMini-Flan-T5-77M')) {
      return 'models/LaMini-Flan-T5-77M';
    } else if (modelName.includes('all-MiniLM-L6-v2')) {
      return 'models/all-MiniLM-L6-v2';
    }
    return null;
  }
  
  // Browser: Check user preferences and Supabase Storage URL
  const { modelStorageUrl } = config.models;
  if (!modelStorageUrl) {
    console.warn('[Model Loader] Model storage URL not configured (VITE_MODEL_STORAGE_URL)');
    return null;
  }
  
  // Check if user has enabled this model
  const isT5 = modelName.includes('LaMini-Flan-T5-77M');
  const isEmbedding = modelName.includes('all-MiniLM-L6-v2');
  
  // NOTE: T5 model is no longer used - Classical NLP is used instead for query parsing
  // This code path should never be reached, but kept for backwards compatibility
  if (isT5) {
    console.warn('[Model Loader] T5 model requested but Classical NLP is used instead (no models needed)');
    return null; // Classical NLP doesn't need models
  }
  
  if (isEmbedding && !isSemanticRankingEnabled()) {
    return null; // User hasn't opted in
  }
  
  // Construct Supabase Storage URL for embeddings
  if (isEmbedding) {
    return `${modelStorageUrl}/all-MiniLM-L6-v2`;
  }
  
  return null;
}

/**
 * Check if models need to be downloaded (browser only)
 */
export function needsDownload(modelName: string): boolean {
  const platform = detectPlatform();
  
  // Tauri models are bundled, never need download
  if (platform === 'desktop') {
    return false;
  }
  
  // Check if model is cached in browser
  // Transformers.js uses its own caching via IndexedDB/Cache API
  // We rely on its internal caching mechanism
  return true; // Let transformers.js handle cache check
}

/**
 * Estimate model download size
 */
export function getModelSize(modelName: string): { sizeMB: number; description: string } {
  if (modelName.includes('LaMini-Flan-T5-77M')) {
    return {
      sizeMB: 30,
      description: 'T5 model for natural language query understanding',
    };
  } else if (modelName.includes('all-MiniLM-L6-v2')) {
    return {
      sizeMB: 80,
      description: 'Embedding model for semantic similarity ranking',
    };
  }
  
  return {
    sizeMB: 0,
    description: 'Unknown model',
  };
}

/**
 * Load model with platform-specific handling
 */
export async function loadModel(
  modelName: string,
  onProgress?: ProgressCallback
): Promise<ModelLoadResult> {
  const startTime = Date.now();
  
  try {
    const platform = detectPlatform();
    const modelUrl = getModelUrl(modelName);
    
    if (!modelUrl) {
      return {
        success: false,
        error: 'Model not available (user opt-in required or storage URL not configured)',
        loadTimeMs: Date.now() - startTime,
      };
    }
    
    if (platform === 'desktop') {
      // Tauri: Load from bundled resources
      return await loadFromTauriBundle(modelName, modelUrl, onProgress);
    } else {
      // Browser: Download from Supabase Storage
      return await loadFromStorage(modelName, modelUrl, onProgress);
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
      loadTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Load model from Tauri bundled resources
 */
async function loadFromTauriBundle(
  modelName: string,
  modelPath: string,
  onProgress?: ProgressCallback
): Promise<ModelLoadResult> {
  const startTime = Date.now();
  
  try {
    // Import Tauri API
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    
    // Convert resource path to webview-accessible URL
    const resourceUrl = convertFileSrc(modelPath);
    
    // Notify progress
    onProgress?.({
      modelName,
      fileName: 'bundle',
      status: 'loading',
      progress: 50,
    });
    
    // Return the URL - transformers.js will handle actual loading
    onProgress?.({
      modelName,
      fileName: 'bundle',
      status: 'done',
      progress: 100,
    });
    
    return {
      success: true,
      modelPath: resourceUrl,
      loadTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Tauri bundle load failed: ${error.message}`,
      loadTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Load model from Supabase Storage (browser)
 */
async function loadFromStorage(
  modelName: string,
  storageUrl: string,
  onProgress?: ProgressCallback
): Promise<ModelLoadResult> {
  const startTime = Date.now();
  
  try {
    // The URL points to Supabase Storage
    // Transformers.js will handle downloading and caching
    // We just need to configure the URL properly
    
    onProgress?.({
      modelName,
      fileName: 'config',
      status: 'downloading',
      progress: 0,
    });
    
    // Verify storage URL is accessible
    try {
      const response = await fetch(`${storageUrl}/config.json`, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(`Storage URL not accessible: ${response.status}`);
      }
    } catch (error: any) {
      throw new Error(`Cannot access model storage: ${error.message}`);
    }
    
    onProgress?.({
      modelName,
      fileName: 'config',
      status: 'done',
      progress: 100,
    });
    
    return {
      success: true,
      modelPath: storageUrl,
      loadTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Storage load failed: ${error.message}`,
      loadTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Preload models in background (non-blocking)
 */
export async function preloadModels(onProgress?: ProgressCallback): Promise<void> {
  const config = getAIConfig();
  const modelsToLoad: string[] = [];
  
  // NOTE: Query parsing uses Classical NLP (no models needed)
  // Only preload embeddings model if enabled
  if (isSemanticRankingEnabled()) {
    modelsToLoad.push(config.models.embeddingModel);
  }
  
  for (const modelName of modelsToLoad) {
    await loadModel(modelName, onProgress);
  }
}

/**
 * Check if models are ready to use
 */
export async function areModelsReady(): Promise<{
  t5Ready: boolean;
  embeddingsReady: boolean;
}> {
  const platform = detectPlatform();
  
  // Tauri: Models are always ready (bundled)
  if (platform === 'desktop') {
    return {
      t5Ready: true,
      embeddingsReady: true,
    };
  }
  
  // Browser: Check if user has enabled and models are cached
  return {
    t5Ready: isQueryParsingEnabled(),
    embeddingsReady: isSemanticRankingEnabled(),
  };
}

/**
 * Clear model cache (browser only)
 */
export async function clearModelCache(): Promise<void> {
  const platform = detectPlatform();
  
  if (platform === 'desktop') {
    // Can't clear bundled models
    return;
  }
  
  try {
    // Clear transformers.js cache
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      const transformersCaches = cacheNames.filter(name => 
        name.includes('transformers') || name.includes('huggingface')
      );
      
      await Promise.all(transformersCaches.map(name => caches.delete(name)));
      console.log('[Model Loader] Cleared model cache:', transformersCaches);
    }
    
    // Clear IndexedDB cache if exists
    if (typeof indexedDB !== 'undefined') {
      const databases = await indexedDB.databases();
      const transformersDBs = databases.filter(db => 
        db.name && (db.name.includes('transformers') || db.name.includes('hf'))
      );
      
      for (const db of transformersDBs) {
        if (db.name) {
          await new Promise((resolve, reject) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = () => resolve(undefined);
            req.onerror = () => reject(req.error);
          });
        }
      }
      
      console.log('[Model Loader] Cleared IndexedDB:', transformersDBs.map(d => d.name));
    }
  } catch (error) {
    console.warn('[Model Loader] Failed to clear cache:', error);
    throw error;
  }
}
