import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WhoNowLogo } from "@/components/WhoNowLogo";

export default function ExportSharedContactPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing link");
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) {
      setError("Configuration error");
      return;
    }

    const url = `${supabaseUrl}/functions/v1/contact-share?token=${encodeURIComponent(token)}&format=csv`;
    const controller = new AbortController();

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || "Invalid or expired link");
        }
        const csv = await res.text();
        const disposition = res.headers.get("Content-Disposition");
        let filename = "contact.csv";
        if (disposition) {
          const match = /filename="?([^";\n]+)"?/.exec(disposition);
          if (match) filename = match[1].trim();
        }
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        setDone(true);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message || "Failed to download");
      });

    return () => controller.abort();
  }, [token]);

  // After download, redirect to app or home after a short delay
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate("/app", { replace: true }), 2000);
    return () => clearTimeout(t);
  }, [done, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
        <Button variant="link" className="mt-4" onClick={() => navigate("/")}>
          Go to WhoNow
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex justify-center mb-4">
          <WhoNowLogo size="lg" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileDown className="h-5 w-5" />
          <span>Download started. Redirecting to WhoNow…</span>
        </div>
        <Button variant="link" className="mt-4" onClick={() => navigate("/app")}>
          Go to app now
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex justify-center mb-4">
        <WhoNowLogo size="lg" />
      </div>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">Preparing CSV download…</p>
    </div>
  );
}
