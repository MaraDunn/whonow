import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";

const Waitlist = () => {
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
      if (!supabaseUrl) {
        throw new Error("Supabase URL not configured");
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join waitlist");
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
    <div className="min-h-screen bg-background flex flex-col">
      <LandingNav onSignIn={() => {}} onGetStarted={() => {}} />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl font-bold">
                  Join the Waitlist
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  We're launching soon! Be the first to know when we go live.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              {isSuccess ? (
                <div className="text-center space-y-4 py-8">
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
                  <div className="space-y-2">
                    <Label htmlFor="waitlist-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="waitlist-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={handleEmailChange}
                        className="pl-10"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-hero text-primary-foreground"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining...
                      </span>
                    ) : (
                      "Join Waitlist"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Waitlist;
