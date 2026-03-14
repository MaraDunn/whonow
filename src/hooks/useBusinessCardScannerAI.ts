import { useState, useCallback, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { devLog } from "@/lib/devLog";
import { getValidSession } from "@/utils/authToken";

const SESSION_EXPIRED_MSG = "Session expired. Please sign in again to scan business cards.";

/** Clear local session so the app can show sign-in again (avoids stuck "signed in" state with invalid token). */
function clearSessionSoUserCanReauth() {
  void supabase.auth.signOut({ scope: "local" });
}

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

      // Stop any existing stream and clear the video first so a new load doesn't
      // interrupt an in-flight play() ("play() request was interrupted by a new load").
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

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
      
      const errMsg = String(e.message ?? "");
      let message = "Failed to access camera. ";
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        message += "Please grant camera permission and try again.";
      } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
        message += "No camera found on this device.";
      } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
        message += "Camera is already in use by another application.";
      } else if (e.name === "OverconstrainedError") {
        message += "No camera with requested capabilities found.";
      } else if (errMsg.includes("interrupted") && errMsg.includes("load")) {
        message += "Camera was restarted too soon. Please try again.";
      } else {
        message += errMsg || "Unknown error occurred.";
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

  const captureImage = useCallback((videoElement: HTMLVideoElement | null | undefined): string => {
    if (!videoElement?.videoWidth || !videoElement?.videoHeight) {
      throw new Error("Video not ready. Please wait for the camera to load before capturing.");
    }
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
      devLog("=== Starting AI OCR (PaddleOCR) ===");
      
      // Validate image before sending
      if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.trim().length === 0) {
        throw new Error("Invalid image data. Please capture or upload a valid image.");
      }
      
      devLog("Image data length:", imageBase64.length);
      devLog("Image preview:", imageBase64.substring(0, 50) + "...");

      // Refresh session so the Supabase client has a valid token, then invoke (client attaches JWT automatically).
      const session = await getValidSession();
      if (!session?.access_token) {
        clearSessionSoUserCanReauth();
        throw new Error(SESSION_EXPIRED_MSG);
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      if (!supabaseUrl || !anonKey) {
        throw new Error("App configuration error. Please refresh the page.");
      }

      // Use functions.invoke with explicit Authorization so the same token we validated is sent (avoids client/session skew).
      const doInvoke = (token: string) =>
        supabase.functions.invoke("scan-business-card-ai", {
          body: { image: imageBase64 },
          headers: { Authorization: `Bearer ${token}` },
        });

      let result = await doInvoke(session.access_token);
      let data = result.data as Record<string, unknown> | null;
      let status = 200;
      if (result.error) {
        if (result.error instanceof FunctionsHttpError && result.error.context) {
          status = (result.error.context as Response).status ?? 200;
        } else if (typeof (result.error as { status?: number }).status === "number") {
          status = (result.error as { status: number }).status;
        }
      }

      // Retry once with a fresh token (e.g. expired between getSession and request).
      if (status === 401) {
        const retrySession = await getValidSession();
        if (retrySession?.access_token) {
          result = await doInvoke(retrySession.access_token);
          data = result.data as Record<string, unknown> | null;
          status = 200;
          if (result.error) {
            if (result.error instanceof FunctionsHttpError && result.error.context) {
              status = (result.error.context as Response).status ?? 200;
            } else if (typeof (result.error as { status?: number }).status === "number") {
              status = (result.error as { status: number }).status;
            }
          }
          if (status === 401) {
            clearSessionSoUserCanReauth();
            throw new Error(SESSION_EXPIRED_MSG);
          }
          if (status !== 200) {
            const errPayload = (result.error as { message?: string } | null) ?? data;
            const errorMessage =
              typeof errPayload?.error === "string"
                ? errPayload.error
                : typeof (errPayload as { message?: string })?.message === "string"
                  ? (errPayload as { message: string }).message
                  : typeof data?.error === "string"
                    ? data.error
                    : typeof data?.details === "string"
                      ? `${(data?.error as string) ?? "Scan failed"}: ${data.details}`
                      : "Failed to process business card";
            throw new Error(errorMessage);
          }
        } else {
          clearSessionSoUserCanReauth();
          throw new Error(SESSION_EXPIRED_MSG);
        }
      }

      if (status !== 200) {
        if (status === 401) {
          clearSessionSoUserCanReauth();
          throw new Error(SESSION_EXPIRED_MSG);
        }
        const errPayload = (result.error as { message?: string } | null) ?? data;
        const errorMessage =
          typeof errPayload?.error === "string"
            ? errPayload.error
            : typeof (errPayload as { message?: string })?.message === "string"
              ? (errPayload as { message: string }).message
              : typeof data?.error === "string"
                ? data.error
                : typeof data?.details === "string"
                  ? `${(data?.error as string) ?? "Scan failed"}: ${data.details}`
                  : "Failed to process business card";
        throw new Error(errorMessage);
      }

      // Response OK: body may be contact data or an error payload
      if (data?.error && !data?.name) {
        throw new Error(
          typeof data.details === "string" ? `${data.error}: ${data.details}` : (data.error ?? "Scan failed")
        );
      }
      if (!data || typeof data !== "object") {
        throw new Error("No data returned from OCR service");
      }

      devLog("=== AI OCR Complete ===");
      devLog("Extracted contact:", data);

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

  const captureAndScan = useCallback(async (videoElement?: HTMLVideoElement | null): Promise<ScannedContact | null> => {
    const el = videoElement ?? videoRef.current;
    if (!el) {
      setError("Camera not ready. Please start the camera first.");
      return null;
    }
    try {
      const imageBase64 = captureImage(el);
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

