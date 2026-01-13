import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error("Avatar file is too large. Maximum size is 5MB.");
        return null;
      }

      // Validate file type
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
      if (!validTypes.includes(file.type)) {
        toast.error("Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.");
        return null;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        // Provide more specific error messages
        if (uploadError.message?.includes("Bucket not found") || uploadError.message?.includes("does not exist")) {
          toast.error("Avatars storage bucket not found. Please create the 'avatars' bucket in Supabase Storage.", {
            duration: 8000,
          });
          console.error("Avatar upload error - bucket missing:", uploadError);
        } else if (uploadError.message?.includes("new row violates row-level security")) {
          toast.error("Permission denied. Please check storage bucket policies.", {
            duration: 8000,
          });
          console.error("Avatar upload error - RLS policy:", uploadError);
        } else {
          toast.error(`Failed to upload avatar: ${uploadError.message || "Unknown error"}`, {
            duration: 6000,
          });
          console.error("Avatar upload error:", uploadError);
        }
        return null;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error occurred";
      toast.error(`Failed to upload avatar: ${errorMessage}`, {
        duration: 6000,
      });
      console.error("Avatar upload error:", error);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAvatar = async (url: string): Promise<boolean> => {
    try {
      const fileName = url.split("/").pop();
      if (!fileName) return false;

      const { error } = await supabase.storage
        .from("avatars")
        .remove([fileName]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Avatar delete error:", error);
      return false;
    }
  };

  return { uploadAvatar, deleteAvatar, uploading };
}
