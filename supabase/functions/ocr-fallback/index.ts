import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fallback OCR service using OCR.space API (free tier available)
 * More accurate than Tesseract.js for business cards
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OCR.space API key from environment (free tier: 25,000 requests/month)
    const apiKey = Deno.env.get("OCR_SPACE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "OCR.space API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // OCR.space API accepts base64 directly
    const formData = new FormData();
    formData.append("base64Image", imageBase64);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "true"); // Get word coordinates
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // Engine 2 is more accurate

    const ocrResponse = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: {
        "apikey": apiKey,
      },
      body: formData,
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error("OCR.space API error:", errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "OCR service error", 
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ocrData = await ocrResponse.json();

    if (!ocrData.ParsedResults || ocrData.ParsedResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No text detected in image. Please ensure the business card is clearly visible." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedResult = ocrData.ParsedResults[0];
    const fullText = parsedResult.ParsedText || "";

    // Extract structured data from text overlay
    const lines: Array<{ text: string; confidence: number; y: number; x: number; width: number }> = [];
    
    if (parsedResult.TextOverlay && parsedResult.TextOverlay.Lines) {
      for (const line of parsedResult.TextOverlay.Lines) {
        const lineText = line.LineText || "";
        const y = line.MinTop || 0;
        const x = line.Words && line.Words.length > 0 ? line.Words[0].Left || 0 : 0;
        const width = line.MaxWidth || 100;
        
        // OCR.space doesn't provide confidence per word, use 85 as default for successful OCR
        lines.push({
          text: lineText,
          confidence: 85,
          y,
          x,
          width,
        });
      }
    }

    console.log("OCR.space OCR completed");
    console.log("Extracted text length:", fullText.length);
    console.log("Extracted lines:", lines.length);
    console.log("Sample text:", fullText.substring(0, 200));

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: fullText.trim(),
        structure: {
          lines,
          blocks: [lines],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("OCR error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Failed to perform OCR",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

