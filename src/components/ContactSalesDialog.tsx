import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { sendContactSales } from "@/utils/helpEmail";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SALES_EMAIL = "sales@whonow.co";

function buildMailtoUrl(name: string, email: string, message: string): string {
  const subject = encodeURIComponent("WhoNow Sales Inquiry");
  const body = encodeURIComponent(
    [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      "Message:",
      message.trim() || "(No message provided)",
    ].join("\n")
  );
  return `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`;
}

interface ContactSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactSalesDialog({
  open,
  onOpenChange,
}: ContactSalesDialogProps) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameTrimmed = name.trim();
  const emailTrimmed = email.trim();
  const canSend = nameTrimmed.length > 0 && emailTrimmed.length > 0;

  const handleSubmit = async () => {
    if (!canSend) {
      if (!nameTrimmed) toast.error("Name is required");
      else if (!emailTrimmed) toast.error("Email is required");
      return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await sendContactSales({
        name: nameTrimmed,
        email: emailTrimmed,
        body: message.trim(),
      });

      if (result.success) {
        toast.success("Message sent. Our sales team will get back to you soon.");
        setMessage("");
        onOpenChange(false);
      } else if (result.useMailto) {
        window.location.href = buildMailtoUrl(nameTrimmed, emailTrimmed, message);
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Failed to send message");
      }
    } catch (err) {
      console.error("Contact sales error:", err);
      // Fallback: open mailto so user can still send
      window.location.href = buildMailtoUrl(nameTrimmed, emailTrimmed, message);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isSubmitting) {
      setMessage("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="contact-sales-description">
        <DialogHeader>
          <DialogTitle>Contact Sales</DialogTitle>
          <DialogDescription id="contact-sales-description" className="sr-only">
            Send a sales inquiry with your name, email, and message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="sales-name">Name (required)</Label>
            <Input
              id="sales-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-email">Email (required)</Label>
            <Input
              id="sales-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sales-message">Message</Label>
            <Textarea
              id="sales-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us about your organization or what you're looking for..."
              rows={4}
              className="resize-none"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSend}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              "Send message"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
