import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkLaunchMode, waitlistModeBlockedResponse } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Google Cloud Vision API for Business Card OCR
 * Much more accurate than Tesseract.js for business cards
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    const origin = req.headers.get("origin");
    return waitlistModeBlockedResponse(origin);
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Google Cloud API key from environment
    const apiKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Google Cloud Vision API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    // Call Google Cloud Vision API
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Data },
              features: [
                { type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }
              ],
            },
          ],
        }),
      }
    );

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error("Google Vision API error:", errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "OCR service error", 
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const visionData = await visionResponse.json();
    const annotation = visionData.responses[0];

    if (!annotation || !annotation.fullTextAnnotation) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No text detected in image. Please ensure the business card is clearly visible." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullText = annotation.fullTextAnnotation.text;
    
    // Extract structured data from pages
    const pages = annotation.fullTextAnnotation.pages || [];
    const lines: Array<{ text: string; confidence: number; y: number; x: number; width: number }> = [];

    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const paragraph of block.paragraphs || []) {
          // Extract line text and position
          let lineText = "";
          let totalConfidence = 0;
          let confidenceCount = 0;
          
          // Get bounding box for position
          const vertices = paragraph.boundingBox?.vertices || [];
          const y = vertices.length > 0 ? vertices[0].y || 0 : 0;
          const x = vertices.length > 0 ? vertices[0].x || 0 : 0;
          const width = vertices.length > 1 ? (vertices[1].x || 0) - x : 100;

          for (const word of paragraph.words || []) {
            const wordText = word.symbols?.map((s: any) => s.text).join("") || "";
            lineText += wordText + " ";
            
            if (word.confidence !== undefined) {
              totalConfidence += word.confidence * 100;
              confidenceCount++;
            }
          }

          if (lineText.trim()) {
            lines.push({
              text: lineText.trim(),
              confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 90,
              y,
              x,
              width,
            });
          }
        }
      }
    }

    console.log("Google Vision OCR completed");
    console.log("Extracted text length:", fullText.length);
    console.log("Extracted lines:", lines.length);
    console.log("Sample text:", fullText.substring(0, 200));

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: fullText,
        structure: {
          lines,
          blocks: [lines], // Group all lines as one block for simplicity
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

