import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
        JSON.stringify({
          error: "Empty request body",
          details: "Request body is empty (Content-Length: 0). Please provide a JSON object with an 'image' field containing base64 encoded image data.",
        }),
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
          JSON.stringify({
            error: "Invalid or empty request body",
            details: "The request body could not be parsed as JSON. This usually means the body is empty or malformed. Please ensure you're sending a valid JSON object with an 'image' field.",
            help: "Check that your frontend is sending the request body correctly. The body should be: { image: 'data:image/...' }",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          error: "Failed to read request body",
          details: `Could not read request body: ${readError instanceof Error ? readError.message : String(readError)}. This may indicate the request was sent without a body or the body was malformed.`,
        }),
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
        JSON.stringify({
          error: "Empty request body",
          details: "Request body is empty. Please provide a JSON object with an 'image' field containing base64 encoded image data.",
        }),
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
        JSON.stringify({
          error: "Invalid JSON in request body",
          details: `Failed to parse request body as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. Body preview: ${bodyText.substring(0, 200)}`,
        }),
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
        JSON.stringify({
          error: "No image provided",
          details: "Request body must contain an 'image' field with base64 encoded image data. Received body keys: " + Object.keys(body || {}).join(", "),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    if (typeof image !== 'string' || image.trim().length === 0) {
      console.error("Image field is empty or not a string");
      return new Response(
        JSON.stringify({
          error: "Invalid image data",
          details: "The 'image' field must be a non-empty string containing base64 encoded image data.",
        }),
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
      console.error("Available environment variables:", Object.keys(Deno.env.toObject()).filter(k => k.includes("OCR") || k.includes("URL")));
      return new Response(
        JSON.stringify({
          error: "OCR service not configured",
          details: "OCR_SERVICE_URL environment variable is not set. Please configure it in Supabase Edge Functions settings (Dashboard → Edge Functions → Settings → Manage secrets).",
          help: "Add a secret named 'OCR_SERVICE_URL' with the value of your deployed OCR service URL (e.g., https://paddleocr-service.onrender.com)",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Calling OCR service at: ${OCR_SERVICE_URL}/ocr`);

    // Call PaddleOCR service with timeout
    // Increased timeout to 120 seconds to handle first-time model downloads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (2 minutes)

    let ocrResponse;
    const requestStartTime = Date.now();
    try {
      console.log("Sending request to OCR service...");
      console.log("Request timeout set to: 120 seconds");
      console.log("Image size in request:", JSON.stringify({ image: image }).length, "bytes");
      
      ocrResponse = await fetch(`${OCR_SERVICE_URL}/ocr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: image,
          enhance: true,
        }),
        signal: controller.signal,
      });
      
      const requestDuration = Date.now() - requestStartTime;
      clearTimeout(timeoutId);
      console.log(`OCR service responded after ${(requestDuration / 1000).toFixed(1)} seconds`);
      console.log("OCR service responded with status:", ocrResponse.status);
      console.log("Response headers:", Object.fromEntries(ocrResponse.headers.entries()));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const requestDuration = Date.now() - requestStartTime;
      console.error("=== OCR SERVICE FETCH ERROR ===");
      console.error("Error after", (requestDuration / 1000).toFixed(1), "seconds");
      console.error("Error type:", fetchError?.constructor?.name);
      console.error("Error name:", fetchError.name);
      console.error("Error message:", fetchError instanceof Error ? fetchError.message : String(fetchError));
      
      if (fetchError.name === "AbortError") {
        console.error("Request timed out after 120 seconds");
        return new Response(
          JSON.stringify({
            error: "OCR service timeout",
            details: "The OCR service did not respond within 120 seconds. If this is the first request, the service may be downloading PaddleOCR models (this only happens once and can take 30-60 seconds). Please wait a moment and try again. Subsequent requests will be much faster.",
          }),
          {
            status: 504,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return new Response(
        JSON.stringify({
          error: "Failed to reach OCR service",
          details: `Could not connect to OCR service at ${OCR_SERVICE_URL}. Error: ${fetchError.message}. Please verify the service is running and the URL is correct.`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
        JSON.stringify({
          error: "Failed to read OCR response",
          details: "Could not read response from OCR service. The service may have crashed or returned an invalid response.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if response is empty
    if (!responseText || responseText.trim().length === 0) {
      console.error("OCR service returned empty response");
      return new Response(
        JSON.stringify({
          error: "Empty OCR response",
          details: `OCR service returned empty response with status ${ocrResponse.status}. The service may not be properly configured or may be experiencing issues.`,
        }),
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
          JSON.stringify({
            error: "OCR service temporarily unavailable",
            details: `The OCR service returned error ${ocrResponse.status}. This may happen if: 1) This is the first request and PaddleOCR is downloading models (takes 30-60 seconds), 2) The service is starting up (Render free tier), or 3) The service is overloaded. Please wait 30-60 seconds and try again. Subsequent requests will be much faster once models are downloaded.`,
          }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({
          error: "OCR service error",
          details: `OCR service returned error ${ocrResponse.status}: ${responseText.substring(0, 300)}`,
        }),
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
        JSON.stringify({
          error: "OCR service returned error page",
          details: "The OCR service appears to be down or not properly deployed. It returned an HTML error page instead of JSON. Please check that the service is deployed and running.",
          help: "Verify your OCR service is running by visiting the /health endpoint in your browser.",
        }),
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
        JSON.stringify({
          error: "Invalid OCR response format",
          details: `OCR service returned invalid JSON. ${isLikelyError ? "Response appears to be an error message." : ""} Response preview: ${responseText.substring(0, 300)}. The service may not be properly deployed or may be experiencing issues.`,
          help: "Check your OCR service logs and verify the service is running correctly.",
        }),
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

    const structure = {
      words: words.map((word: any) => ({
        text: word.text,
        confidence: word.confidence,
        x: word.x,
        y: word.y,
        width: word.width,
        height: word.height,
        blockNum: 0,
        parNum: 0,
        lineNum: 0,
        wordNum: 0,
      })),
      lines: lines,
      blocks: [],
      rawText: ocrResult.text,
    };

    // Now call the existing parsing function via internal request
    console.log("=== Calling Parsing Function ===");
    
    try {
      // Get the base URL from the request
      const baseUrl = new URL(req.url).origin;
      const parseUrl = `${baseUrl}/functions/v1/scan-business-card`;
      console.log("Calling parsing function at:", parseUrl);
      
      // Get authorization headers from original request
      const authHeaders: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        if (key.toLowerCase() === "authorization" || key.toLowerCase() === "apikey") {
          authHeaders[key] = value;
        }
      });

      console.log("Sending parsing request with:", {
        ocrTextLength: ocrResult.text.length,
        structureLines: structure.lines?.length || 0,
        authHeaders: Object.keys(authHeaders),
      });

      let parseResponse: Response;
      try {
        parseResponse = await fetch(parseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            ocrText: ocrResult.text,
            structure: structure,
          }),
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
        
        // Fallback: return basic parsed data with error
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
            error: `Parsing function failed with status ${parseResponse.status}: ${errorText.substring(0, 300)}. OCR text extracted: ${ocrResult.text.substring(0, 200)}`,
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
        JSON.stringify({
          error: "Parsing function error",
          details: `Failed to call parsing function: ${parseFunctionError instanceof Error ? parseFunctionError.message : String(parseFunctionError)}. OCR was successful, but contact extraction failed.`,
        }),
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
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error && error.stack 
      ? `${errorMessage}\n\nStack: ${error.stack.substring(0, 500)}`
      : errorMessage;
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: `Failed to process business card with AI OCR. ${errorDetails}. Please check that OCR_SERVICE_URL is configured and the OCR service is running. Check Supabase edge function logs for more details.`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

