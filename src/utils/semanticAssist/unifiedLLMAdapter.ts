/**
 * Unified LLM Query Parser Adapter
 * Works across all platforms (desktop, browser, mobile, PWA)
 * Uses @xenova/transformers with small text-generation models
 */

import { SearchQuery } from "@/types/searchQuery";
import { getLLMConfig, isLLMParsingEnabled } from "@/utils/llmConfig";
import { detectPlatform } from "@/utils/platformDetection";
import {
  getCachedParsedQuery,
  cacheParsedQuery,
  isModelLoadFailed,
  markModelLoadFailed,
  storeLastError,
  clearModelLoadFailure,
} from "./modelCache";

let llmModel: any = null;
let modelLoading: Promise<any> | null = null;
let modelLoadFailed = false; // Track if model loading has permanently failed (in-memory cache)
let forceRetry = false; // Allow forcing a retry even with failure state
let fetchInterceptorSetup = false; // Track if fetch interceptor has been set up

// Set up interceptor at module load time (before transformers.js imports)
// This ensures it's active as early as possible
if (typeof window !== "undefined" && !fetchInterceptorSetup) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const proxyUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/llm-proxy` : undefined;
  if (proxyUrl) {
    // Store original fetch BEFORE any code can cache it
    // Use bind to ensure we always get the original, even if fetch is reassigned
    const originalFetch = (function() {
      const orig = window.fetch;
      return function(...args: any[]) {
        return orig.apply(window, args);
      };
    })();
    
    // Store reference to original for verification
    (window as any).__originalFetch = originalFetch;
    
    // Also intercept XMLHttpRequest in case transformers.js uses it
    if (typeof XMLHttpRequest !== "undefined") {
      const OriginalXHR = window.XMLHttpRequest;
      window.XMLHttpRequest = function(this: XMLHttpRequest) {
        const xhr = new OriginalXHR();
        const originalOpen = xhr.open.bind(xhr);
        const originalSend = xhr.send.bind(xhr);
        
        xhr.open = function(method: string, url: string | URL, ...args: any[]) {
          const urlStr = typeof url === "string" ? url : url.href;
          if (urlStr.includes('huggingface.co')) {
            console.log(`[LLM] 🔍 XMLHttpRequest to Hugging Face: ${urlStr}`);
            const hfMatch = urlStr.match(/https?:\/\/[^/]*huggingface\.co\/(?:api\/models\/)?([^/]+\/[^/]+)\/resolve\/(?:main|quantized)\/(.+)$/);
            if (hfMatch) {
              const [, modelName, fileName] = hfMatch;
              const proxyUrlWithParams = `${proxyUrl}?model=${encodeURIComponent(modelName)}&file=${encodeURIComponent(fileName)}`;
              console.log(`[LLM] ✓ XMLHttpRequest routing through proxy: ${modelName}/${fileName}`);
              return originalOpen(method, proxyUrlWithParams, ...args);
            }
          }
          return originalOpen(method, url, ...args);
        };
        
        return xhr;
      } as any;
      console.log(`[LLM] ✓ XMLHttpRequest interceptor set up`);
    }
    
    // Set up fetch interceptor
    window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      
      // Log ALL Hugging Face requests (not just model files)
      if (url.includes('huggingface.co') || url.includes('llm-proxy')) {
        console.log(`[LLM] 🔍 FETCH CALL: ${url}`);
        // Log a short stack trace to see where the fetch is coming from
        const stack = new Error().stack;
        if (stack) {
          const stackLines = stack.split('\n').slice(1, 5).filter(line => 
            !line.includes('unifiedLLMAdapter') && 
            !line.includes('at fetch')
          );
          if (stackLines.length > 0) {
            console.log(`[LLM] Caller: ${stackLines[0].trim()}`);
          }
        }
      }
      
      if (url.includes('huggingface.co')) {
        console.log(`[LLM] 🔍 EARLY INTERCEPTOR: Fetch to Hugging Face: ${url}`);
        const hfMatch = url.match(/https?:\/\/[^/]*huggingface\.co\/(?:api\/models\/)?([^/]+\/[^/]+)\/resolve\/(?:main|quantized)\/(.+)$/);
        if (hfMatch) {
          const [, modelName, fileName] = hfMatch;
          const proxyUrlWithParams = `${proxyUrl}?model=${encodeURIComponent(modelName)}&file=${encodeURIComponent(fileName)}`;
          console.log(`[LLM] ✓ EARLY INTERCEPTOR: Routing through proxy: ${modelName}/${fileName}`);
          console.log(`[LLM] Proxy URL: ${proxyUrlWithParams}`);
          try {
            const response = await originalFetch(proxyUrlWithParams, init);
            console.log(`[LLM] Proxy response status: ${response.status} for ${fileName}`);
            return response;
          } catch (error) {
            console.error(`[LLM] ✗ Proxy fetch failed for ${fileName}:`, error);
            throw error;
          }
        } else {
          console.warn(`[LLM] ⚠ Hugging Face URL not matched by interceptor pattern: ${url}`);
        }
      }
      return originalFetch(input, init);
    };
    fetchInterceptorSetup = true;
    console.log(`[LLM] ✓ EARLY interceptor set up at module load: ${proxyUrl}`);
  }
}

/**
 * Set up fetch interceptor for Hugging Face model requests
 * This must be called before transformers.js starts loading models
 */
function setupFetchInterceptor(proxyUrl: string): void {
  if (fetchInterceptorSetup || typeof window === "undefined") {
    return; // Already set up or not in browser
  }
  
  const originalFetch = window.fetch;
  let fetchInterceptorActive = true;
  let requestCount = 0;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requestCount++;
    
    // Log ALL requests for debugging (not just Hugging Face) - increased limit
    if (requestCount <= 50) { // Log first 50 requests to see what's happening
      console.log(`[LLM] Fetch #${requestCount}: ${url.substring(0, 150)}${url.length > 150 ? '...' : ''}`);
    }
    
    // Log ALL Hugging Face requests for debugging (always log these)
    if (url.includes('huggingface.co')) {
      console.log(`[LLM] 🔍 Fetch #${requestCount} to Hugging Face: ${url}`);
      console.trace(`[LLM] Stack trace for Hugging Face request:`); // Show where the request came from
    }
    
    // Check if this is a Hugging Face model file request
    // Pattern 1: Direct CDN URL: https://huggingface.co/model/repo/resolve/main/file
    // Pattern 2: Hub API: https://huggingface.co/api/models/model/repo/resolve/main/file
    // Pattern 3: CDN with quantized: .../resolve/quantized/file
    // Pattern 4: Also try blob URLs that might be used by transformers.js
    const hfMatch = url.match(/https?:\/\/[^/]*huggingface\.co\/(?:api\/models\/)?([^/]+\/[^/]+)\/resolve\/(?:main|quantized)\/(.+)$/);
    
    if (fetchInterceptorActive && hfMatch && proxyUrl) {
      const [, modelName, fileName] = hfMatch;
      const proxyUrlWithParams = `${proxyUrl}?model=${encodeURIComponent(modelName)}&file=${encodeURIComponent(fileName)}`;
      console.log(`[LLM] ✓ Routing through proxy: ${modelName}/${fileName}`);
      console.log(`[LLM] Original URL: ${url}`);
      console.log(`[LLM] Proxy URL: ${proxyUrlWithParams}`);
      
      // Use proxy URL instead
      try {
        const response = await originalFetch(proxyUrlWithParams, init);
        console.log(`[LLM] Proxy response status: ${response.status} for ${fileName}`);
        
        // Check if response is HTML (error page) instead of expected content
        if (!response.ok) {
          const text = await response.clone().text();
          if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
            console.error(`[LLM] ✗ Proxy returned HTML error page for ${fileName}:`, text.substring(0, 200));
          }
        } else {
          console.log(`[LLM] ✓ Proxy successfully fetched ${fileName}`);
        }
        
        return response;
      } catch (error) {
        console.error(`[LLM] ✗ Proxy fetch failed for ${fileName}:`, error);
        throw error;
      }
    }
    
    // Log non-intercepted Hugging Face requests for debugging
    if (url.includes('huggingface.co') && fetchInterceptorActive) {
      console.warn(`[LLM] ⚠ Hugging Face URL not intercepted (pattern mismatch): ${url}`);
      console.warn(`[LLM] Regex tried: /https?:\\/\\/[^/]*huggingface\\.co\\/(?:api\\/models\\/)?([^/]+\\/[^/]+)\\/resolve\\/(?:main|quantized)\\/(.+)$/`);
    }
    
    // For all other requests, use original fetch
    return originalFetch(input, init);
  };
  
  fetchInterceptorSetup = true;
  console.log(`[LLM] ✓ Fetch interceptor set up with proxy: ${proxyUrl}`);
  console.log(`[LLM] Interceptor will log all Hugging Face requests`);
  
  // Test the interceptor immediately with a real fetch call
  setTimeout(async () => {
    try {
      console.log(`[LLM] Testing interceptor with actual fetch call...`);
      const testUrl = "https://huggingface.co/Xenova/LaMini-Flan-T5-77M/resolve/main/config.json";
      const testResponse = await window.fetch(testUrl);
      console.log(`[LLM] Test fetch completed with status: ${testResponse.status}`);
    } catch (error) {
      console.log(`[LLM] Test fetch error (expected if proxy not working):`, error);
    }
  }, 100);
  
  // Verify interceptor is still active after a short delay
  setTimeout(() => {
    if (window.fetch === originalFetch) {
      console.error(`[LLM] ✗ WARNING: Fetch interceptor was overridden!`);
    } else {
      console.log(`[LLM] ✓ Fetch interceptor still active`);
    }
  }, 1000);
  
  // Clean up interceptor after model loading (optional, but good practice)
  setTimeout(() => {
    fetchInterceptorActive = false;
    console.log(`[LLM] Fetch interceptor deactivated after timeout`);
  }, 60000); // Disable after 60 seconds
}

/**
 * Get the currently loaded LLM model instance (if available)
 * Allows other modules to reuse the same model instance
 */
export function getLoadedModel(): any {
  return llmModel;
}

/**
 * Check if model is currently loading
 */
export function isModelLoading(): boolean {
  return modelLoading !== null;
}

/**
 * Ensure the model is loaded (trigger loading if not already loaded)
 * Returns the model instance or null if loading fails
 */
export async function ensureModelLoaded(): Promise<any> {
  return await loadLLMModel();
}

/**
 * List of alternative models to try if primary fails
 * Ordered by preference (smallest/fastest first)
 */
const FALLBACK_MODELS = [
  "Xenova/LaMini-Flan-T5-77M", // Smallest, ~30MB
  "Xenova/flan-t5-small", // Instruction-tuned, ~150MB
  "Xenova/t5-base", // Larger but more capable, ~450MB
];

/**
 * Check if error indicates model repository is inaccessible
 */
function isModelInaccessibleError(error: any): boolean {
  const message = error?.message || "";
  return (
    message.includes("Unexpected token") ||
    message.includes("<!doctype") ||
    message.includes("404") ||
    message.includes("not found") ||
    message.includes("CORS") ||
    message.includes("NetworkError")
  );
}

/**
 * Categorize error type for better diagnostics
 */
function categorizeError(error: any): {
  type: string;
  message: string;
  details?: any;
} {
  const errorMessage = error?.message || String(error) || "Unknown error";
  let errorType = "unknown";
  
  if (errorMessage.includes("CORS") || errorMessage.includes("cors") || errorMessage.includes("Cross-Origin")) {
    errorType = "cors";
  } else if (
    errorMessage.includes("network") || 
    errorMessage.includes("fetch") || 
    errorMessage.includes("NetworkError") ||
    errorMessage.includes("Failed to fetch")
  ) {
    errorType = "network";
  } else if (
    errorMessage.includes("WASM") || 
    errorMessage.includes("WebAssembly") ||
    errorMessage.includes("wasm")
  ) {
    errorType = "wasm";
  } else if (
    errorMessage.includes("404") || 
    errorMessage.includes("not found") ||
    errorMessage.includes("Not Found")
  ) {
    errorType = "model_not_found";
  } else if (
    errorMessage.includes("timeout") || 
    errorMessage.includes("Timeout") ||
    errorMessage.includes("aborted")
  ) {
    errorType = "timeout";
  } else if (
    errorMessage.includes("Unexpected token") ||
    errorMessage.includes("<!doctype") ||
    errorMessage.includes("is not valid JSON")
  ) {
    errorType = "invalid_response"; // HTML response instead of JSON/model files
  } else if (
    errorMessage.includes("Unexpected token") ||
    errorMessage.includes("<!doctype") ||
    errorMessage.includes("JSON")
  ) {
    errorType = "invalid_response";
  }
  
  return {
    type: errorType,
    message: errorMessage,
    details: {
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    },
  };
}

/**
 * Load LLM model (lazy load on first use)
 * Tries multiple models with fallback logic
 */
/**
 * Force retry of model loading (clears failure state and allows retry)
 */
export async function forceModelRetry(): Promise<void> {
  forceRetry = true;
  modelLoadFailed = false;
  llmModel = null;
  modelLoading = null;
  await clearModelLoadFailure();
  console.log("[LLM] ✓ Force retry enabled. Model will attempt to load on next search.");
}

/**
 * Reset all in-memory failure states (for testing/retry)
 * This clears the session-level failure flag so model loading can be retried
 */
export function resetInMemoryFailureState(): void {
  const wasBlocked = modelLoadFailed;
  modelLoadFailed = false;
  forceRetry = true;
  if (wasBlocked) {
    console.log("[LLM] ✓ In-memory failure state reset. Model will retry on next search.");
  }
}

async function loadLLMModel(): Promise<any> {
  if (llmModel) return llmModel;
  
  // Check persistent failure state (IndexedDB) - but allow force retry
  const persistentFailure = await isModelLoadFailed();
  if (persistentFailure && !forceRetry) {
    console.log("[LLM] Model loading previously failed (persistent), skipping retry");
    console.log("[LLM] 💡 To retry LLM loading, run in console:");
    console.log("[LLM]    await llmDiagnostics.clearAllFailureStates()");
    console.log("[LLM]    Or: await llmDiagnostics.forceModelRetry()");
    console.log("[LLM]    Then try a search query to trigger model loading");
    modelLoadFailed = true;
    return null;
  }
  
  // Check session-level failure (but allow force retry)
  if (modelLoadFailed && !forceRetry) {
    console.log("[LLM] Model loading previously failed (session), skipping retry");
    console.log("[LLM] 💡 To retry, run: await llmDiagnostics.clearAllFailureStates()");
    return null;
  }
  
  // If force retry was used, log it
  if (forceRetry) {
    console.log("[LLM] Force retry enabled - attempting model load despite previous failure");
  }
  
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    try {
      const config = getLLMConfig();
      
      // Set up fetch interceptor BEFORE importing transformers
      // This ensures the interceptor is active when transformers.js makes requests
      const platform = detectPlatform();
      const isTauri = platform === "desktop" && (window as any).__TAURI__;
      if (config.proxyUrl && !isTauri && typeof window !== "undefined") {
        setupFetchInterceptor(config.proxyUrl);
        console.log(`[LLM] Proxy enabled (before transformers import): ${config.proxyUrl}`);
        
        // Test the interceptor with a REAL fetch to verify it's working
        try {
          const testUrl = "https://huggingface.co/Xenova/LaMini-Flan-T5-77M/resolve/main/config.json";
          console.log(`[LLM] Testing interceptor with REAL fetch: ${testUrl}`);
          // Actually fetch to see if interceptor catches it
          window.fetch(testUrl).then(response => {
            console.log(`[LLM] Test fetch completed - status: ${response.status}, intercepted: ${response.url.includes('llm-proxy')}`);
          }).catch(error => {
            console.log(`[LLM] Test fetch error (expected):`, error);
          });
        } catch (error) {
          console.error(`[LLM] Error testing interceptor:`, error);
        }
      }
      
      // Import transformers - use dynamic import to avoid issues
      // NOTE: We intercept fetch BEFORE this import so transformers.js uses our intercepted fetch
      const transformersModule = await import("@xenova/transformers");
      
      // After import, verify interceptor is still active and FORCE transformers.js to use it
      if (config.proxyUrl && !isTauri && typeof window !== "undefined") {
        // Verify interceptor is still active
        const testUrl = "https://huggingface.co/Xenova/LaMini-Flan-T5-77M/resolve/main/test.json";
        const isIntercepted = window.fetch.toString().includes('huggingface.co') || 
                             window.fetch.toString().includes('llm-proxy') ||
                             window.fetch !== (window as any).__originalFetch;
        console.log(`[LLM] Interceptor verification: ${isIntercepted ? 'ACTIVE' : 'INACTIVE'}`);
        console.log(`[LLM] window.fetch type: ${typeof window.fetch}`);
        
        // Try to force transformers.js to use our intercepted fetch
        // Some versions of transformers.js might cache fetch, so we need to ensure it uses ours
        if (transformersModule.env) {
          // Store our intercepted fetch in multiple places transformers.js might check
          (transformersModule.env as any).__customFetch = window.fetch;
          (transformersModule.env as any).customFetch = window.fetch;
          (transformersModule.env as any).fetch = window.fetch;
          console.log(`[LLM] Stored intercepted fetch in transformers.env (multiple properties)`);
        }
        
        // Also try to override any internal fetch transformers.js might have cached
        if ((transformersModule as any).env && (transformersModule as any).env.fetch) {
          (transformersModule as any).env.fetch = window.fetch;
          console.log(`[LLM] Overrode transformers.env.fetch`);
        }
        
        // Check if transformers.js is using Web Workers
        const isWebWorker = (transformersModule.env as any)?.IS_WEBWORKER_ENV || 
                           typeof Worker !== 'undefined' && (window as any).__transformers_worker;
        if (isWebWorker) {
          console.warn(`[LLM] ⚠️ Transformers.js may be using Web Workers - interceptor may not work!`);
          console.warn(`[LLM] Web Workers have their own fetch context that we cannot intercept`);
        }
      }
      const { pipeline } = transformersModule;
      
      // Set model cache location and WASM configuration
      if (transformersModule.env) {
        // Use browser's Cache API for model storage
        transformersModule.env.allowRemoteModels = true;
        // Disable browser cache temporarily to force fetch requests (so interceptor works)
        // We can re-enable caching after confirming interceptor works
        transformersModule.env.useBrowserCache = false;
        console.log(`[LLM] Browser cache disabled to ensure fetch interceptor is used`);
        
        // Clear any existing cache to force fresh requests
        if (typeof caches !== "undefined") {
          try {
            const cacheNames = await caches.keys();
            const modelCaches = cacheNames.filter(name => name.includes('transformers') || name.includes('huggingface'));
            await Promise.all(modelCaches.map(name => caches.delete(name)));
            console.log(`[LLM] Cleared ${modelCaches.length} model cache(s)`);
          } catch (error) {
            console.log(`[LLM] Could not clear caches:`, error);
          }
        }
        
        // Also try to clear IndexedDB if transformers.js uses it
        if (typeof indexedDB !== "undefined") {
          try {
            // Try to delete transformers-related IndexedDB databases
            const databases = await indexedDB.databases();
            console.log(`[LLM] Found ${databases.length} IndexedDB databases:`, databases.map(d => d.name));
            const transformersDBs = databases.filter(db => 
              db.name && (db.name.includes('transformers') || db.name.includes('huggingface') || db.name.includes('hf'))
            );
            console.log(`[LLM] Found ${transformersDBs.length} transformers-related IndexedDB databases`);
            for (const db of transformersDBs) {
              const deleteReq = indexedDB.deleteDatabase(db.name!);
              await new Promise((resolve, reject) => {
                deleteReq.onsuccess = () => resolve(undefined);
                deleteReq.onerror = () => reject(deleteReq.error);
              });
              console.log(`[LLM] Deleted IndexedDB: ${db.name}`);
            }
            
            // Also try to clear any cache storage transformers.js might use
            if (typeof caches !== "undefined") {
              const allCaches = await caches.keys();
              console.log(`[LLM] All cache names:`, allCaches);
            }
          } catch (error) {
            console.log(`[LLM] Could not clear IndexedDB:`, error);
          }
        }
        
        // Check if transformers.js is using Web Workers (which have their own fetch context)
        if ((transformersModule.env as any).IS_WEBWORKER_ENV) {
          console.warn(`[LLM] ⚠️ Transformers.js is using Web Workers - interceptor may not work!`);
        } else {
          console.log(`[LLM] Transformers.js is NOT using Web Workers - interceptor should work`);
        }
        
        // Try to configure transformers.js to use our intercepted fetch
        // Some versions of transformers.js support custom fetch via env
        try {
          if (typeof (transformersModule.env as any).customFetch === 'undefined') {
            // Store our intercepted fetch
            (transformersModule.env as any).__customFetch = window.fetch;
            console.log(`[LLM] Stored intercepted fetch in transformers.env`);
          }
        } catch (e) {
          console.log(`[LLM] Could not set custom fetch (may not be supported):`, e);
        }
        
        // Configure proxy for browser environments (bypass CORS)
        const platform = detectPlatform();
        const isTauri = platform === "desktop" && (window as any).__TAURI__;
        
        // Set up fetch interceptor BEFORE importing/loading models
        if (config.proxyUrl && !isTauri && typeof window !== "undefined") {
          setupFetchInterceptor(config.proxyUrl);
          console.log(`[LLM] Proxy enabled: ${config.proxyUrl}`);
        } else if (isTauri) {
          // For Tauri, configure to load from local bundle
          console.log("[LLM] Tauri detected - configuring for bundled model loading");
          
          // Intercept fetch to route model requests to bundled resources
          const originalFetch = window.fetch;
          let tauriInterceptorActive = true;
          
          window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            
            // Check if this is a Hugging Face model file request
            const hfMatch = url.match(/https?:\/\/[^/]*huggingface\.co\/([^/]+\/[^/]+)\/resolve\/(?:main|quantized)\/(.+)$/);
            
            if (tauriInterceptorActive && hfMatch) {
              const [, modelName, fileName] = hfMatch;
              
              // Only intercept requests for the primary model (bundled model)
              if (modelName === "Xenova/LaMini-Flan-T5-77M") {
                try {
                  // Use Tauri's resource URL scheme
                  // Models are in src-tauri/models/ directory, accessible via resource:// protocol
                  // Tauri v2 uses @tauri-apps/api/core for convertFileSrc
                  const tauriApi = await import("@tauri-apps/api/core");
                  const resourcePath = `models/LaMini-Flan-T5-77M/${fileName}`;
                  
                  // convertFileSrc converts a file path to a URL that can be loaded in the webview
                  const localUrl = tauriApi.convertFileSrc(resourcePath);
                  
                  console.log(`[LLM] Loading from bundle: ${resourcePath} -> ${localUrl}`);
                  return originalFetch(localUrl, init);
                } catch (error) {
                  console.warn(`[LLM] Failed to load from bundle (${fileName}), falling back to proxy/CDN:`, error);
                  // Fall back to proxy or CDN
                  if (config.proxyUrl) {
                    const proxyUrl = `${config.proxyUrl}?model=${encodeURIComponent(modelName)}&file=${encodeURIComponent(fileName)}`;
                    console.log(`[LLM] Using proxy fallback: ${fileName}`);
                    return originalFetch(proxyUrl, init);
                  }
                }
              } else {
                // For fallback models, use proxy if available
                if (config.proxyUrl) {
                  const proxyUrl = `${config.proxyUrl}?model=${encodeURIComponent(modelName)}&file=${encodeURIComponent(fileName)}`;
                  console.log(`[LLM] Loading fallback model via proxy: ${modelName}/${fileName}`);
                  return originalFetch(proxyUrl, init);
                }
              }
            }
            
            // For all other requests, use original fetch
            return originalFetch(input, init);
          };
          
          // Clean up interceptor after model loading
          setTimeout(() => {
            tauriInterceptorActive = false;
          }, 60000);
        }
        
        // Configure WASM backend with better error handling
        if (transformersModule.env) {
          if (!transformersModule.env.backends) {
            (transformersModule.env as any).backends = {};
          }
          if (!(transformersModule.env.backends as any).onnx) {
            (transformersModule.env.backends as any).onnx = {};
          }
          if (!(transformersModule.env.backends as any).onnx?.wasm) {
            ((transformersModule.env.backends as any).onnx as any).wasm = {};
          }
        }
        
        // Set WASM paths - use CDN defaults but allow override
        // The transformers library will use jsDelivr CDN by default
        // This ensures WASM files are loaded from a reliable source
        if (typeof window !== "undefined") {
          // In browser environment, use CDN for WASM files
          // The library handles this automatically, but we can configure it explicitly
          const wasmPath = (transformersModule.env.backends as any)?.onnx?.wasm?.wasmPaths;
          if (!wasmPath) {
            // Use jsDelivr CDN for WASM files (default, but make it explicit)
            console.log("[LLM] Using default WASM paths from CDN");
          }
        }
        
        // Enable local model caching for faster subsequent loads
        transformersModule.env.cacheDir = "./models";
      }

      console.log(`[LLM] Loading model: ${config.modelName}`);
      if ((transformersModule as any).version) {
        console.log(`[LLM] Transformers version:`, (transformersModule as any).version);
      }
      
      // List of models to try (primary + fallbacks, avoiding duplicates)
      const modelsToTry = [
        config.modelName,
        ...FALLBACK_MODELS.filter(m => m !== config.modelName)
      ];
      
      // Try loading models with retry logic
      for (const modelName of modelsToTry) {
        console.log(`[LLM] Attempting to load: ${modelName}`);
        
        // Try quantized first (smaller, faster) with timeout
        const loadWithTimeout = async (quantized: boolean, retryCount = 0): Promise<any> => {
          const maxRetries = 1; // One retry per model variant
          const timeoutMs = 30000; // 30 second timeout per attempt
          
          try {
            // Log that we're about to call pipeline
            console.log(`[LLM] Calling pipeline() for ${modelName} (${quantized ? "quantized" : "full"})`);
            console.log(`[LLM] Current window.fetch:`, window.fetch.toString().substring(0, 100));
            
            const loadPromise = pipeline(
              "text2text-generation",
              modelName,
              {
                quantized,
                // Add progress callback for better UX
                progress_callback: (progress: any) => {
                  console.log(`[LLM] Pipeline progress:`, JSON.stringify(progress, null, 2));
                  
                  // Log ALL file-related progress, not just "loading"
                  if (progress?.file) {
                    console.log(`[LLM] 📁 File: ${progress.file}, Status: ${progress.status}, Model: ${progress.name || modelName}`);
                    
                    // Check if this file URL would be intercepted
                    const testUrl = `https://huggingface.co/${progress.name || modelName}/resolve/main/${progress.file}`;
                    const hfMatch = testUrl.match(/https?:\/\/[^/]*huggingface\.co\/(?:api\/models\/)?([^/]+\/[^/]+)\/resolve\/(?:main|quantized)\/(.+)$/);
                    if (hfMatch) {
                      console.log(`[LLM] ✓ File ${progress.file} would be intercepted by pattern`);
                      console.log(`[LLM] Expected URL: ${testUrl}`);
                      
                      // Check if we've seen a fetch call for this file
                      // This helps us understand if transformers.js is using fetch or another mechanism
                      console.log(`[LLM] 🔍 Checking if fetch was called for this file...`);
                    } else {
                      console.warn(`[LLM] ⚠ File ${progress.file} would NOT be intercepted - pattern mismatch`);
                      console.warn(`[LLM] Test URL: ${testUrl}`);
                    }
                    
                    // If status is "done" but we haven't seen a fetch call, transformers.js might be using cache
                    if (progress.status === "done") {
                      console.log(`[LLM] ⚠ File ${progress.file} marked as "done" - check Network tab to see if request was made`);
                    }
                  }
                  
                  // Log model file loading specifically
                  if (progress?.file && (progress.file.includes('.onnx') || progress.file.includes('model'))) {
                    console.log(`[LLM] 🎯 MODEL FILE: ${progress.file} - Status: ${progress.status}`);
                    console.log(`[LLM] 🎯 This is the main model file - if this doesn't show in Network tab, transformers.js is using cache or a different mechanism`);
                  }
                  
                  if (progress?.status === "loading") {
                    console.log(`[LLM] Loading ${modelName} (${quantized ? "quantized" : "full"}): ${progress?.file || "initializing"}...`);
                  }
                },
              }
            );
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Model loading timeout after ${timeoutMs}ms`)), timeoutMs);
            });
            
            return await Promise.race([loadPromise, timeoutPromise]);
          } catch (error: any) {
            const errorInfo = categorizeError(error);
            
            // Retry on network errors (but not on CORS or 404)
            if (
              retryCount < maxRetries &&
              (errorInfo.type === "network" || errorInfo.type === "timeout") &&
              !isModelInaccessibleError(error)
            ) {
              console.log(`[LLM] Retrying ${modelName} (attempt ${retryCount + 1}/${maxRetries})...`);
              // Wait a bit before retry (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
              return loadWithTimeout(quantized, retryCount + 1);
            }
            
            throw error;
          }
        };
        
        try {
          // Try quantized first
          llmModel = await loadWithTimeout(true);
          console.log(`[LLM] ✓ Successfully loaded quantized model: ${modelName}`);
          if (modelName !== config.modelName) {
            console.log(`[LLM] Note: Using fallback model ${modelName} instead of ${config.modelName}`);
          }
          // Success! Clear any failure states
          modelLoadFailed = false;
          forceRetry = false;
          // Clear IndexedDB failure state on success
          await clearModelLoadFailure().catch(() => {}); // Ignore errors
          return llmModel;
        } catch (quantizedError: any) {
          const errorInfo = categorizeError(quantizedError);
          console.warn(`[LLM] Model ${modelName} failed (quantized, ${errorInfo.type}):`, errorInfo.message);
          
          // Check if this is an accessibility issue (HTML response, 404, etc.)
          if (isModelInaccessibleError(quantizedError)) {
            // Try non-quantized version
            try {
              llmModel = await loadWithTimeout(false);
              console.log(`[LLM] ✓ Successfully loaded non-quantized model: ${modelName}`);
              if (modelName !== config.modelName) {
                console.log(`[LLM] Note: Using fallback model ${modelName} instead of ${config.modelName}`);
              }
              // Success! Clear any failure states
              modelLoadFailed = false;
              forceRetry = false;
              // Clear IndexedDB failure state on success
              await clearModelLoadFailure().catch(() => {}); // Ignore errors
              return llmModel;
            } catch (nonQuantizedError: any) {
              const nonQuantizedErrorInfo = categorizeError(nonQuantizedError);
              console.warn(`[LLM] Model ${modelName} failed (non-quantized, ${nonQuantizedErrorInfo.type}):`, nonQuantizedErrorInfo.message);
              // Continue to next model
              continue;
            }
          } else {
            // Different error (not accessibility), log and continue
            continue;
          }
        }
      }
      
      // All models failed
      // Get the actual last error from the last model attempt
      let lastErrorInfo = { type: "unknown", message: "All model loading attempts failed" };
      try {
        // Try to get error info from the last failed model
        // This is a fallback - the actual errors are logged above
        lastErrorInfo = categorizeError(new Error("All model loading attempts failed"));
      } catch (e) {
        // Ignore
      }
      
      console.error("[LLM] All model loading attempts failed. Disabling LLM parsing.");
      console.error(`[LLM] Error type: ${lastErrorInfo.type}`);
      console.error(`[LLM] Last error: ${lastErrorInfo.message}`);
      
      // Provide specific guidance for common error types
      if (lastErrorInfo.type === "invalid_response" || lastErrorInfo.message.includes("<!doctype")) {
        console.error("[LLM] ⚠️  Received HTML instead of model files. This usually means:");
        console.error("[LLM]   1. CORS issue - Hugging Face CDN is blocking browser requests");
        console.error("[LLM]   2. Model repository access issue");
        console.error("[LLM]   3. Network/firewall blocking requests");
        console.error("[LLM]   💡 Solution: LLM parsing will be disabled. Search will use deterministic parsing.");
        console.error("[LLM]   💡 For desktop users: Consider using Ollama instead (see desktopAdapter.ts)");
      }
      
      // Store error for diagnostics
      await storeLastError({
        errorType: lastErrorInfo.type,
        message: "All model loading attempts failed",
        timestamp: Date.now(),
        details: {
          modelsTried: modelsToTry,
          lastError: lastErrorInfo.message,
        },
      });
      
      modelLoadFailed = true;
      forceRetry = false; // Clear force retry since we failed
      // Persist failure state to IndexedDB to prevent retries across page reloads
      await markModelLoadFailed();
      return null;
    } catch (error: any) {
      const errorInfo = categorizeError(error);
      console.error(`[LLM] Failed to load LLM model (${errorInfo.type}), search will use fallback parsing:`, errorInfo.message);
      
      // Store error for diagnostics
      await storeLastError({
        errorType: errorInfo.type,
        message: errorInfo.message,
        timestamp: Date.now(),
        details: {
          ...errorInfo.details,
          config: {
            modelName: getLLMConfig().modelName,
          },
        },
      });
      
      // Log more details about the error
      if (errorInfo.type === "cors") {
        console.error("[LLM] CORS error detected. This usually means:");
        console.error("  - Browser security restrictions are blocking model downloads");
        console.error("  - Try a different browser or check browser security settings");
        console.error("  - Check if you're running from localhost vs. a different origin");
      } else if (errorInfo.type === "network") {
        console.error("[LLM] Network error detected. This usually means:");
        console.error("  - Internet connection issues");
        console.error("  - Firewall blocking Hugging Face");
        console.error("  - Proxy or VPN interference");
      } else if (errorInfo.type === "wasm") {
        console.error("[LLM] WASM error detected. This usually means:");
        console.error("  - Browser doesn't support WebAssembly");
        console.error("  - WASM files failed to load");
        console.error("  - Try updating your browser");
      } else if (errorInfo.type === "model_not_found") {
        console.error("[LLM] Model not found. This usually means:");
        console.error("  - Model repository doesn't exist or isn't accessible");
        console.error("  - Model files aren't in ONNX format");
        console.error("  - Hugging Face repository structure changed");
      } else if (isModelInaccessibleError(error)) {
        console.error("[LLM] Model repository is not accessible. This usually means:");
        console.error("  1. The model repository doesn't exist or isn't accessible");
        console.error("  2. There's a CORS issue");
        console.error("  3. The model files aren't in ONNX format");
        console.error("  4. Network connectivity issues");
        console.error("  Falling back to deterministic parsing.");
      }
      
      if (error.stack) {
        console.error("[LLM] Error stack:", error.stack);
      }
      
      modelLoadFailed = true;
      forceRetry = false; // Clear force retry since we failed
      // Persist failure state to IndexedDB
      await markModelLoadFailed();
      
      // Don't throw - return null so fallback can work
      return null;
    } finally {
      modelLoading = null;
      // Reset forceRetry after attempt (whether success or failure)
      if (forceRetry) {
        forceRetry = false;
      }
    }
  })();

  return modelLoading;
}

/**
 * Generate structured prompt for query parsing
 */
function generateStructuredPrompt(query: string): string {
  return `You are a search query parser for a contact management system. Extract structured information from the user's natural language query.

Query: "${query}"

Extract the following information:
- Intent: What is the user trying to do? (search_contacts, list_recent, relationship_lookup)
- Filters: Extract any entities mentioned:
  * name: Person's name
  * company: Company name
  * job_title: Job title or role (e.g., "engineer", "designer", "manager")
  * location: Location (city, state, country)
  * tags: Any relevant tags or keywords
- Semantic hint: The main search terms for ranking (usually the original query or key terms)
- Confidence: How certain you are (0.0-1.0)
- Explanation: A brief human-readable explanation

Return ONLY valid JSON matching this exact schema:
{
  "intent": "search_contacts" | "list_recent" | "relationship_lookup",
  "filters": {
    "name": string (optional),
    "company": string (optional),
    "job_title": string (optional),
    "location": string (optional),
    "tags": string[] (optional)
  },
  "semantic_hint": string,
  "confidence": number (0.0-1.0),
  "explanation": string
}

Important: Return ONLY the JSON object, no markdown, no code blocks, no other text.`;
}

/**
 * Extract JSON from LLM response
 * Handles cases where LLM adds extra text or markdown
 */
function extractJSONFromResponse(response: string): any | null {
  try {
    // Try to find JSON object in response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const jsonStr = jsonMatch[0];
    return JSON.parse(jsonStr);
  } catch (error) {
    console.warn("Failed to extract JSON from LLM response:", error);
    return null;
  }
}

/**
 * Validate SearchQuery schema
 */
function validateSearchQuery(obj: any): obj is SearchQuery {
  if (!obj || typeof obj !== "object") return false;
  
  // Validate intent
  if (!["search_contacts", "list_recent", "relationship_lookup"].includes(obj.intent)) {
    return false;
  }
  
  // Validate filters
  if (!obj.filters || typeof obj.filters !== "object") return false;
  
  // Validate confidence
  if (typeof obj.confidence !== "number" || obj.confidence < 0 || obj.confidence > 1) {
    return false;
  }
  
  // Validate explanation
  if (typeof obj.explanation !== "string") return false;
  
  // Validate optional filter fields
  const filters = obj.filters;
  if (filters.name !== undefined && typeof filters.name !== "string") return false;
  if (filters.company !== undefined && typeof filters.company !== "string") return false;
  if (filters.job_title !== undefined && typeof filters.job_title !== "string") return false;
  if (filters.location !== undefined && typeof filters.location !== "string") return false;
  if (filters.tags !== undefined && !Array.isArray(filters.tags)) return false;
  
  return true;
}

/**
 * Parse query with LLM
 * Main function for unified LLM-based query parsing
 */
export async function parseQueryWithLLM(
  query: string
): Promise<SearchQuery | null> {
  // Check if LLM parsing is enabled
  if (!isLLMParsingEnabled()) {
    return null;
  }

  // Check cache first
  const cached = await getCachedParsedQuery(query);
  if (cached) {
    return cached;
  }

  try {
    // Load model
    const model = await loadLLMModel();
    if (!model) {
      return null;
    }

    // Generate prompt
    const prompt = generateStructuredPrompt(query);

    // Call LLM with timeout
    const config = getLLMConfig();
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), config.timeoutMs);
    });

    const llmPromise = (async () => {
      try {
        // For T5 models, use text2text-generation pipeline
        // Adjust parameters based on model type
        const result = await model(prompt, {
          max_length: 256, // Limit output length for faster inference
          max_new_tokens: 128, // Alternative to max_length
          temperature: 0.1, // Low temperature for deterministic output
          do_sample: false, // Deterministic generation
          num_beams: 1, // Faster inference (greedy search)
        });

        // Extract text from result (T5 models return object with generated_text property)
        // Handle both array and object responses
        let responseText = "";
        if (Array.isArray(result) && result.length > 0) {
          responseText = result[0]?.generated_text || result[0]?.text || "";
        } else if (result && typeof result === "object") {
          responseText = result.generated_text || result.text || JSON.stringify(result);
        } else if (typeof result === "string") {
          responseText = result;
        }
        
        if (!responseText) {
          console.warn("[LLM] Empty response from model:", result);
          return null;
        }
        
        // Extract JSON from response
        const parsed = extractJSONFromResponse(responseText);
        if (!parsed) {
          return null;
        }

        // Validate schema
        if (!validateSearchQuery(parsed)) {
          console.warn("LLM response failed schema validation:", parsed);
          return null;
        }

        // Cache the result
        await cacheParsedQuery(query, parsed);

        return parsed;
      } catch (error: any) {
        const errorInfo = categorizeError(error);
        console.warn(`[LLM] Inference failed (${errorInfo.type}):`, errorInfo.message);
        
        // Store error for diagnostics (but don't mark as permanent failure for inference errors)
        await storeLastError({
          errorType: errorInfo.type,
          message: `Inference failed: ${errorInfo.message}`,
          timestamp: Date.now(),
          details: {
            ...errorInfo.details,
            stage: "inference",
          },
        });
        
        return null;
      }
    })();

    const result = await Promise.race([llmPromise, timeoutPromise]);
    return result;
  } catch (error: any) {
    const errorInfo = categorizeError(error);
    console.warn(`[LLM] Query parsing failed (${errorInfo.type}):`, errorInfo.message);
    
    // Store error for diagnostics
    await storeLastError({
      errorType: errorInfo.type,
      message: `Query parsing failed: ${errorInfo.message}`,
      timestamp: Date.now(),
      details: {
        ...errorInfo.details,
        stage: "parsing",
        query: query.substring(0, 100), // Store first 100 chars for context
      },
    });
    
    return null;
  }
}

/**
 * Semantic assist using unified LLM adapter
 * This is the main entry point for all platforms
 */
export async function semanticAssistUnified(
  query: string,
  deterministicQuery: SearchQuery | null
): Promise<SearchQuery | null> {
  try {
    // Try LLM parsing first
    const llmQuery = await parseQueryWithLLM(query);
    
    if (llmQuery) {
      return llmQuery;
    }

    // Fallback to deterministic query if provided
    if (deterministicQuery) {
      return deterministicQuery;
    }

    // Last resort: create minimal query from original
    return {
      intent: "search_contacts",
      filters: {},
      semantic_hint: query,
      confidence: 0.5,
      explanation: `Searching for: ${query}`,
    };
  } catch (error) {
    console.warn("Unified semantic assist failed:", error);
    return deterministicQuery || null;
  }
}
