import { useState, useCallback, useRef } from "react";
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoElement.srcObject = stream;
      videoRef.current = videoElement;
      streamRef.current = stream;
      await videoElement.play();
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions.");
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

  const scanImage = useCallback(async (imageBase64: string) => {
    setIsLoading(true);
    setError(null);
    setScannedContact(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("scan-business-card", {
        body: { imageBase64 },
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
