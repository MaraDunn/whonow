import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  checkLaunchMode,
  waitlistModeBlockedResponse,
  getCorsHeaders,
  handleCorsPreflightRequest,
  checkRateLimit,
  rateLimitExceededResponse,
} from "../_shared/security.ts";

// Rate limit: 20 OCR requests per minute per user (expensive external API)
const RATE_LIMIT_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Google Cloud Vision API for Business Card OCR
 * Much more accurate than Tesseract.js for business cards
 */

// Max base64 length (~5MB decoded); reject larger to prevent DoS and cost abuse
const MAX_IMAGE_BASE64_LENGTH = 7 * 1024 * 1024;

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  // Check launch mode - block in waitlist mode
  const { blocked } = checkLaunchMode();
  if (blocked) {
    return waitlistModeBlockedResponse(origin);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing authorization header" }),
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
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const rateLimit = checkRateLimit(`ocr-google-vision:${user.id}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);
  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit.resetIn, origin);
  }

  try {
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (typeof imageBase64 !== "string" || imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data too large. Maximum size is 5MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ success: false, error: "OCR service error" }),
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
      JSON.stringify({ success: false, error: "Failed to perform OCR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

