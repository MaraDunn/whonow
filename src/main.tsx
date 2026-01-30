import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { pushErrorLog } from "@/utils/errorLogBuffer";

// Wire error log buffer for bug reports
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  pushErrorLog(msg);
  originalConsoleError.apply(console, args);
};
if (typeof window !== "undefined") {
  window.onerror = (message, _source, _lineno, _colno, error) => {
    const msg = error?.stack ?? String(message);
    pushErrorLog(msg);
    return false;
  };
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
