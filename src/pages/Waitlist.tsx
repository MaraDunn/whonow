import { LandingNav } from "@/components/landing/LandingNav";
import { WaitlistHeroSection } from "@/components/landing/WaitlistHeroSection";
import { ValueProps } from "@/components/landing/ValueProps";
import { ProductDemo } from "@/components/landing/ProductDemo";
import { WaitlistPricingSection } from "@/components/landing/WaitlistPricingSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { WaitlistCTASection } from "@/components/landing/WaitlistCTASection";
import { Footer } from "@/components/landing/Footer";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const Waitlist = () => {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, "");
    if (!hash) return;

    // Defer until after paint so the section exists in the DOM.
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    });
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background">
      <LandingNav onSignIn={() => {}} onGetStarted={() => {}} />
      
      <main>
        <WaitlistHeroSection />
        <ValueProps />
        <ProductDemo />
        <WaitlistPricingSection />
        <TrustSection />
        <FAQSection />
        <WaitlistCTASection />
      </main>

      <Footer />
    </div>
  );
};

export default Waitlist;
