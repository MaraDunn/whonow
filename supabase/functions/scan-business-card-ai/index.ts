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
    console.log("Content-Type header:", req.headers.get("content-type"));
    
    // Read body as text first (can only read once)
    let bodyText: string;
    try {
      bodyText = await req.text();
      console.log("Request body length:", bodyText?.length || 0);
    } catch (readError) {
      console.error("Failed to read request body:", readError);
      return new Response(
        JSON.stringify({
          error: "Failed to read request body",
          details: `Could not read request body: ${readError instanceof Error ? readError.message : String(readError)}`,
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
    if (!OCR_SERVICE_URL) {
      console.error("OCR_SERVICE_URL environment variable not set");
      return new Response(
        JSON.stringify({
          error: "OCR service not configured",
          details: "OCR_SERVICE_URL environment variable is not set. Please configure it in Supabase Edge Functions settings.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Calling OCR service at: ${OCR_SERVICE_URL}/ocr`);

    // Call PaddleOCR service with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    let ocrResponse;
    try {
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
      clearTimeout(timeoutId);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        throw new Error("OCR service request timed out after 60 seconds");
      }
      throw new Error(`Failed to reach OCR service: ${fetchError.message}`);
    }

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error("OCR service error:", ocrResponse.status, errorText);
      
      if (ocrResponse.status === 503 || ocrResponse.status === 502) {
        throw new Error("OCR service is temporarily unavailable. Please try again in a moment.");
      }
      
      throw new Error(`OCR service failed with status ${ocrResponse.status}: ${errorText.substring(0, 200)}`);
    }

    const ocrResult = await ocrResponse.json();

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
    
    // Get the base URL from the request
    const baseUrl = new URL(req.url).origin;
    const parseUrl = `${baseUrl}/functions/v1/scan-business-card`;
    
    // Get authorization headers from original request
    const authHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (key.toLowerCase() === "authorization" || key.toLowerCase() === "apikey") {
        authHeaders[key] = value;
      }
    });

    const parseResponse = await fetch(parseUrl, {
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

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error("Parsing error:", parseResponse.status, errorText);
      
      // Fallback: return basic parsed data
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
          error: `Parsing failed: ${parseResponse.status}. OCR text: ${ocrResult.text.substring(0, 200)}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const parsedContact = await parseResponse.json();

    console.log("=== OCR + Parsing Complete ===");
    console.log("Parsed contact:", parsedContact);

    return new Response(JSON.stringify(parsedContact), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in scan-business-card-ai:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: "Failed to process business card with AI OCR. Please check that OCR_SERVICE_URL is configured and the OCR service is running.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

