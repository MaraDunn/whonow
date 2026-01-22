import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/security.ts";

/**
 * LLM Model Proxy Edge Function
 * 
 * Proxies requests to Hugging Face CDN for LLM model files to bypass CORS restrictions.
 * This allows browser-based model loading to work reliably.
 * 
 * Usage:
 *   GET /llm-proxy?model=Xenova/LaMini-Flan-T5-77M&file=model.onnx
 *   GET /llm-proxy?model=Xenova/LaMini-Flan-T5-77M&file=tokenizer.json
 * 
 * The function:
 * 1. Validates the request (model name, file path)
 * 2. Fetches the file from Hugging Face CDN (server-side, no CORS)
 * 3. Returns the file with proper CORS headers
 * 4. Optionally caches responses (via CDN/Deno Deploy caching)
 */

// Allowed model repositories (security: only allow Xenova models)
const ALLOWED_MODEL_PREFIXES = [
  "Xenova/",
];

// Hugging Face CDN base URL
const HF_CDN_BASE = "https://huggingface.co";

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
 * Build Hugging Face CDN URL for a model file
 */
function buildHFUrl(model: string, file: string): string {
  // Hugging Face CDN structure: https://huggingface.co/{model}/resolve/main/{file}
  // For quantized models, try quantized branch first, then main
  return `${HF_CDN_BASE}/${model}/resolve/main/${file}`;
}

/**
 * Fetch file from Hugging Face CDN
 * Uses browser-like headers to avoid 401 Unauthorized errors
 */
async function fetchFromHF(url: string): Promise<Response> {
  // Use browser-like headers to avoid Hugging Face blocking
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://huggingface.co/",
    "Origin": "https://huggingface.co",
  };
  
  const response = await fetch(url, {
    method: "GET",
    headers,
  });
  
  if (!response.ok) {
    // Try quantized branch if main branch fails
    if (response.status === 404 && !url.includes("/quantized/")) {
      const quantizedUrl = url.replace("/resolve/main/", "/resolve/quantized/");
      const quantizedResponse = await fetch(quantizedUrl, {
        method: "GET",
        headers,
      });
      
      if (quantizedResponse.ok) {
        return quantizedResponse;
      }
    }
    
    throw new Error(`HF CDN returned ${response.status}: ${response.statusText}`);
  }
  
  return response;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  
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
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: "Failed to fetch model file",
        details: errorMessage,
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
