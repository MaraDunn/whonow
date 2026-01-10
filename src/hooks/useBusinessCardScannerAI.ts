import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useBusinessCardScannerAI() {
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
      
      let message = "Failed to access camera. ";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        message += "Please grant camera permission and try again.";
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        message += "No camera found on this device.";
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        message += "Camera is already in use by another application.";
      } else if (e.name === "OverconstrainedError") {
        message += "No camera with requested capabilities found.";
      } else {
        message += e.message || "Unknown error occurred.";
      }
      
      setError(message);
      throw new Error(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureImage = useCallback((videoElement: HTMLVideoElement): string => {
    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");
    ctx.drawImage(videoElement, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95);
  }, []);

  const scanImage = useCallback(async (imageBase64: string): Promise<ScannedContact | null> => {
    setIsLoading(true);
    setError(null);
    setScannedContact(null);

    try {
      console.log("=== Starting AI OCR (PaddleOCR) ===");
      
      // Call the new AI-powered edge function
      const { data, error: functionError } = await supabase.functions.invoke(
        "scan-business-card-ai",
        {
          body: { image: imageBase64 },
        }
      );

      if (functionError) {
        console.error("Edge function error:", functionError);
        throw new Error(functionError.message || "Failed to process business card");
      }

      if (!data) {
        throw new Error("No data returned from OCR service");
      }

      console.log("=== AI OCR Complete ===");
      console.log("Extracted contact:", data);

      const contact: ScannedContact = {
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        company: data.company || "",
        role: data.role || "",
        confidence: data.confidence || {},
      };

      setScannedContact(contact);
      return contact;

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to scan business card. Please try again.";
      console.error("Scan error:", err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const captureAndScan = useCallback(async (videoElement: HTMLVideoElement): Promise<ScannedContact | null> => {
    try {
      const imageBase64 = captureImage(videoElement);
      setCapturedImage(imageBase64);
      stopCamera();
      return await scanImage(imageBase64);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to capture and scan image";
      setError(message);
      return null;
    }
  }, [captureImage, stopCamera, scanImage]);

  const reset = useCallback(() => {
    setScannedContact(null);
    setCapturedImage(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const handleFileUpload = useCallback(async (file: File): Promise<ScannedContact | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageBase64 = e.target?.result as string;
        setCapturedImage(imageBase64);
        const result = await scanImage(imageBase64);
        resolve(result);
      };
      reader.onerror = () => {
        setError("Failed to read file");
        resolve(null);
      };
      reader.readAsDataURL(file);
    });
  }, [scanImage]);

  return {
    isLoading,
    error,
    scannedContact,
    capturedImage,
    startCamera,
    stopCamera,
    captureAndScan,
    reset,
    handleFileUpload,
    scanImage,
  };
}

