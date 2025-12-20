import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAvatarUpload() {
  const [uploading, setUploading] = useState(false);

  const uploadAvatar = async (file: File): Promise<string | null> => {
    try {
      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (error) {
      toast.error("Failed to upload avatar");
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
