import { useState } from "react";
import { LandingNav } from "@/components/landing/LandingNav";
import { HeroSection } from "@/components/landing/HeroSection";
import { ValueProps } from "@/components/landing/ValueProps";
import { DownloadSection } from "@/components/landing/DownloadSection";
import { ProductDemo } from "@/components/landing/ProductDemo";
import { PricingSection } from "@/components/landing/PricingSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FAQSection } from "@/components/landing/FAQSection";
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
        <DownloadSection />
        <PricingSection onGetStarted={openSignUp} />
        <TrustSection />
        <FAQSection />
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
