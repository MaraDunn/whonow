import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { HelpCircle, BookOpen, Bug, MessageCircle } from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenReport?: () => void;
  onOpenContact?: () => void;
}

export function HelpDialog({
  open,
  onOpenChange,
  onOpenReport,
  onOpenContact,
}: HelpDialogProps) {
  const handleReport = () => {
    onOpenChange(false);
    onOpenReport?.();
  };

  const handleContact = () => {
    onOpenChange(false);
    onOpenContact?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Help
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button variant="outline" className="justify-start gap-2" asChild>
            <Link to="/help/faq" onClick={() => onOpenChange(false)}>
              <BookOpen className="h-4 w-4" />
              View FAQ
            </Link>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={handleReport}
          >
            <Bug className="h-4 w-4" />
            Report a problem
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-2"
            onClick={handleContact}
          >
            <MessageCircle className="h-4 w-4" />
            Contact support
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
