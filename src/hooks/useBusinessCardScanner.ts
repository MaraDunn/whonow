import { useState, useCallback, useRef } from "react";
import Tesseract from "tesseract.js";
import { supabase } from "@/integrations/supabase/client";
import { createPreprocessingVariants } from "@/utils/advancedImagePreprocessing";
import { mergeOCRResults, type OCRAttempt } from "@/utils/ocrMerger";
import { type OCRStructure, type OCRWord, type OCRLine } from "@/utils/ocrParser";

interface ScannedContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  confidence?: {
    name?: number;
    email?: number;
    phone?: number;
    company?: number;
    role?: number;
  };
}

export function useBusinessCardScanner() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedContact, setScannedContact] = useState<ScannedContact | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async (videoElement: HTMLVideoElement) => {
    try {
      setError(null);
      
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported in this browser. Please use a modern browser with HTTPS.");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoElement.srcObject = stream;
      videoRef.current = videoElement;
      streamRef.current = stream;
      await videoElement.play();
    } catch (err: unknown) {
      console.error("Camera error:", err);
      const e = typeof err === "object" && err !== null ? (err as { name?: string; message?: string }) : {};
      
      // Provide user-friendly error messages based on error type
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("Camera access denied. Please allow camera access in your browser settings.");
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        setError("No camera found. Please connect a camera and try again.");
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        setError("Camera is already in use by another application.");
      } else {
        setError(e.message || "Failed to access camera. Please try again.");
      }
      throw err;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureImage = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);
    return imageData;
  }, []);

  const scanImage = useCallback(async (imageBase64: string): Promise<ScannedContact | null> => {
    setIsLoading(true);
    setError(null);
    setScannedContact(null);

    try {
      console.log("=== Starting Multi-Pass Offline OCR ===");
      
      // Step 1: Create multiple preprocessing variants
      console.log("Creating preprocessing variants...");
      const variants = await createPreprocessingVariants(imageBase64);
      console.log(`Created ${variants.length} preprocessing variants`);

      // Step 2: Run OCR on each variant
      const ocrAttempts: OCRAttempt[] = [];
      
      for (const variant of variants) {
        console.log(`Processing variant: ${variant.name} (${variant.description})`);
        
        try {
          // Create worker for this variant
          const worker = await Tesseract.createWorker("eng");
          
          // Use different PSM modes for different variants to maximize chances
          // Some variants work better with different page segmentation modes
          let psmMode = 6; // Default: uniform block
          
          if (variant.name === 'morphological' || variant.name === 'super-contrast') {
            psmMode = 11; // Sparse text - better for stylized fonts
          } else if (variant.name === 'bilateral-filtered' || variant.name === 'adaptive-threshold') {
            psmMode = 4; // Single column - good for photographed cards
          } else if (variant.name === 'inverted' || variant.name === 'edge-enhanced') {
            psmMode = 6; // Uniform block - good for dark/enhanced cards
          }
          
          await worker.setParameters({
            tessedit_pageseg_mode: psmMode as any,
            tessedit_ocr_engine_mode: 1 as any, // LSTM only
            preserve_interword_spaces: 1 as any,
          });

          const ocrResult = await worker.recognize(variant.image);
          await worker.terminate();

          const text = ocrResult.data.text.trim();
          
          if (text.length > 0) {
            // Build structure
            let structure: OCRStructure | undefined;
            let avgConfidence = 0;

            if (ocrResult.data.words && Array.isArray(ocrResult.data.words) && ocrResult.data.words.length > 0) {
              const words: OCRWord[] = ocrResult.data.words
                .filter((w: any) => w.text && w.text.trim())
                .map((w: any) => {
                  const bbox = w.bbox || {};
                  return {
                    text: w.text.trim(),
                    confidence: typeof w.confidence === 'number' ? Math.max(0, w.confidence) : 50,
                    x: bbox.x0 || 0,
                    y: bbox.y0 || 0,
                    width: (bbox.x1 || 0) - (bbox.x0 || 0),
                    height: (bbox.y1 || 0) - (bbox.y0 || 0),
                    blockNum: w.block_num || 0,
                    parNum: w.par_num || 0,
                    lineNum: w.line_num || 0,
                    wordNum: w.word_num || 0,
                  };
                })
                .filter((w: OCRWord) => w.text.length > 0);

              if (words.length > 0) {
                const lines = groupWordsIntoLines(words);
                const blocks = groupLinesIntoBlocks(lines);
                const totalWeight = words.reduce((sum, w) => sum + w.text.length, 0);
                avgConfidence = totalWeight > 0
                  ? words.reduce((sum, w) => sum + (w.confidence * w.text.length), 0) / totalWeight
                  : words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
                
                structure = {
                  words,
                  lines,
                  blocks,
                  rawText: words.map((w) => w.text).join(" "),
                };
              }
            }

            ocrAttempts.push({
              text,
              structure,
              confidence: avgConfidence || 50,
              variantName: variant.name,
            });

            console.log(`✓ ${variant.name}: ${text.length} chars, confidence: ${(avgConfidence || 50).toFixed(1)}%`);
            console.log(`  Preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
          } else {
            console.log(`✗ ${variant.name}: No text extracted`);
          }
        } catch (err) {
          console.warn(`Failed to process variant ${variant.name}:`, err);
        }
      }

      if (ocrAttempts.length === 0) {
        throw new Error("Could not extract any text from image. Please try again with better lighting and ensure the business card is clearly visible.");
      }

      // Step 3: Merge OCR results intelligently
      console.log(`\n=== Merging ${ocrAttempts.length} OCR attempts ===`);
      const mergedResult = mergeOCRResults(ocrAttempts);
      console.log(`Merged result: ${mergedResult.text.length} chars, confidence: ${mergedResult.confidence.toFixed(1)}%`);
      console.log(`Sources used: ${mergedResult.sourcesUsed.join(", ")}`);

      const ocrResult = {
        text: mergedResult.text,
        structure: mergedResult.structure,
      };
      
      // Final check - if still no text, throw error
      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        throw new Error("Could not extract any text from image. Please ensure the business card is clearly visible and try again.");
      }

      // Check OCR quality
      let avgConfidence = mergedResult.confidence;
      
      console.log("OCR quality metrics:", {
        averageConfidence: avgConfidence.toFixed(2),
        textLength: ocrResult.text.length,
        hasStructuredData: !!ocrResult.structure,
        sourcesUsed: mergedResult.sourcesUsed.length,
        sampleText: ocrResult.text.substring(0, 100)
      });
      
      // Log confidence for debugging - never reject based on it
      if (avgConfidence < 40) {
        console.warn("Low OCR confidence detected:", avgConfidence.toFixed(1), "% - but continuing with extraction");
      } else if (avgConfidence < 60) {
        console.log("Moderate OCR confidence:", avgConfidence.toFixed(1), "% - continuing");
      } else {
        console.log("Good OCR confidence:", avgConfidence.toFixed(1), "%");
      }

      // Send OCR text and structured data to backend for parsing
      const { data, error: fnError } = await supabase.functions.invoke("scan-business-card", {
        body: { 
          ocrText: ocrResult.text,
          structure: ocrResult.structure ? {
            lines: ocrResult.structure.lines.map(line => ({
              text: line.text,
              confidence: line.confidence,
              y: line.y,
            })),
            blocks: ocrResult.structure.blocks.map(block => 
              block.map(line => ({
                text: line.text,
                confidence: line.confidence,
                y: line.y,
              }))
            ),
          } : undefined,
        },
      });

      if (fnError) {
        // Provide more specific error messages
        if (fnError.message?.includes("OCR text is required")) {
          throw new Error("Failed to extract text from image. Please try again with a clearer image.");
        }
        throw new Error(fnError.message || "Failed to scan business card. Please try again.");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to extract contact information. Please ensure the business card is clear and readable.");
      }

      // Check for low confidence fields and provide feedback
      const contact = data.contact;
      console.log("=== Received contact from backend ===");
      console.log("Full contact object:", JSON.stringify(contact, null, 2));
      console.log("Contact fields:", {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        role: contact.role,
      });
      
      const confidences = contact.confidence || {};
      console.log("Confidences:", confidences);
      
      const lowConfidenceFields = Object.entries(confidences)
        .filter(([_, conf]) => typeof conf === 'number' && conf < 50)
        .map(([field]) => field);

      // Don't throw error - always return the contact and let user review
      if (lowConfidenceFields.length > 0) {
        console.warn("Some fields have low confidence:", lowConfidenceFields);
        // Log which fields are actually present
        console.log("Fields with data:", {
          hasName: !!contact.name && contact.name.length > 0,
          hasEmail: !!contact.email && contact.email.length > 0,
          hasPhone: !!contact.phone && contact.phone.length > 0,
          hasCompany: !!contact.company && contact.company.length > 0,
          hasRole: !!contact.role && contact.role.length > 0,
        });
      }

      setScannedContact(contact);
      console.log("Set scannedContact state:", contact);
      return contact;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to scan business card. Please try again.";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const captureAndScan = useCallback(async () => {
    const imageData = captureImage();
    if (!imageData) {
      setError("Failed to capture image");
      return null;
    }
    return scanImage(imageData);
  }, [captureImage, scanImage]);

  const reset = useCallback(() => {
    setScannedContact(null);
    setCapturedImage(null);
    setError(null);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const imageData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setCapturedImage(imageData);
      return scanImage(imageData);
    } catch (err) {
      setError("Failed to read image file");
      setIsLoading(false);
      return null;
    }
  }, [scanImage]);

  return {
    isLoading,
    error,
    scannedContact,
    capturedImage,
    startCamera,
    stopCamera,
    captureImage,
    captureAndScan,
    scanImage,
    reset,
    handleFileUpload,
  };
}

/**
 * Helper function to group words into lines based on Y-coordinate
 */
function groupWordsIntoLines(words: OCRWord[]): OCRLine[] {
  if (words.length === 0) return [];

  // Sort words by Y coordinate, then by X coordinate
  const sortedWords = [...words].sort((a, b) => {
    if (Math.abs(a.y - b.y) < 15) {
      // Same line, sort by X
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const lines: OCRLine[] = [];
  let currentLine: OCRWord[] = [];
  let currentY = sortedWords[0]?.y ?? 0;

  for (const word of sortedWords) {
    // If Y coordinate is significantly different, start new line
    if (Math.abs(word.y - currentY) > 20) {
      if (currentLine.length > 0) {
        lines.push(createOCRLine(currentLine));
      }
      currentLine = [word];
      currentY = word.y;
    } else {
      currentLine.push(word);
      // Update average Y for current line
      currentY = (currentY + word.y) / 2;
    }
  }

  // Add last line
  if (currentLine.length > 0) {
    lines.push(createOCRLine(currentLine));
  }

  return lines;
}

/**
 * Helper function to create OCRLine from words
 */
function createOCRLine(words: OCRWord[]): OCRLine {
  const text = words.map((w) => w.text).join(" ");
  const avgConfidence =
    words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
  const avgY = words.reduce((sum, w) => sum + w.y, 0) / words.length;

  return {
    words,
    text,
    confidence: avgConfidence,
    y: avgY,
  };
}

/**
 * Helper function to group lines into blocks
 */
function groupLinesIntoBlocks(lines: OCRLine[]): OCRLine[][] {
  if (lines.length === 0) return [];

  // Group by block numbers if available, otherwise by Y-coordinate gaps
  const blocks: OCRLine[][] = [];
  const blockMap = new Map<number, OCRLine[]>();

  for (const line of lines) {
    if (line.words.length > 0) {
      const blockNum = line.words[0].blockNum;
      if (!blockMap.has(blockNum)) {
        blockMap.set(blockNum, []);
      }
      blockMap.get(blockNum)!.push(line);
    }
  }

  // If we have multiple blocks, use them
  if (blockMap.size > 1) {
    return Array.from(blockMap.values());
  }

  // Fallback: group by significant Y-coordinate gaps
  const sortedLines = [...lines].sort((a, b) => a.y - b.y);
  const result: OCRLine[][] = [];
  let currentBlock: OCRLine[] = [];
  let prevY = sortedLines[0]?.y ?? 0;

  for (const line of sortedLines) {
    // If gap is more than 1.5x average line height, start new block
    const avgHeight =
      line.words.length > 0
        ? line.words.reduce((sum, w) => sum + w.height, 0) / line.words.length
        : 20;
    if (line.y - prevY > avgHeight * 1.5 && currentBlock.length > 0) {
      result.push(currentBlock);
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
    prevY = line.y;
  }

  if (currentBlock.length > 0) {
    result.push(currentBlock);
  }

  return result.length > 0 ? result : [lines];
}
