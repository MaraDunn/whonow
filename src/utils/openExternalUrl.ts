// src/utils/openExternalUrl.ts
export async function openExternalUrl(url: string): Promise<void> {
  if (typeof window !== "undefined" && (window as any).__TAURI__) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
