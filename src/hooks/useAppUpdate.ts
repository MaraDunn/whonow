import { useCallback, useMemo, useState } from "react";
import { isDesktopOrNativeApp } from "@/utils/launchMode";

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  body?: string | null;
  date?: string | null;
}

export function useAppUpdate() {
  const canCheckUpdates = useMemo(() => isDesktopOrNativeApp(), []);

  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    if (!canCheckUpdates) return;
    setIsChecking(true);
    setError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const res = await check();
      if (!res) {
        setUpdate(null);
        return;
      }
      setUpdate({
        version: res.version,
        currentVersion: res.currentVersion,
        body: res.body ?? null,
        date: res.date ?? null,
      });
    } catch (e) {
      setUpdate(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsChecking(false);
    }
  }, [canCheckUpdates]);

  const downloadAndInstall = useCallback(async () => {
    if (!canCheckUpdates || !update) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      // Re-check to get an Update object with download/install methods.
      const res = await check();
      if (!res) {
        setError("Update is no longer available.");
        return;
      }

      let downloaded = 0;
      let contentLength: number | undefined;
      await res.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? undefined;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength != null && contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setDownloadProgress(100);
            break;
        }
      });

      await relaunch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  }, [canCheckUpdates, update]);

  const dismissUpdate = useCallback(() => {
    setUpdate(null);
    setError(null);
  }, []);

  return {
    canCheckUpdates,
    update,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    checkForUpdates,
    downloadAndInstall,
    dismissUpdate,
  };
}

