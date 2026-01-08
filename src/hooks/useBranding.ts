import { useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { FEATURE_ACCESS } from "@/types/subscription";
import whonowLogo from "@/assets/whonow-logo.png";

export interface BrandingAssets {
  logo: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
}

/**
 * Hook to get branding assets for the current organization.
 * Returns custom branding if available (business tier), otherwise defaults to WhoNow branding.
 * IMPORTANT: Only returns branding for the user's own company to prevent cross-organization branding leaks.
 */
export function useBranding(): BrandingAssets {
  const { user } = useAuth();
  const { company, profile } = useProfile(user?.id);
  const { tier } = useSubscription();

  const hasCustomBranding = useMemo(() => {
    // Verify user actually belongs to the company before applying branding
    // This prevents branding from one organization affecting users in another
    const userBelongsToCompany = user && profile && company && profile.companyId === company.id;
    
    // Custom branding is available if:
    // 1. User has business tier subscription
    // 2. User actually belongs to the company (security check)
    // 3. Company has branding assets configured
    return FEATURE_ACCESS.custom_branding.includes(tier) && 
           userBelongsToCompany &&
           company && 
           (company.logoUrl || company.primaryColor || company.secondaryColor);
  }, [tier, company, profile, user]);

  return useMemo(() => {
    // Double-check user belongs to company before returning branding
    const userBelongsToCompany = user && profile && company && profile.companyId === company.id;
    
    if (hasCustomBranding && company && userBelongsToCompany) {
      return {
        logo: company.logoUrl || whonowLogo, // Fallback to default logo if not set
        favicon: company.faviconUrl,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        companyName: company.name,
      };
    }

    // Default WhoNow branding (always return this if user doesn't belong to company or no branding)
    return {
      logo: whonowLogo,
      companyName: "WhoNow",
    };
  }, [hasCustomBranding, company, profile, user]);
}

