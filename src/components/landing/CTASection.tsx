import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface CTASectionProps {
  onGetStarted: () => void;
}

export const CTASection = ({ onGetStarted }: CTASectionProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <section className="py-24 sm:py-32 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl" />
          
          <div className="relative bg-card rounded-3xl p-12 sm:p-16 shadow-card border border-border">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Stop losing track of the people who matter.
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              WhoNow gives you instant recall, relationship health visibility, and proactive follow-up memory — all without the complexity of a CRM.
            </p>
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
              <Button
                size="lg"
                onClick={onGetStarted}
                className="gradient-hero text-primary-foreground px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
