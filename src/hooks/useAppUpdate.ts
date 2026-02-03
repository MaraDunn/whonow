import { useCallback, useState } from "react";
import { isDesktopOrNativeApp } from "@/utils/launchMode";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string | null;
  date?: string | null;
}

export function useAppUpdate() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (!isDesktopOrNativeApp()) return;
    setIsChecking(true);
    setError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const updateResult = await check();
      if (updateResult) {
        setUpdate({
          version: updateResult.version,
          currentVersion: updateResult.currentVersion,
          body: updateResult.body ?? null,
          date: updateResult.date ?? null,
        });
      } else {
        setUpdate(null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setUpdate(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(
    async (onProgress?: (percent: number) => void) => {
      if (!update || !isDesktopOrNativeApp()) return;
      setIsDownloading(true);
      setDownloadProgress(0);
      setError(null);
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const { relaunch } = await import("@tauri-apps/plugin-process");
        const updateResult = await check();
        if (!updateResult) {
          setError("Update no longer available");
          return;
        }
        let downloaded = 0;
        let contentLength: number | undefined;
        await updateResult.downloadAndInstall((event) => {
          switch (event.event) {
            case "Started":
              contentLength = event.data.contentLength ?? undefined;
              break;
            case "Progress":
              downloaded += event.data.chunkLength;
              if (contentLength != null && contentLength > 0) {
                const pct = Math.round((downloaded / contentLength) * 100);
                setDownloadProgress(pct);
                onProgress?.(pct);
              }
              break;
            case "Finished":
              setDownloadProgress(100);
              onProgress?.(100);
              break;
          }
        });
        await relaunch();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    },
    [update]
  );

  const dismissUpdate = useCallback(() => {
    setUpdate(null);
    setError(null);
  }, []);

  return {
    update,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
    canCheckUpdates: isDesktopOrNativeApp(),
  };
}
