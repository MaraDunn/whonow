import { useState, useCallback, useRef } from "react";
import Tesseract from "tesseract.js";
import { supabase } from "@/integrations/supabase/client";

interface ScannedContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
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
        setError("Camera access denied. Please allow camera permissions in your browser settings and try again.");
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        setError("No camera found. Please ensure your device has a camera.");
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        setError("Camera is in use by another application. Please close other apps using the camera.");
      } else if (e.name === "OverconstrainedError") {
        setError("Camera doesn't support the required settings. Try using a different camera.");
      } else if (e.name === "SecurityError") {
        setError("Camera access requires a secure connection (HTTPS).");
      } else {
        setError(e.message || "Could not access camera. Please check permissions and try again.");
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
    if (!videoRef.current) return null;

    const video = videoRef.current;
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

  const performOCR = useCallback(async (imageBase64: string): Promise<string> => {
    try {
      const worker = await Tesseract.createWorker("eng");
      const { data: { text } } = await worker.recognize(imageBase64);
      await worker.terminate();
      return text;
    } catch (err) {
      console.error("OCR error:", err);
      throw new Error("Failed to extract text from image. Please ensure the image is clear and readable.");
    }
  }, []);

  const scanImage = useCallback(async (imageBase64: string) => {
    setIsLoading(true);
    setError(null);
    setScannedContact(null);

    try {
      // Perform OCR on the client side
      const ocrText = await performOCR(imageBase64);

      if (!ocrText || ocrText.trim().length === 0) {
        throw new Error("Could not extract text from image. Please ensure the business card is clear and readable.");
      }

      // Send OCR text to backend for parsing
      const { data, error: fnError } = await supabase.functions.invoke("scan-business-card", {
        body: { ocrText },
      });

      if (fnError) {
        throw new Error(fnError.message || "Failed to scan business card");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to extract contact information");
      }

      setScannedContact(data.contact);
      return data.contact;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to scan business card";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [performOCR]);

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
