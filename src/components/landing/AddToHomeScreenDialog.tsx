import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAddToHomeScreen } from "@/hooks/useAddToHomeScreen";

/** Renders text with **bold** segments as <strong> */
function formatInstructions(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

interface AddToHomeScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToHomeScreenDialog({
  open,
  onOpenChange,
}: AddToHomeScreenDialogProps) {
  const { isStandalone, platform, instructions } = useAddToHomeScreen();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add WhoNow to your home screen</DialogTitle>
          <DialogDescription asChild>
            <p className="text-muted-foreground text-sm mt-1">
              {isStandalone
                ? "You're already using WhoNow from your home screen."
                : formatInstructions(instructions)}
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
