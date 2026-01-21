import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const location = useLocation();
  const navigate = useNavigate();
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

  useEffect(() => {
    // Handle cross-page navigation from /privacy (and others)
    // to open the auth modal or jump to a section.
    const state = (location.state ?? null) as null | { authModal?: "signin" | "signup" };

    if (state?.authModal) {
      setAuthModalTab(state.authModal);
      setAuthModalOpen(true);
      // Clear state so refresh/back doesn't re-open the modal.
      navigate(`${location.pathname}${location.hash}`, { replace: true, state: null });
    }

    const hash = location.hash?.replace(/^#/, "");
    if (!hash) return;

    // Defer until after paint so the section exists in the DOM.
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    });
  }, [location.hash, location.pathname, location.state, navigate]);

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
