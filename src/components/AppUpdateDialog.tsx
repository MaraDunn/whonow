import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { UpdateInfo } from "@/hooks/useAppUpdate";

interface AppUpdateDialogProps {
  update: UpdateInfo;
  isDownloading: boolean;
  downloadProgress: number;
  onDownload: () => void;
  onDismiss: () => void;
}

export function AppUpdateDialog({
  update,
  isDownloading,
  downloadProgress,
  onDownload,
  onDismiss,
}: AppUpdateDialogProps) {
  return (
    <AlertDialog open={true}>
      <AlertDialogContent
        onPointerDownOutside={(e) => {
          if (isDownloading) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isDownloading) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Update available</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                A new version ({update.version}) is available. Would you like to download and install
                it?
              </p>
              {update.body ? (
                <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium text-foreground">What&apos;s new:</p>
                  <pre className="mt-1 whitespace-pre-wrap font-sans text-muted-foreground">
                    {update.body}
                  </pre>
                </div>
              ) : null}
              {isDownloading && (
                <div className="space-y-2 pt-2">
                  <Progress value={downloadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground">Downloading... {downloadProgress}%</p>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isDownloading ? (
            <p className="text-sm text-muted-foreground">
              Please wait for the download to complete...
            </p>
          ) : (
            <>
              <AlertDialogCancel onClick={onDismiss}>Later</AlertDialogCancel>
              <AlertDialogAction onClick={onDownload}>Download</AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
