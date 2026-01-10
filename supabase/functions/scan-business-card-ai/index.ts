import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Import the existing parsing logic from the original function
// We'll use the same robust parsing that we already built

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    if (!image) {
      throw new Error("No image provided");
    }

    console.log("=== Calling PaddleOCR Service ===");

    // Get OCR service URL from environment
    const OCR_SERVICE_URL = Deno.env.get("OCR_SERVICE_URL");
    if (!OCR_SERVICE_URL) {
      throw new Error("OCR_SERVICE_URL environment variable not set");
    }

    // Call PaddleOCR service
    const ocrResponse = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: image,
        enhance: true,
      }),
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error("OCR service error:", errorText);
      throw new Error(`OCR service failed: ${ocrResponse.status} ${errorText}`);
    }

    const ocrResult = await ocrResponse.json();

    console.log("OCR Result:", {
      success: ocrResult.success,
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length,
      wordCount: ocrResult.words.length,
    });

    if (!ocrResult.success) {
      throw new Error(ocrResult.error || "OCR failed");
    }

    // Convert PaddleOCR format to our structure format
    const structure = {
      words: ocrResult.words.map((word: any) => ({
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
      lines: [], // Will be populated by parsing logic
      blocks: [], // Will be populated by parsing logic
      rawText: ocrResult.text,
    };

    // Now call the existing parsing function
    console.log("=== Calling Parsing Function ===");
    
    const parseResponse = await fetch(
      `${req.url.replace("/scan-business-card-ai", "/scan-business-card")}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...Object.fromEntries(
            [...req.headers.entries()].filter(([key]) =>
              key.toLowerCase().startsWith("authorization") ||
              key.toLowerCase() === "apikey"
            )
          ),
        },
        body: JSON.stringify({
          ocrText: ocrResult.text,
          structure: structure,
        }),
      }
    );

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error("Parsing error:", errorText);
      throw new Error(`Parsing failed: ${parseResponse.status}`);
    }

    const parsedContact = await parseResponse.json();

    console.log("=== OCR + Parsing Complete ===");
    console.log("Parsed contact:", parsedContact);

    return new Response(JSON.stringify(parsedContact), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in scan-business-card-ai:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: "Failed to process business card with AI OCR",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

