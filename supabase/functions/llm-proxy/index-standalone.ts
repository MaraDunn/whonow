import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * LLM Model Proxy Edge Function (Standalone Version)
 * 
 * This is a standalone version that doesn't require the _shared module.
 * Use this version when deploying via Supabase Dashboard.
 * 
 * Proxies requests to Hugging Face CDN for LLM model files to bypass CORS restrictions.
 * 
 * Usage:
 *   GET /llm-proxy?model=Xenova/LaMini-Flan-T5-77M&file=model.onnx
 *   GET /llm-proxy?model=Xenova/LaMini-Flan-T5-77M&file=tokenizer.json
 */

// Allowed origins for CORS
const DEFAULT_ORIGINS = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://whonow.co",
  "https://www.whonow.co",
];

const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")
  ? Deno.env.get("ALLOWED_ORIGINS")!.split(",").map(o => o.trim())
  : DEFAULT_ORIGINS;

/**
 * Get CORS headers
 */
function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // If origin is provided and in allowed list, use it
  // Otherwise, use wildcard for development (or first allowed origin for production)
  let allowedOrigin: string;
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    allowedOrigin = requestOrigin;
  } else if (requestOrigin && (requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1'))) {
    // Allow any localhost origin for development
    allowedOrigin = requestOrigin;
  } else {
    // For production, use the first allowed origin or wildcard
    allowedOrigin = ALLOWED_ORIGINS[0] || "*";
  }
    
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

/**
 * Handle CORS preflight requests
 */
function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, { headers: getCorsHeaders(origin) });
  }
  return null;
}

// Allowed model repositories (security: only allow Xenova models)
const ALLOWED_MODEL_PREFIXES = [
  "Xenova/",
];

// Hugging Face CDN base URL
const HF_CDN_BASE = "https://huggingface.co";

// Optional Hugging Face API token (set in Edge Function secrets)
// If set, will use authenticated requests which are more reliable
const HF_API_TOKEN = Deno.env.get("HUGGINGFACE_API_TOKEN");
console.log(`[llm-proxy] Token check: ${HF_API_TOKEN ? `Token found (${HF_API_TOKEN.substring(0, 10)}...)` : "No token found"}`);

// Allowed file extensions for security
const ALLOWED_EXTENSIONS = [
  ".onnx",
  ".json",
  ".txt",
  ".bin",
  ".safetensors",
];

// Maximum file size to proxy (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Validate model name to prevent path traversal and unauthorized access
 */
function isValidModelName(model: string): boolean {
  if (!model || typeof model !== "string") return false;
  
  // Check if model starts with allowed prefix
  const hasAllowedPrefix = ALLOWED_MODEL_PREFIXES.some(prefix => 
    model.startsWith(prefix)
  );
  
  if (!hasAllowedPrefix) return false;
  
  // Prevent path traversal attacks
  if (model.includes("..") || model.includes("/../")) return false;
  
  // Basic format validation (model/repo format)
  const parts = model.split("/");
  if (parts.length !== 2) return false;
  
  return true;
}

/**
 * Validate file path to prevent path traversal
 */
function isValidFilePath(file: string): boolean {
  if (!file || typeof file !== "string") return false;
  
  // Prevent path traversal
  if (file.includes("..") || file.includes("/../")) return false;
  
  // Check if file has allowed extension
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some(ext => 
    file.endsWith(ext)
  );
  
  return hasAllowedExtension;
}

/**
 * Build Hugging Face URL for a model file
 * Uses direct CDN URL - Hugging Face Hub API doesn't support file downloads directly
 */
function buildHFUrl(model: string, file: string): string {
  // Hugging Face CDN structure: https://huggingface.co/{model}/resolve/main/{file}
  return `${HF_CDN_BASE}/${model}/resolve/main/${file}`;
}

/**
 * Fetch file from Hugging Face CDN
 * Uses browser-like headers to avoid 401 Unauthorized errors
 */
async function fetchFromHF(url: string): Promise<Response> {
  // Build headers - use API token if available
  const headers: Record<string, string> = {};
  
  if (HF_API_TOKEN) {
    // Use Bearer token format for Hugging Face API
    headers["Authorization"] = `Bearer ${HF_API_TOKEN}`;
    console.log("[llm-proxy] Using Hugging Face API token for authenticated request");
  } else {
    console.log("[llm-proxy] No API token found - using unauthenticated request");
  }
  
  // Strategy 1: Try with token (if available)
  let response = await fetch(url, {
    method: "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });
  
  // Log response details for debugging
  console.log(`[llm-proxy] Initial fetch status: ${response.status}, content-type: ${response.headers.get("content-type")}`);
  
  // Strategy 2: If 401 with token, try adding browser headers too
  if (response.status === 401 && HF_API_TOKEN) {
    console.log("[llm-proxy] 401 with token, trying with additional browser headers");
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    headers["Accept"] = "*/*";
    headers["Referer"] = "https://huggingface.co/";
    response = await fetch(url, {
      method: "GET",
      headers,
    });
  }
  
  // Strategy 3: If 401 without token, try browser headers only
  if (response.status === 401 && !HF_API_TOKEN) {
    console.log("[llm-proxy] 401 without token, trying with browser headers");
    response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://huggingface.co/",
        "Origin": "https://huggingface.co",
      },
    });
  }
  
  // Strategy 4: Try quantized branch (sometimes more accessible)
  if (!response.ok && response.status !== 404 && !url.includes("/quantized/")) {
    console.log("[llm-proxy] Trying quantized branch");
    const quantizedUrl = url.replace("/resolve/main/", "/resolve/quantized/");
    const quantizedHeaders: Record<string, string> = {};
    if (HF_API_TOKEN) {
      quantizedHeaders["Authorization"] = `Bearer ${HF_API_TOKEN}`;
    }
    const quantizedResponse = await fetch(quantizedUrl, {
      method: "GET",
      headers: Object.keys(quantizedHeaders).length > 0 ? quantizedHeaders : undefined,
    });
    
    if (quantizedResponse.ok) {
      return quantizedResponse;
    }
  }
  
  if (!response.ok) {
    // Try quantized branch if main branch fails (404 case)
    if (response.status === 404 && !url.includes("/quantized/")) {
      const quantizedUrl = url.replace("/resolve/main/", "/resolve/quantized/");
      const quantizedHeaders: Record<string, string> = {};
      if (HF_API_TOKEN) {
        quantizedHeaders["Authorization"] = `Bearer ${HF_API_TOKEN}`;
      }
      const quantizedResponse = await fetch(quantizedUrl, {
        method: "GET",
        headers: Object.keys(quantizedHeaders).length > 0 ? quantizedHeaders : undefined,
      });
      
      if (quantizedResponse.ok) {
        return quantizedResponse;
      }
    }
    
    // Provide helpful error message
    if (response.status === 401) {
      if (HF_API_TOKEN) {
        throw new Error(`HF CDN returned 401: Unauthorized even with API token. Token may be invalid or lack required permissions. Check token at https://huggingface.co/settings/tokens`);
      } else {
        throw new Error(`HF CDN returned 401: Unauthorized. Hugging Face is blocking server-side requests. Set HUGGINGFACE_API_TOKEN in Edge Function secrets (https://huggingface.co/settings/tokens)`);
      }
    }
    
    throw new Error(`HF CDN returned ${response.status}: ${response.statusText}`);
  }
  
  return response;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  
  // Log token status on each request (for debugging)
  const tokenAtRequestTime = Deno.env.get("HUGGINGFACE_API_TOKEN");
  console.log(`[llm-proxy] Request received. Token available: ${!!tokenAtRequestTime}`);
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }
  
  // Only allow GET requests
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      {
        status: 405,
        headers: {
          ...getCorsHeaders(origin),
          "Content-Type": "application/json",
        },
      }
    );
  }
  
  try {
    const url = new URL(req.url);
    const model = url.searchParams.get("model");
    const file = url.searchParams.get("file");
    
    // Validate parameters
    if (!model || !file) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameters. Use ?model=MODEL_NAME&file=FILE_PATH" 
        }),
        {
          status: 400,
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json",
          },
        }
      );
    }
    
    // Validate model name and file path
    if (!isValidModelName(model)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid model name. Only Xenova models are allowed." 
        }),
        {
          status: 400,
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json",
          },
        }
      );
    }
    
    if (!isValidFilePath(file)) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid file path. Only model files (.onnx, .json, etc.) are allowed." 
        }),
        {
          status: 400,
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json",
          },
        }
      );
    }
    
    // Build Hugging Face URL
    const hfUrl = buildHFUrl(model, file);
    console.log(`[llm-proxy] Fetching: ${hfUrl}`);
    
    // Fetch from Hugging Face CDN
    const hfResponse = await fetchFromHF(hfUrl);
    
    // Log response details for debugging
    console.log(`[llm-proxy] Response status: ${hfResponse.status}`);
    console.log(`[llm-proxy] Response headers:`, Object.fromEntries(hfResponse.headers.entries()));
    
    // Check if response is HTML (error page) instead of expected content
    const responseContentType = hfResponse.headers.get("content-type") || "";
    if (responseContentType.includes("text/html") || responseContentType.includes("text/plain")) {
      // Read first few bytes to check if it's HTML
      const bodyClone = hfResponse.clone();
      const text = await bodyClone.text();
      if (text.trim().startsWith("<!doctype") || text.trim().startsWith("<html")) {
        console.error(`[llm-proxy] ✗ Hugging Face returned HTML error page instead of ${file}`);
        console.error(`[llm-proxy] HTML content (first 500 chars):`, text.substring(0, 500));
        return new Response(
          JSON.stringify({ 
            error: "Hugging Face returned HTML error page instead of model file",
            details: `Expected ${file} but got HTML. This usually means the file doesn't exist or access is blocked.`,
            htmlPreview: text.substring(0, 200),
          }),
          {
            status: 502,
            headers: {
              ...getCorsHeaders(origin),
              "Content-Type": "application/json",
            },
          }
        );
      }
    }
    
    // Check file size
    const contentLength = hfResponse.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({ 
            error: `File too large (${Math.round(size / 1024 / 1024)}MB). Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB` 
          }),
          {
            status: 413,
            headers: {
              ...getCorsHeaders(origin),
              "Content-Type": "application/json",
            },
          }
        );
      }
    }
    
    // Get content type from response or infer from file extension
    let contentType = hfResponse.headers.get("content-type");
    if (!contentType) {
      if (file.endsWith(".json")) {
        contentType = "application/json";
      } else if (file.endsWith(".onnx")) {
        contentType = "application/octet-stream";
      } else if (file.endsWith(".txt")) {
        contentType = "text/plain";
      } else {
        contentType = "application/octet-stream";
      }
    }
    
    // Stream the response with CORS headers
    const body = await hfResponse.arrayBuffer();
    
    return new Response(body, {
      status: 200,
      headers: {
        ...getCorsHeaders(origin),
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        // Cache headers - allow browser/CDN caching
        "Cache-Control": "public, max-age=31536000, immutable",
        // Pass through original headers if useful
        "X-Content-Type-Options": "nosniff",
      },
    });
    
  } catch (error) {
    console.error("[llm-proxy] Error:", error);
    console.error("[llm-proxy] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("[llm-proxy] Request URL:", req.url);
    console.error("[llm-proxy] Request method:", req.method);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch model file",
        details: errorMessage,
        stack: errorStack,
      }),
      {
        status: 500,
        headers: {
          ...getCorsHeaders(origin),
          "Content-Type": "application/json",
        },
      }
    );
  }
});
