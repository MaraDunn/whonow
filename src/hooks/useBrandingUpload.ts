import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBrandingUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadLogo = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);

      // Validate file type
      const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload PNG, JPEG, SVG, or WebP.");
        return null;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error("File size too large. Maximum size is 5MB.");
        return null;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${crypto.randomUUID()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // Provide more specific error messages
        if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("does not exist")) {
          throw new Error("Storage bucket 'branding' not found. Please create it in Supabase Storage settings.");
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from("branding").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload logo";
      toast.error(errorMessage);
      console.error("Logo upload error:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadFavicon = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);

      // Validate file type
      const validTypes = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"];
      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload PNG, ICO, or SVG.");
        return null;
      }

      // Validate file size (max 1MB for favicon)
      const maxSize = 1 * 1024 * 1024; // 1MB
      if (file.size > maxSize) {
        toast.error("File size too large. Maximum size is 1MB.");
        return null;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `favicon-${crypto.randomUUID()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // Provide more specific error messages
        if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("does not exist")) {
          throw new Error("Storage bucket 'branding' not found. Please create it in Supabase Storage settings.");
        }
        throw uploadError;
      }

      const { data } = supabase.storage.from("branding").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload favicon";
      toast.error(errorMessage);
      console.error("Favicon upload error:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteBrandingAsset = async (url: string): Promise<boolean> => {
    try {
      // Extract file path from URL
      const urlParts = url.split("/");
      const fileName = urlParts[urlParts.length - 1];
      if (!fileName) return false;

      const { error } = await supabase.storage
        .from("branding")
        .remove([fileName]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Branding asset delete error:", error);
      return false;
    }
  };

  return { uploadLogo, uploadFavicon, deleteBrandingAsset, uploading };
}

