import { LandingNav } from "@/components/landing/LandingNav";
import { WaitlistHeroSection } from "@/components/landing/WaitlistHeroSection";
import { ValueProps } from "@/components/landing/ValueProps";
import { ProductDemo } from "@/components/landing/ProductDemo";
import { WaitlistPricingSection } from "@/components/landing/WaitlistPricingSection";
import { TrustSection } from "@/components/landing/TrustSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { WaitlistCTASection } from "@/components/landing/WaitlistCTASection";
import { Footer } from "@/components/landing/Footer";

const Waitlist = () => {
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
