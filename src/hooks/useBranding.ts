import { useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { FEATURE_ACCESS } from "@/types/subscription";
import whonowLogoIcon from "@/assets/whonow-logo-icon.png";
import whonowLogoFull from "@/assets/whonow-logo.png";
import whonowLogoIconLight from "@/assets/WhoNow-logo-icon-BW.png";
import whonowLogoFullLight from "@/assets/WhoNow-logo-BW.png";

export interface BrandingAssets {
  /** Icon only (square) — favicon, Tauri, Slack/email, compact UI (dark mode) */
  logo: string;
  /** Icon + wordmark — headers, OG image (dark mode) */
  logoFull?: string;
  /** Icon only for light mode */
  logoLight?: string;
  /** Icon + wordmark for light mode */
  logoFullLight?: string;
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;
  companyName?: string;
}

// Cache key for company branding data
const BRANDING_CACHE_KEY = "whonow_company_branding_cache";

// Get cached branding data for instant application
const getCachedBranding = (companyId?: string): Partial<BrandingAssets> | null => {
  if (!companyId) return null;
  try {
    const cached = localStorage.getItem(`${BRANDING_CACHE_KEY}_${companyId}`);
    if (cached) {
      // Cache is valid for 1 hour
      const cacheTime = localStorage.getItem(`${BRANDING_CACHE_KEY}_${companyId}_time`);
      if (cacheTime && Date.now() - parseInt(cacheTime) < 60 * 60 * 1000) {
        return JSON.parse(cached);
      }
    }
  } catch (error) {
    console.error("Failed to load cached branding:", error);
  }
  return null;
};

// Cache branding data for instant application on next load
const cacheBranding = (companyId?: string, branding?: BrandingAssets) => {
  if (!companyId) return;
  try {
    if (branding && (branding.primaryColor || branding.secondaryColor || branding.logo || branding.logoFull)) {
      localStorage.setItem(`${BRANDING_CACHE_KEY}_${companyId}`, JSON.stringify(branding));
      localStorage.setItem(`${BRANDING_CACHE_KEY}_${companyId}_time`, Date.now().toString());
    } else {
      localStorage.removeItem(`${BRANDING_CACHE_KEY}_${companyId}`);
      localStorage.removeItem(`${BRANDING_CACHE_KEY}_${companyId}_time`);
    }
  } catch (error) {
    console.error("Failed to cache branding:", error);
  }
};

/**
 * Hook to get branding assets for the current organization.
 * Returns custom branding if available (business tier), otherwise defaults to WhoNow branding.
 * IMPORTANT: 
 * - Only returns branding for the user's own company to prevent cross-organization branding leaks.
 * - Always returns default WhoNow branding on the landing page (/) to ensure consistent public-facing branding.
 */
export function useBranding(): BrandingAssets {
  const location = useLocation();
  const { user } = useAuth();
  const { company, profile } = useProfile(user?.id);
  const { tier } = useSubscription();

  // Always use default branding on landing page
  const isLandingPage = location.pathname === "/";
  
  // Get cached branding for instant application
  const cachedBranding = useMemo(() => {
    if (isLandingPage || !profile?.companyId) return null;
    return getCachedBranding(profile.companyId);
  }, [isLandingPage, profile?.companyId]);

  const hasCustomBranding = useMemo(() => {
    // Never apply custom branding on landing page
    if (isLandingPage) return false;
    
    // Verify user actually belongs to the company before applying branding
    // This prevents branding from one organization affecting users in another
    const userBelongsToCompany = user && profile && company && profile.companyId === company.id;
    
    // Custom branding is available if:
    // 1. Not on landing page
    // 2. User has business tier subscription
    // 3. User actually belongs to the company (security check)
    // 4. Company has branding assets configured
    return FEATURE_ACCESS.custom_branding.includes(tier) && 
           userBelongsToCompany &&
           company && 
           (company.logoUrl || company.primaryColor || company.secondaryColor);
  }, [tier, company, profile, user, isLandingPage]);

  // Cache branding when company data is loaded
  useEffect(() => {
    if (company?.id && profile?.companyId === company.id && hasCustomBranding) {
      const branding: BrandingAssets = {
        logo: company.logoUrl || whonowLogoIcon,
        logoFull: company.logoUrl || whonowLogoFull,
        logoLight: company.logoUrl || whonowLogoIconLight,
        logoFullLight: company.logoUrl || whonowLogoFullLight,
        favicon: company.faviconUrl,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        companyName: company.name,
      };
      cacheBranding(company.id, branding);
    }
  }, [company, profile, hasCustomBranding]);

  return useMemo(() => {
    // Always return default branding on landing page
    if (isLandingPage) {
      return {
        logo: whonowLogoIcon,
        logoFull: whonowLogoFull,
        logoLight: whonowLogoIconLight,
        logoFullLight: whonowLogoFullLight,
        companyName: "WhoNow",
      };
    }
    
    // Double-check user belongs to company before returning branding
    const userBelongsToCompany = user && profile && company && profile.companyId === company.id;
    
    // Use fresh company data if available, otherwise use cached data for instant display
    if (hasCustomBranding && company && userBelongsToCompany) {
      return {
        logo: company.logoUrl || whonowLogoIcon,
        logoFull: company.logoUrl || whonowLogoFull,
        logoLight: company.logoUrl || whonowLogoIconLight,
        logoFullLight: company.logoUrl || whonowLogoFullLight,
        favicon: company.faviconUrl,
        primaryColor: company.primaryColor,
        secondaryColor: company.secondaryColor,
        companyName: company.name,
      };
    }
    
    // If company data is still loading but we have cached branding, use it for instant display
    if (!company && cachedBranding && profile?.companyId && 
        (cachedBranding.primaryColor || cachedBranding.secondaryColor || cachedBranding.logo)) {
      return {
        logo: cachedBranding.logo || whonowLogoIcon,
        logoFull: cachedBranding.logoFull || whonowLogoFull,
        logoLight: cachedBranding.logoLight || whonowLogoIconLight,
        logoFullLight: cachedBranding.logoFullLight || whonowLogoFullLight,
        favicon: cachedBranding.favicon,
        primaryColor: cachedBranding.primaryColor,
        secondaryColor: cachedBranding.secondaryColor,
        companyName: cachedBranding.companyName || "WhoNow",
      };
    }

    // Default WhoNow branding (always return this if user doesn't belong to company or no branding)
    return {
      logo: whonowLogoIcon,
      logoFull: whonowLogoFull,
      logoLight: whonowLogoIconLight,
      logoFullLight: whonowLogoFullLight,
      companyName: "WhoNow",
    };
  }, [hasCustomBranding, company, profile, user, isLandingPage, cachedBranding]);
}

