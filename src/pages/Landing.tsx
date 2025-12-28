import { useState } from "react";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { ValueProps } from "@/components/landing/ValueProps";
import { ProductDemo } from "@/components/landing/ProductDemo";
import { PricingSection } from "@/components/landing/PricingSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";
import { AuthModal } from "@/components/landing/AuthModal";

const Landing = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signin");

  const openSignIn = () => {
    setAuthModalTab("signin");
    setAuthModalOpen(true);
  };

  const openSignUp = () => {
    setAuthModalTab("signup");
    setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <LandingNav onSignIn={openSignIn} onGetStarted={openSignUp} />
      
      <main>
        <HeroSection onSignIn={openSignIn} onGetStarted={openSignUp} />
        <ValueProps />
        <ProductDemo />
        <PricingSection onGetStarted={openSignUp} />
        <TrustSection />
        <CTASection onGetStarted={openSignUp} />
      </main>

      <Footer />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
      />
    </div>
  );
};

export default Landing;
