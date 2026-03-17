/// <reference types="vite/client" />

interface Window {
  fbq?: (action: string, ...args: unknown[]) => void;
}
