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
 * Fallback OCR service using OCR.space API (free tier available)
 * More accurate than Tesseract.js for business cards
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
  if (!authHeader?.startsWith("Bearer ")) {
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

  const rateLimit = checkRateLimit(`ocr-fallback:${user.id}`, RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS);
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
        JSON.stringify({ success: false, error: "OCR service error" }),
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
      JSON.stringify({ success: false, error: "Failed to perform OCR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

