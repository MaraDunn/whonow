import { useState } from "react";
import { Sparkles, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const WaitlistHeroSection = () => {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      // Debug: Log config status
      console.log("🔍 Waitlist Config Check:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseAnonKey,
        urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : "❌ MISSING",
        keyPreview: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : "❌ MISSING",
        keyLength: supabaseAnonKey?.length || 0,
      });
      
      if (!supabaseUrl || !supabaseAnonKey) {
        const errorMsg = `Supabase configuration missing. URL: ${supabaseUrl ? '✓' : '✗'}, Key: ${supabaseAnonKey ? '✓' : '✗'}`;
        console.error("❌", errorMsg);
        throw new Error(errorMsg);
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        // If response is not JSON, get text instead
        const text = await response.text();
        throw new Error(`Server error: ${text || response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to join waitlist (${response.status})`);
      }

      setIsSuccess(true);
      setEmail("");
      toast.success("Successfully joined the waitlist!");
    } catch (error) {
      console.error("Waitlist submission error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to join waitlist. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (isSuccess) {
      setIsSuccess(false);
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center pt-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 border border-primary/20 mb-8 animate-fade-in">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Built for modern teams</span>
        </div>

        {/* Main headline */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Find who you need,{" "}
          <span className="text-gradient">when you need them</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          Reduce friction, boost productivity—connect with the right people across your organization instantly.
        </p>

        {/* Waitlist Form */}
        <div className="max-w-md mx-auto animate-fade-in" style={{ animationDelay: "0.3s" }}>
          {isSuccess ? (
            <div className="text-center space-y-4 p-6 bg-card rounded-2xl border border-border shadow-lg">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  You're on the list!
                </h3>
                <p className="text-muted-foreground">
                  We'll notify you as soon as we launch.
                </p>
              </div>
              <Button
                onClick={() => {
                  setIsSuccess(false);
                  setEmail("");
                }}
                variant="outline"
                className="mt-4"
              >
                Add Another Email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={handleEmailChange}
                    className="pl-10 h-12 text-base"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="gradient-hero text-primary-foreground px-8 h-12 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Joining...
                    </span>
                  ) : (
                    "Join Waitlist"
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Be the first to know when we launch
              </p>
            </form>
          )}
        </div>

        {/* Stats or social proof */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto animate-fade-in" style={{ animationDelay: "0.4s" }}>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">10x</div>
            <div className="text-sm text-muted-foreground">Faster search</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">100%</div>
            <div className="text-sm text-muted-foreground">Team visibility</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">0</div>
            <div className="text-sm text-muted-foreground">Setup friction</div>
          </div>
        </div>
      </div>
    </section>
  );
};
