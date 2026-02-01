import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, UserPlus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useContacts } from "@/hooks/useContacts";
import { Contact } from "@/types/contact";
import { WhoNowLogo } from "@/components/WhoNowLogo";
import { toast } from "sonner";

/** Payload returned by contact-share (camelCase). */
type ContactPayload = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  tags?: string[];
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lastContactedAt?: string;
  isClient?: boolean;
};

function payloadToContact(p: ContactPayload): Omit<Contact, "id"> {
  return {
    name: p.name ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    company: p.company ?? "",
    role: p.role ?? "",
    tags: Array.isArray(p.tags) ? p.tags : [],
    description: p.description ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    zipCode: p.zipCode ?? "",
    country: p.country ?? "",
    lastContactedAt: p.lastContactedAt ?? "",
    isClient: p.isClient === true,
  };
}

export default function ImportContactPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const { user, loading: authLoading } = useAuth();
  const { addContact } = useContacts();

  const [payload, setPayload] = useState<ContactPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing link");
      setLoading(false);
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!supabaseUrl) {
      setError("Configuration error");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetch(`${supabaseUrl}/functions/v1/contact-share?token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d?.error || "Invalid or expired link")));
        return res.json();
      })
      .then((data: ContactPayload) => {
        setPayload(data);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message || "Failed to load contact");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [token]);

  // Redirect to login if not authenticated (after we've tried to load so we know we have a valid token)
  useEffect(() => {
    if (authLoading || loading) return;
    if (user || error) return;
    if (!token) return;
    const redirect = `/import-contact?token=${encodeURIComponent(token)}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirect)}`, { replace: true });
  }, [authLoading, loading, user, error, token, navigate]);

  const handleAddToContacts = () => {
    if (!payload || !user) return;
    setSaving(true);
    addContact(payloadToContact(payload));
    toast.success("Contact added to WhoNow");
    setSaving(false);
    navigate("/app", { replace: true });
  };

  if (authLoading || (loading && token)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Loading shared contact…</p>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{error || "Invalid or expired link"}</span>
        </div>
        <Button variant="link" className="mt-4" onClick={() => navigate("/")}>
          Go to WhoNow
        </Button>
      </div>
    );
  }

  // No user and we're about to redirect to auth (or payload loaded and no user - redirect already happened)
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Redirecting to sign in…</p>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <WhoNowLogo size="lg" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add to WhoNow
            </CardTitle>
            <CardDescription>
              Someone shared this contact with you. Add it to your WhoNow to keep it in your directory.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <p className="font-medium">{payload.name}</p>
              {payload.email && <p className="text-sm text-muted-foreground">{payload.email}</p>}
              {payload.phone && <p className="text-sm text-muted-foreground">{payload.phone}</p>}
              {(payload.company || payload.role) && (
                <p className="text-sm text-muted-foreground">
                  {[payload.role, payload.company].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handleAddToContacts}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add to My Contacts
                </>
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/app")}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
