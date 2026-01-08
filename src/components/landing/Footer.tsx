import { WhoNowLogo } from "@/components/WhoNowLogo";
import { useBranding } from "@/hooks/useBranding";

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const branding = useBranding();

  return (
    <footer className="py-12 border-t border-border bg-muted/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <WhoNowLogo size="sm" showText={false} />
            <span className="font-display font-semibold text-foreground">{branding.companyName || "WhoNow"}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {currentYear} {branding.companyName || "WhoNow"}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
