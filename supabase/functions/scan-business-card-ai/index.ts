import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  checkRateLimit,
  rateLimitExceededResponse,
} from "../_shared/security.ts";

// Rate limit: 20 scan requests per minute per user (expensive AI/OCR)
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Missing authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    // Log server-side only (Supabase Dashboard → Edge Functions → Logs) to debug 401s
    console.error("[scan-business-card-ai] Auth failed:", userError?.message ?? "no user", "token length:", token?.length ?? 0);
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rateLimit = checkRateLimit(`scan-business-card-ai:${user.id}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.resetIn, origin);
  }

  try {
    // Log request method and headers for debugging
    console.log("Request method:", req.method);
    const contentType = req.headers.get("content-type");
    console.log("Content-Type header:", contentType);
    console.log("Content-Length header:", req.headers.get("content-length"));
    
    // Verify Content-Type is JSON (but be lenient)
    if (contentType && !contentType.includes("json") && !contentType.includes("text")) {
      console.warn("Unexpected Content-Type:", contentType);
    }
    
    // Check if body exists before trying to read
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) === 0) {
      console.error("Request has Content-Length: 0 (empty body)");
      return new Response(
        JSON.stringify({ error: "Invalid request. Provide a JSON body with an 'image' field (base64)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Read body as text first (can only read once)
    let bodyText: string = "";
    try {
      bodyText = await req.text();
      console.log("Request body length:", bodyText?.length || 0);
      if (bodyText.length > 0) {
        console.log("Request body preview:", bodyText.substring(0, 100));
      } else {
        console.log("Request body is empty");
      }
    } catch (readError) {
      console.error("=== ERROR READING REQUEST BODY ===");
      console.error("Error type:", readError?.constructor?.name);
      console.error("Error message:", readError instanceof Error ? readError.message : String(readError));
      console.error("Error stack:", readError instanceof Error ? readError.stack : "No stack");
      
      // If it's a JSON parse error from Supabase runtime, handle it
      if (readError instanceof Error && readError.message.includes("JSON")) {
        return new Response(
          JSON.stringify({ error: "Invalid request. Provide a JSON body with an 'image' field (base64)." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Invalid request. Could not read request body." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Check if body is empty
    if (!bodyText || bodyText.trim().length === 0) {
      console.error("Empty request body received");
      return new Response(
        JSON.stringify({ error: "Invalid request. Provide a JSON body with an 'image' field (base64)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Parse JSON
    let body: any;
    try {
      body = JSON.parse(bodyText);
      console.log("Successfully parsed JSON body");
      console.log("Body keys:", Object.keys(body || {}));
      console.log("Has image field:", "image" in body);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Body preview (first 500 chars):", bodyText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Invalid request. Provide a JSON body with an 'image' field (base64)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { image } = body;

    if (!image) {
      console.error("No 'image' field in request body");
      console.error("Body structure:", JSON.stringify(body, null, 2).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Invalid request. Request body must contain an 'image' field (base64)." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (typeof image !== 'string' || image.trim().length === 0) {
      console.error("Image field is empty or not a string");
      return new Response(
        JSON.stringify({ error: "Invalid request. The 'image' field must be a non-empty base64 string." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("Image data received, length:", image.length);
    console.log("Image preview:", image.substring(0, 50) + "...");

    console.log("=== Calling PaddleOCR Service ===");

    // Get OCR service URL from environment
    const OCR_SERVICE_URL = Deno.env.get("OCR_SERVICE_URL");
    console.log("OCR_SERVICE_URL configured:", OCR_SERVICE_URL ? "YES" : "NO");
    
    if (!OCR_SERVICE_URL) {
      console.error("OCR_SERVICE_URL environment variable not set");
      return new Response(
        JSON.stringify({ error: "OCR service is not configured. Please try again later." }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const totalTimeoutMs = 120000; // 2 minutes total for all attempts
    const retryDelayMs = 15000;
    const maxAttempts = 3;
    const requestStartTime = Date.now();
    let ocrResponse: Response | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elapsed = Date.now() - requestStartTime;
      const remainingMs = Math.max(1000, totalTimeoutMs - elapsed);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), remainingMs);

      try {
        console.log(`OCR service request attempt ${attempt}/${maxAttempts} (timeout ${Math.round(remainingMs / 1000)}s)`);
        ocrResponse = await fetch(`${OCR_SERVICE_URL}/ocr`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: image, enhance: true }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const status = ocrResponse.status;
        console.log(`OCR service responded with status: ${status}`);

        if ((status === 502 || status === 503) && attempt < maxAttempts) {
          console.log(`OCR service returned ${status} (not ready), retrying in ${retryDelayMs / 1000}s`);
          await new Promise((r) => setTimeout(r, Math.min(retryDelayMs, remainingMs - 2000)));
          continue;
        }
        break;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const err = fetchError as { name?: string; message?: string };
        console.error(`OCR fetch attempt ${attempt} failed:`, err.name, err.message);
        if (attempt < maxAttempts && Date.now() - requestStartTime < totalTimeoutMs - retryDelayMs) {
          console.log(`Retrying in ${retryDelayMs / 1000}s`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
          continue;
        }
        const requestDuration = Date.now() - requestStartTime;
        if (err.name === "AbortError") {
          return new Response(
            JSON.stringify({ error: "OCR service did not respond in time. Please try again." }),
            { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: "OCR service is temporarily unavailable. Please try again later." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!ocrResponse) {
      return new Response(
        JSON.stringify({ error: "OCR service is temporarily unavailable. Please try again later." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read response as text first (can only read once)
    let responseText = "";
    try {
      responseText = await ocrResponse.text();
      console.log("OCR response text length:", responseText.length);
      console.log("OCR response preview:", responseText.substring(0, 200));
    } catch (readError) {
      console.error("Failed to read OCR response:", readError);
      return new Response(
        JSON.stringify({ error: "OCR service returned an invalid response. Please try again." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if response is empty
    if (!responseText || responseText.trim().length === 0) {
      console.error("OCR service returned empty response", ocrResponse.status);
      return new Response(
        JSON.stringify({ error: "OCR service returned an invalid response. Please try again." }),
        {
          status: ocrResponse.ok ? 502 : ocrResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle non-OK responses
    if (!ocrResponse.ok) {
      console.error("OCR service error:", ocrResponse.status, responseText);
      
      if (ocrResponse.status === 503 || ocrResponse.status === 502) {
        return new Response(
          JSON.stringify({ error: "OCR service is temporarily unavailable. Please try again in a moment." }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "OCR service error. Please try again." }),
        {
          status: ocrResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if response is HTML (error page) instead of JSON
    if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
      console.error("OCR service returned HTML instead of JSON (likely error page)");
      return new Response(
        JSON.stringify({ error: "OCR service is temporarily unavailable. Please try again later." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse JSON from text
    let ocrResult;
    try {
      ocrResult = JSON.parse(responseText);
      console.log("Successfully parsed OCR result");
    } catch (parseError) {
      console.error("Failed to parse OCR response as JSON:", parseError);
      console.error("Response text that failed to parse:", responseText.substring(0, 500));
      
      // Check if it looks like an error message
      const isLikelyError = responseText.includes("error") || responseText.includes("Error") || responseText.includes("exception");
      
      return new Response(
        JSON.stringify({ error: "OCR service returned an invalid response. Please try again." }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("OCR Result:", {
      success: ocrResult.success,
      confidence: ocrResult.confidence,
      textLength: ocrResult.text?.length || 0,
      wordCount: ocrResult.words?.length || 0,
    });
    
    // Log OCR text for debugging (first 500 chars)
    if (ocrResult.text) {
      console.log("OCR Text (first 500 chars):", ocrResult.text.substring(0, 500));
      console.log("OCR Text (full length):", ocrResult.text.length);
    }

    if (!ocrResult.success) {
      throw new Error(ocrResult.error || "OCR processing failed");
    }

    if (!ocrResult.text || ocrResult.text.trim().length === 0) {
      return new Response(
        JSON.stringify({
          name: "",
          email: "",
          phone: "",
          company: "",
          role: "",
          confidence: {
            name: 0,
            email: 0,
            phone: 0,
            company: 0,
            role: 0,
          },
          error: "No text detected in image",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Convert PaddleOCR format to structure format for parsing
    const words = ocrResult.words || [];
    const lines: Array<{ text: string; confidence: number; y: number; x: number; width: number; index: number }> = [];
    
    // Group words into lines by Y position
    const lineMap = new Map<number, Array<{ text: string; x: number; width: number; confidence: number }>>();
    
    words.forEach((word: any) => {
      const y = Math.round(word.y / 10) * 10; // Round to nearest 10 for line grouping
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push({
        text: word.text,
        x: word.x,
        width: word.width,
        confidence: word.confidence,
      });
    });

    // Convert to lines array
    let lineIndex = 0;
    for (const [y, wordsInLine] of Array.from(lineMap.entries()).sort((a, b) => a[0] - b[0])) {
      const lineText = wordsInLine
        .sort((a, b) => a.x - b.x)
        .map(w => w.text)
        .join(" ");
      const avgConfidence = wordsInLine.reduce((sum, w) => sum + w.confidence, 0) / wordsInLine.length;
      const minX = Math.min(...wordsInLine.map(w => w.x));
      const maxX = Math.max(...wordsInLine.map(w => w.x + w.width));
      
      lines.push({
        text: lineText,
        confidence: avgConfidence,
        y: y,
        x: minX,
        width: maxX - minX,
        index: lineIndex++,
      });
    }

    // Create structure object - only include lines (not full words array to avoid size issues)
    // The parsing function primarily uses lines, so we don't need the full words array
    const structure = {
      lines: lines,
      blocks: [],
      // Note: Not including words array or rawText to reduce payload size
      // The parsing function can work with just the lines array
    };

    // Now call the existing parsing function via internal request
    console.log("=== Calling Parsing Function ===");
    
    try {
      // Get the base URL from environment variable (required for internal edge function calls)
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!supabaseUrl) {
        throw new Error("SUPABASE_URL environment variable is not set");
      }
      const parseUrl = `${supabaseUrl}/functions/v1/scan-business-card`;
      console.log("Calling parsing function at:", parseUrl);
      
      // Get authorization headers from original request, or use service role key for internal calls
      const authHeaders: Record<string, string> = {};
      const authHeader = req.headers.get("Authorization");
      const apikeyHeader = req.headers.get("apikey");
      
      if (authHeader) {
        authHeaders["Authorization"] = authHeader;
      }
      if (apikeyHeader) {
        authHeaders["apikey"] = apikeyHeader;
      }
      
      // If no auth headers, use service role key for internal calls
      if (!authHeader && !apikeyHeader) {
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (serviceKey) {
          authHeaders["apikey"] = serviceKey;
          authHeaders["Authorization"] = `Bearer ${serviceKey}`;
        }
      }

      const requestBody = {
        ocrText: ocrResult.text,
        structure: structure,
      };
      
      console.log("Sending parsing request with:", {
        ocrTextLength: ocrResult.text.length,
        structureLines: structure.lines?.length || 0,
        requestBodySize: JSON.stringify(requestBody).length,
        authHeaders: Object.keys(authHeaders),
      });

      let parseResponse: Response;
      try {
        const bodyString = JSON.stringify(requestBody);
        parseResponse = await fetch(parseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: bodyString,
        });
        console.log("Parse function responded with status:", parseResponse.status);
      } catch (fetchError) {
        console.error("Failed to call parse function:", fetchError);
        throw new Error(`Could not reach parsing function: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }

      if (!parseResponse.ok) {
        let errorText = "";
        try {
          errorText = await parseResponse.text();
          console.error("Parsing error response:", errorText);
        } catch (e) {
          errorText = "Could not read error response";
          console.error("Could not read error response:", e);
        }
        console.error("Parsing function failed with status:", parseResponse.status);
        
        // Fallback: return basic parsed data with generic error (log details server-side only)
        return new Response(
          JSON.stringify({
            name: "",
            email: "",
            phone: "",
            company: "",
            role: "",
            confidence: {
              name: 0,
              email: 0,
              phone: 0,
              company: 0,
              role: 0,
            },
            error: "Contact extraction failed. Please try again.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let parseResponseData;
      try {
        parseResponseData = await parseResponse.json();
      } catch (parseError) {
        console.error("Failed to parse parsing function response:", parseError);
        throw new Error("Parsing function returned invalid JSON");
      }

      console.log("=== OCR + Parsing Complete ===");
      console.log("Parse response data:", parseResponseData);

      // Extract contact from response (scan-business-card returns { success: true, contact: {...} })
      const parsedContact = parseResponseData.success && parseResponseData.contact 
        ? parseResponseData.contact 
        : parseResponseData; // Fallback to entire response if structure is different

      console.log("Parsed contact:", parsedContact);

      return new Response(JSON.stringify(parsedContact), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (parseFunctionError) {
      console.error("Error calling parsing function:", parseFunctionError);
      return new Response(
        JSON.stringify({ error: "Contact extraction failed. Please try again." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("=== UNHANDLED ERROR in scan-business-card-ai ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    return new Response(
      JSON.stringify({ error: "Failed to process business card. Please try again later." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

