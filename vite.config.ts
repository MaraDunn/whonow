import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
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
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    waitlistMetaTags(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
