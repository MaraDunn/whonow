import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useBranding } from "@/hooks/useBranding";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { hexToHsl, getContrastingForeground, ensureReadableColor, getContrastRatio } from "@/utils/colorUtils";

/**
 * Component that applies custom brand colors to CSS variables
 * This should be placed at the root of the app to apply branding globally
 * IMPORTANT: Branding only applies to the app routes, not the landing page
 */
export function BrandingTheme() {
  const location = useLocation();
  const branding = useBranding();
  const { user } = useAuth();
  const { company, profile } = useProfile(user?.id);

  useEffect(() => {
    const root = document.documentElement;
    
    // CRITICAL: Branding should NOT apply to the landing page
    // Only apply branding on app routes (e.g., /app or any route that's not the root landing page)
    const isLandingPage = location.pathname === "/";
    
    // CRITICAL: Verify user belongs to company before applying branding
    // This prevents branding from leaking to users outside the organization
    const userBelongsToCompany = user && profile && company && profile.companyId === company.id;
    const shouldApplyBranding = !isLandingPage && userBelongsToCompany && (branding.primaryColor || branding.secondaryColor);
    
    const updateTheme = () => {
      const isDark = root.classList.contains("dark");
      
      // Get card background color for contrast calculations
      const cardBg = isDark ? "220 25% 11%" : "0 0% 100%";
      
      // Always reset branding on landing page
      if (isLandingPage) {
        root.style.removeProperty("--primary");
        root.style.removeProperty("--primary-foreground");
        root.style.removeProperty("--ring");
        root.style.removeProperty("--gradient-hero");
        root.style.removeProperty("--shadow-card-hover");
        root.style.removeProperty("--shadow-search");
        root.style.removeProperty("--secondary");
        root.style.removeProperty("--secondary-foreground");
        return;
      }
      
      // Only apply branding if user belongs to the company
      if (shouldApplyBranding && branding.primaryColor) {
      // Ensure primary color is readable (adjust if needed)
      let primaryHsl = hexToHsl(branding.primaryColor);
      primaryHsl = ensureReadableColor(primaryHsl, true, 4.5);
      
      // Calculate contrasting foreground with WCAG compliance
      const primaryForeground = getContrastingForeground(primaryHsl, 4.5);
      
        // Update primary color variables (applies to both light and dark modes)
        root.style.setProperty("--primary", primaryHsl);
        root.style.setProperty("--primary-foreground", primaryForeground);
        root.style.setProperty("--ring", primaryHsl);
        
        // Update gradient to use primary color
        const [h, s, l] = primaryHsl.split(" ");
        const hNum = parseInt(h);
        const sNum = parseInt(s.replace("%", ""));
        const lNum = parseInt(l.replace("%", ""));
        
        // Create a complementary color for gradient (shift hue by ~20 degrees)
        const gradientH = (hNum + 20) % 360;
        const gradientHsl = `${gradientH} ${sNum}% ${Math.min(lNum + 10, 100)}%`;
        
        root.style.setProperty(
          "--gradient-hero",
          `linear-gradient(135deg, hsl(${primaryHsl}) 0%, hsl(${gradientHsl}) 100%)`
        );
        
        // Update shadows to use primary color
        root.style.setProperty(
          "--shadow-card-hover",
          `0 12px 32px -8px hsl(${primaryHsl} / 0.15), 0 4px 12px -4px hsl(220 25% 10% / 0.08)`
        );
        root.style.setProperty(
          "--shadow-search",
          `0 8px 40px -8px hsl(${primaryHsl} / 0.2), 0 4px 16px -4px hsl(220 25% 10% / 0.06)`
        );
      } else {
        // Reset to defaults if no custom primary color or user doesn't belong to company
        root.style.removeProperty("--primary");
        root.style.removeProperty("--primary-foreground");
        root.style.removeProperty("--ring");
        root.style.removeProperty("--gradient-hero");
        root.style.removeProperty("--shadow-card-hover");
        root.style.removeProperty("--shadow-search");
      }
      
      // Only apply secondary color if user belongs to company
      if (shouldApplyBranding && branding.secondaryColor) {
        // Ensure secondary color is readable (adjust if needed)
        let secondaryHsl = hexToHsl(branding.secondaryColor);
        secondaryHsl = ensureReadableColor(secondaryHsl, true, 4.5);
        
        // Calculate contrasting foreground with WCAG compliance
        // This ensures text/icons on secondary background are readable
        const secondaryForeground = getContrastingForeground(secondaryHsl, 4.5);
        
        // Update secondary color variables
        root.style.setProperty("--secondary", secondaryHsl);
        root.style.setProperty("--secondary-foreground", secondaryForeground);
      } else {
        // Reset secondary color if user doesn't belong to company or no custom secondary
        if (!shouldApplyBranding) {
          root.style.removeProperty("--secondary");
        }
        // Use safe defaults that work well on secondary backgrounds
        // Light mode: secondary is light gray, so use dark text
        // Dark mode: secondary is dark gray, so use light text
        const defaultSecondaryFg = isDark ? "220 10% 85%" : "220 25% 20%";
        root.style.setProperty("--secondary-foreground", defaultSecondaryFg);
      }
      
      // CRITICAL: Ensure muted-foreground always has good contrast against card background
      // This is used extensively in contact cards and must be readable
      // Use a color that works well on both light and dark card backgrounds
      const mutedForegroundLight = "220 10% 50%"; // Default light mode - good contrast on white cards
      const mutedForegroundDark = "220 10% 65%"; // Lighter for dark mode (better contrast on dark cards)
      root.style.setProperty("--muted-foreground", isDark ? mutedForegroundDark : mutedForegroundLight);
    };
    
    // Initial update
    updateTheme();
    
    // Watch for theme changes (dark mode toggle)
    const observer = new MutationObserver(() => {
      updateTheme();
    });
    
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Cleanup function
    return () => {
      observer.disconnect();
      // Reset all branding on cleanup to prevent leaks
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--gradient-hero");
      root.style.removeProperty("--shadow-card-hover");
      root.style.removeProperty("--shadow-search");
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--secondary-foreground");
    };
  }, [branding.primaryColor, branding.secondaryColor, user?.id, profile?.companyId, company?.id, location.pathname]);

  // This component doesn't render anything
  return null;
}

