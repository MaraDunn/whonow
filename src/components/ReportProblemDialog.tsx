import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendBugReport } from "@/utils/helpEmail";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Paperclip, X } from "lucide-react";

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ACCEPT_TYPES = "image/*,.pdf";

interface ReportProblemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportProblemDialog({
  open,
  onOpenChange,
}: ReportProblemDialogProps) {
  const { user } = useAuth();
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    if (chosen.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`File must be under ${MAX_FILE_SIZE_MB} MB`);
      return;
    }
    setFile(chosen);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    const trimmed = description.trim();
    if (!trimmed) {
      toast.error("Please describe the problem");
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentBase64: string | undefined;
      let attachmentFilename: string | undefined;
      if (file) {
        const bytes = await file.arrayBuffer();
        const b64 = btoa(
          new Uint8Array(bytes).reduce((data, byte) => data + String.fromCharCode(byte), "")
        );
        attachmentBase64 = b64;
        attachmentFilename = file.name;
      }

      const result = await sendBugReport({
        body: trimmed,
        userEmail: user?.email ?? undefined,
        attachmentBase64,
        attachmentFilename,
      });

      if (result.success) {
        toast.success("Report sent. We'll look into it.");
        setDescription("");
        clearFile();
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed to send report");
      }
    } catch (err) {
      console.error("Report problem error:", err);
      toast.error("Failed to send report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isSubmitting) {
      setDescription("");
      clearFile();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="report-problem-description">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription id="report-problem-description" className="sr-only">
            Describe the issue and optionally attach a file.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="report-description">What went wrong? (required)</Label>
            <Textarea
              id="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
              className="resize-none"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label>Attachment (optional)</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_TYPES}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!file || isSubmitting}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                {file ? file.name : "Choose file"}
              </Button>
              {file && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Max {MAX_FILE_SIZE_MB} MB. Images or PDF.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Recent error logs from this session will be included automatically to help us debug.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !description.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
