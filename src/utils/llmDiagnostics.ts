/**
 * LLM Diagnostics Utility
 * Tools for diagnosing and troubleshooting LLM loading issues
 */

import { 
  isModelLoadFailed, 
  clearModelLoadFailure, 
  getLastError,
  clearLastError,
  getModelLoadingStatus,
  storeLastError
} from "./semanticAssist/modelCache";
import { getLLMConfig, isLLMParsingEnabled } from "./llmConfig";
import { ensureModelLoaded, resetInMemoryFailureState } from "./semanticAssist/unifiedLLMAdapter";

export interface DiagnosticResult {
  success: boolean;
  message: string;
  details?: any;
}

export interface LLMStatus {
  enabled: boolean;
  hasFailed: boolean;
  failedAt: number | null;
  lastError: {
    errorType: string;
    message: string;
    timestamp: number;
    details?: any;
  } | null;
  canRetry: boolean;
  config: {
    modelName: string;
    timeoutMs: number;
  };
}

/**
 * Check if WASM is available in the browser
 */
export async function checkWASMAvailability(): Promise<DiagnosticResult> {
  try {
    // Check if WebAssembly is supported
    if (typeof WebAssembly === "undefined") {
      return {
        success: false,
        message: "WebAssembly is not supported in this browser",
        details: {
          browser: navigator.userAgent,
        },
      };
    }

    // Try to instantiate a simple WASM module
    const wasmCode = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, // WASM header
    ]);

    try {
      await WebAssembly.instantiate(wasmCode);
      return {
        success: true,
        message: "WebAssembly is available and working",
      };
    } catch (error: any) {
      return {
        success: false,
        message: "WebAssembly instantiation failed",
        details: {
          error: error.message,
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to check WASM availability",
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Check network connectivity to Hugging Face
 */
export async function checkHuggingFaceConnectivity(): Promise<DiagnosticResult> {
  try {
    // Test connectivity to Hugging Face CDN
    const testUrl = "https://huggingface.co/api/models/Xenova/LaMini-Flan-T5-77M";
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(testUrl, {
        method: "HEAD",
        signal: controller.signal,
        mode: "cors",
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok || response.status === 404) {
        // 404 is OK - it means we can reach the server
        return {
          success: true,
          message: "Hugging Face is reachable",
          details: {
            status: response.status,
          },
        };
      } else {
        return {
          success: false,
          message: `Hugging Face returned status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
          },
        };
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === "AbortError") {
        return {
          success: false,
          message: "Connection to Hugging Face timed out",
          details: {
            error: "Timeout after 5 seconds",
          },
        };
      }
      
      if (error.message?.includes("CORS")) {
        return {
          success: false,
          message: "CORS error when accessing Hugging Face",
          details: {
            error: error.message,
            suggestion: "This may be a browser security restriction",
          },
        };
      }
      
      return {
        success: false,
        message: "Failed to connect to Hugging Face",
        details: {
          error: error.message,
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: "Network check failed",
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Check if ONNX Runtime can be imported
 */
export async function checkTransformersImport(): Promise<DiagnosticResult> {
  try {
    const ort = await import("onnxruntime-web");
    
    if (!ort.InferenceSession) {
      return {
        success: false,
        message: "ONNX Runtime imported but InferenceSession not found",
      };
    }
    
    return {
      success: true,
      message: "ONNX Runtime library imported successfully",
      details: {
        version: ort.env.versions?.web || "unknown",
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to import transformers library",
      details: {
        error: error.message,
        stack: error.stack,
      },
    };
  }
}

/**
 * Test model loading with detailed error reporting
 */
export async function testModelLoading(): Promise<DiagnosticResult> {
  try {
    const config = getLLMConfig();
    
    console.log("[LLM Diagnostics] Testing model loading...");
    console.log("[LLM Diagnostics] Model:", config.modelName);
    
    // Clear any previous failure state for testing
    await clearModelLoadFailure();
    
    try {
      const model = await ensureModelLoaded();
      
      if (model) {
        return {
          success: true,
          message: "Model loaded successfully",
          details: {
            modelName: config.modelName,
          },
        };
      } else {
        return {
          success: false,
          message: "Model loading returned null (likely failed silently)",
          details: {
            modelName: config.modelName,
            suggestion: "Check browser console for detailed error messages",
          },
        };
      }
    } catch (error: any) {
      // Categorize the error
      let errorType = "unknown";
      let errorMessage = error.message || "Unknown error";
      
      if (errorMessage.includes("CORS") || errorMessage.includes("cors")) {
        errorType = "cors";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        errorType = "network";
      } else if (errorMessage.includes("WASM") || errorMessage.includes("WebAssembly")) {
        errorType = "wasm";
      } else if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        errorType = "model_not_found";
      } else if (errorMessage.includes("timeout")) {
        errorType = "timeout";
      }
      
      // Store error for diagnostics
      await storeLastError({
        errorType,
        message: errorMessage,
        timestamp: Date.now(),
        details: {
          stack: error.stack,
          modelName: config.modelName,
        },
      });
      
      return {
        success: false,
        message: `Model loading failed: ${errorMessage}`,
        details: {
          errorType,
          error: errorMessage,
          stack: error.stack,
          modelName: config.modelName,
        },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: "Test setup failed",
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Run comprehensive diagnostics
 */
export async function runDiagnostics(): Promise<{
  wasm: DiagnosticResult;
  network: DiagnosticResult;
  transformers: DiagnosticResult;
  modelLoading: DiagnosticResult;
  status: LLMStatus;
}> {
  console.log("[LLM Diagnostics] Starting comprehensive diagnostics...");
  
  const wasm = await checkWASMAvailability();
  const network = await checkHuggingFaceConnectivity();
  const transformers = await checkTransformersImport();
  
  // Only test model loading if prerequisites pass
  let modelLoading: DiagnosticResult;
  if (wasm.success && network.success && transformers.success) {
    modelLoading = await testModelLoading();
  } else {
    modelLoading = {
      success: false,
      message: "Skipped model loading test due to prerequisite failures",
      details: {
        wasm: wasm.success,
        network: network.success,
        transformers: transformers.success,
      },
    };
  }
  
  const status = await getLLMStatus();
  
  return {
    wasm,
    network,
    transformers,
    modelLoading,
    status,
  };
}

/**
 * Get current LLM status
 */
export async function getLLMStatus(): Promise<LLMStatus> {
  const enabled = isLLMParsingEnabled();
  const config = getLLMConfig();
  const loadingStatus = await getModelLoadingStatus();
  const lastError = await getLastError();
  
  return {
    enabled,
    hasFailed: loadingStatus.hasFailed,
    failedAt: loadingStatus.failedAt,
    lastError: lastError ? {
      errorType: lastError.errorType,
      message: lastError.message,
      timestamp: lastError.timestamp,
      details: lastError.details,
    } : null,
    canRetry: loadingStatus.canRetry,
    config: {
      modelName: config.modelName,
      timeoutMs: config.timeoutMs,
    },
  };
}

/**
 * Clear all failure states and errors (allows retry)
 */
export async function clearAllFailureStates(): Promise<DiagnosticResult> {
  try {
    await clearModelLoadFailure();
    await clearLastError();
    
    // Also reset in-memory failure state
    resetInMemoryFailureState();
    
    return {
      success: true,
      message: "All failure states cleared (IndexedDB + in-memory). LLM will retry on next search.",
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to clear failure states",
      details: {
        error: error.message,
      },
    };
  }
}

/**
 * Get human-readable diagnostic report
 */
export async function getDiagnosticReport(): Promise<string> {
  const diagnostics = await runDiagnostics();
  const status = diagnostics.status;
  
  let report = "=== LLM Diagnostics Report ===\n\n";
  
  report += `LLM Parsing: ${status.enabled ? "Enabled" : "Disabled"}\n`;
  report += `Model: ${status.config.modelName}\n`;
  report += `Timeout: ${status.config.timeoutMs}ms\n\n`;
  
  report += "Status:\n";
  report += `  Has Failed: ${status.hasFailed ? "Yes" : "No"}\n`;
  if (status.failedAt) {
    const failedDate = new Date(status.failedAt);
    report += `  Failed At: ${failedDate.toLocaleString()}\n`;
  }
  report += `  Can Retry: ${status.canRetry ? "Yes" : "No"}\n`;
  
  if (status.lastError) {
    report += `\nLast Error:\n`;
    report += `  Type: ${status.lastError.errorType}\n`;
    report += `  Message: ${status.lastError.message}\n`;
    const errorDate = new Date(status.lastError.timestamp);
    report += `  Time: ${errorDate.toLocaleString()}\n`;
  }
  
  report += "\nPrerequisites:\n";
  report += `  WASM: ${diagnostics.wasm.success ? "✓" : "✗"} ${diagnostics.wasm.message}\n`;
  report += `  Network: ${diagnostics.network.success ? "✓" : "✗"} ${diagnostics.network.message}\n`;
  report += `  Transformers: ${diagnostics.transformers.success ? "✓" : "✗"} ${diagnostics.transformers.message}\n`;
  report += `  Model Loading: ${diagnostics.modelLoading.success ? "✓" : "✗"} ${diagnostics.modelLoading.message}\n`;
  
  if (!diagnostics.modelLoading.success && diagnostics.modelLoading.details) {
    report += "\nTroubleshooting:\n";
    if (diagnostics.modelLoading.details.errorType === "cors") {
      report += "  - CORS error detected. This may be a browser security restriction.\n";
      report += "  - Try a different browser or check browser security settings.\n";
    } else if (diagnostics.modelLoading.details.errorType === "network") {
      report += "  - Network error detected. Check your internet connection.\n";
      report += "  - Check if firewall is blocking Hugging Face.\n";
    } else if (diagnostics.modelLoading.details.errorType === "wasm") {
      report += "  - WASM error detected. Your browser may not support WebAssembly.\n";
      report += "  - Try updating your browser to the latest version.\n";
    } else if (diagnostics.modelLoading.details.errorType === "model_not_found") {
      report += "  - Model not found. The model repository may be unavailable.\n";
      report += "  - Try again later or check Hugging Face status.\n";
    } else if (diagnostics.modelLoading.details.errorType === "timeout") {
      report += "  - Timeout error. Model loading took too long.\n";
      report += "  - This may be due to slow network or large model size.\n";
    }
  }
  
  return report;
}

/**
 * Force model retry - clears failure state and allows retry
 */
export async function forceModelRetry(): Promise<DiagnosticResult> {
  try {
    // Import the force retry function from unifiedLLMAdapter
    const { forceModelRetry: forceRetryFn } = await import("./semanticAssist/unifiedLLMAdapter");
    
    // Clear both IndexedDB and in-memory failure states
    await clearAllFailureStates();
    await forceRetryFn();
    
    return {
      success: true,
      message: "Force retry enabled. Model will attempt to load on next search query.",
    };
  } catch (error: any) {
    // Fallback: just clear failure states
    await clearAllFailureStates();
    return {
      success: true,
      message: "Cleared failure states. Try a search query to trigger model loading.",
    };
  }
}

// Export diagnostic functions for console access
if (typeof window !== "undefined") {
  (window as any).llmDiagnostics = {
    runDiagnostics,
    getLLMStatus,
    clearAllFailureStates,
    getDiagnosticReport,
    testModelLoading,
    checkWASMAvailability,
    checkHuggingFaceConnectivity,
    checkTransformersImport,
    forceModelRetry,
  };
  
  console.log("[LLM Diagnostics] Diagnostic tools available at window.llmDiagnostics");
  console.log("[LLM Diagnostics] Quick retry: await llmDiagnostics.clearAllFailureStates()");
  console.log("[LLM Diagnostics] Force retry: await llmDiagnostics.forceModelRetry()");
  console.log("[LLM Diagnostics] Full report: await llmDiagnostics.getDiagnosticReport()");
}
