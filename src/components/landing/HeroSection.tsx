import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface HeroSectionProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

export const HeroSection = ({ onSignIn, onGetStarted }: HeroSectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

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

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
          {user ? (
            <Button
              size="lg"
              onClick={() => navigate("/app")}
              className="gradient-hero text-primary-foreground px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              Launch App
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                onClick={onGetStarted}
                className="gradient-hero text-primary-foreground px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onSignIn}
                className="px-8 py-6 text-lg font-semibold"
              >
                Sign In
              </Button>
            </>
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
