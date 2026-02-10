import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import type { Plugin } from "vite";

// Plugin to inject noindex meta tag in waitlist mode
function waitlistMetaTags(): Plugin {
  return {
    name: "waitlist-meta-tags",
    transformIndexHtml(html) {
      const isWaitlistMode = process.env.VITE_APP_LAUNCH_MODE === "waitlist";
      
      if (isWaitlistMode) {
        // Inject noindex, nofollow meta tag before closing head tag
        return html.replace(
          "</head>",
          '  <meta name="robots" content="noindex, nofollow" />\n  </head>'
        );
      }
      
      return html;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Check if running in Tauri mode
  const isTauri = process.env.TAURI_PLATFORM !== undefined;
  
  return {
    // In Tauri production builds, use a relative base so assets resolve correctly
    // from the custom protocol origin (avoids blank screen when /assets paths don't resolve).
    base: isTauri ? "./" : "/",
    server: {
      host: "::",
      port: 8080,
      // Tauri expects strict port and host configuration
      strictPort: isTauri,
      // Allow external connections for Tauri
      hmr: isTauri ? {
        protocol: "ws",
        host: "localhost",
        port: 8080,
      } : undefined,
    },
    // Clear screen on restart (useful for Tauri dev mode)
    clearScreen: false,
    // Environment variables prefix
    envPrefix: ["VITE_", "TAURI_"],
    plugins: [
      react(),
      waitlistMetaTags(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Build configuration works for both web and Tauri
    build: {
      // Tauri uses a custom protocol, so we don't need to worry about base path
      // Web builds continue to work as before
      target: process.env.TAURI_PLATFORM ? ["es2021", "chrome100", "safari13"] : undefined,
      rollupOptions: {
        // Web build (e.g. Netlify) doesn't have Tauri deps; avoid resolving plugin-shell
        external: (id) => id === "@tauri-apps/plugin-shell",
      },
    },
    // Optimize dependencies
    optimizeDeps: {
      exclude: ['onnxruntime-web'],
    },
    // Worker configuration for ONNX Runtime
    worker: {
      format: 'es',
    },
  };
});
