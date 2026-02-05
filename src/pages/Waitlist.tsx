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
import { useLocation, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const Waitlist = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Email verified! You can sign in from the desktop app or when we launch.");
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("verified");
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
