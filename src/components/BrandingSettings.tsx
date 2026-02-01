import { useState, useRef, useEffect } from "react";
import { Upload, X, Palette, Image as ImageIcon, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBrandingUpload } from "@/hooks/useBrandingUpload";
import { useBranding } from "@/hooks/useBranding";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FEATURE_ACCESS } from "@/types/subscription";
import { FeatureGate } from "@/components/FeatureGate";
import { devLog } from "@/lib/devLog";

export function BrandingSettings() {
  const { user } = useAuth();
  const { company, isAdmin, profile } = useProfile(user?.id);
  const { tier } = useSubscription();
  const { uploadLogo, uploadFavicon, deleteBrandingAsset, uploading } = useBrandingUpload();
  const branding = useBranding();
  const queryClient = useQueryClient();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const [primaryColor, setPrimaryColor] = useState(company?.primaryColor || "");
  const [secondaryColor, setSecondaryColor] = useState(company?.secondaryColor || "");

  // Sync color state when company data changes
  useEffect(() => {
    if (company) {
      setPrimaryColor(company.primaryColor || "");
      setSecondaryColor(company.secondaryColor || "");
    }
  }, [company?.primaryColor, company?.secondaryColor]);

  const hasCustomBrandingAccess = FEATURE_ACCESS.custom_branding.includes(tier);

  const handleLogoUpload = async (file: File) => {
    if (!company || !isAdmin) return;

    const logoUrl = await uploadLogo(file);
    if (logoUrl) {
      const { error } = await supabase
        .from("companies")
        .update({ logo_url: logoUrl })
        .eq("id", company.id);

      if (error) {
        toast.error("Failed to save logo");
        console.error(error);
      } else {
        toast.success("Logo uploaded successfully");
        queryClient.invalidateQueries({ queryKey: ["company", company.id] });
      }
    }
  };

  const handleFaviconUpload = async (file: File) => {
    if (!company || !isAdmin) return;

    const faviconUrl = await uploadFavicon(file);
    if (faviconUrl) {
      const { error } = await supabase
        .from("companies")
        .update({ favicon_url: faviconUrl })
        .eq("id", company.id);

      if (error) {
        toast.error("Failed to save favicon");
        console.error(error);
      } else {
        toast.success("Favicon uploaded successfully");
        queryClient.invalidateQueries({ queryKey: ["company", company.id] });
      }
    }
  };

  const handleDeleteLogo = async () => {
    if (!company || !isAdmin || !company.logoUrl) return;

    const confirmed = window.confirm("Are you sure you want to remove the custom logo?");
    if (!confirmed) return;

    await deleteBrandingAsset(company.logoUrl);
    const { error } = await supabase
      .from("companies")
      .update({ logo_url: null })
      .eq("id", company.id);

    if (error) {
      toast.error("Failed to remove logo");
    } else {
      toast.success("Logo removed");
      queryClient.invalidateQueries({ queryKey: ["company", company.id] });
    }
  };

  const handleDeleteFavicon = async () => {
    if (!company || !isAdmin || !company.faviconUrl) return;

    const confirmed = window.confirm("Are you sure you want to remove the custom favicon?");
    if (!confirmed) return;

    await deleteBrandingAsset(company.faviconUrl);
    const { error } = await supabase
      .from("companies")
      .update({ favicon_url: null })
      .eq("id", company.id);

    if (error) {
      toast.error("Failed to remove favicon");
    } else {
      toast.success("Favicon removed");
      queryClient.invalidateQueries({ queryKey: ["company", company.id] });
    }
  };

  const handleSaveColors = async () => {
    if (!company || !isAdmin) {
      toast.error("You must be an admin to save colors");
      return;
    }

    // Validate hex colors if provided
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (primaryColor && primaryColor.trim() && !hexColorRegex.test(primaryColor.trim())) {
      toast.error("Primary color must be a valid hex color (e.g., #FF5733)");
      return;
    }
    if (secondaryColor && secondaryColor.trim() && !hexColorRegex.test(secondaryColor.trim())) {
      toast.error("Secondary color must be a valid hex color (e.g., #33FF57)");
      return;
    }

    // Normalize colors: trim whitespace, convert empty strings to null
    const normalizedPrimary = primaryColor?.trim() || null;
    const normalizedSecondary = secondaryColor?.trim() || null;

    devLog("Saving colors:", { 
      companyId: company.id, 
      primaryColor: normalizedPrimary, 
      secondaryColor: normalizedSecondary,
      isAdmin 
    });

    const { data, error } = await supabase
      .from("companies")
      .update({
        primary_color: normalizedPrimary,
        secondary_color: normalizedSecondary,
      })
      .eq("id", company.id)
      .select();

    if (error) {
      console.error("Error saving colors:", error);
      console.error("Error details:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast.error(`Failed to save colors: ${error.message || "Unknown error"}`);
    } else {
      devLog("Colors saved successfully:", data);
      
      // Update local state immediately with saved values for instant UI feedback
      if (data && data[0]) {
        const updatedCompany = data[0];
        setPrimaryColor(updatedCompany.primary_color || "");
        setSecondaryColor(updatedCompany.secondary_color || "");
      }
      
      toast.success("Colors saved successfully");
      
      // Invalidate all company-related queries to refresh the data
      // Note: useProfile uses ["company", profile?.companyId] as the key, which should match company.id
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["company"] }), // Invalidate all company queries
        queryClient.invalidateQueries({ queryKey: ["company", company.id] }), // Specific company (matches useProfile key)
        queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }) // Profile query that fetches company
      ]);
      
      // Force a refetch to ensure UI updates
      queryClient.refetchQueries({ queryKey: ["company", company.id] });
      queryClient.refetchQueries({ queryKey: ["profile", user?.id] });
    }
  };

  if (!company) {
    return null;
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Custom Branding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact your organization admin to manage branding settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <FeatureGate feature="custom_branding" showUpgradePrompt>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Custom Branding
          </CardTitle>
          <CardDescription>
            Upload your organization's logo, favicon, and brand colors (Business tier only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div className="space-y-3">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {company.logoUrl ? (
                <div className="relative">
                  <img
                    src={company.logoUrl}
                    alt="Company logo"
                    className="h-16 w-auto object-contain rounded border"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteLogo}
                    disabled={uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-16 w-32 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1">
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {company.logoUrl ? "Replace Logo" : "Upload Logo"}
                </Button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPEG, SVG, or WebP (max 5MB). Recommended: transparent PNG, 200x50px
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Favicon Upload */}
          <div className="space-y-3">
            <Label>Favicon</Label>
            <div className="flex items-center gap-4">
              {company.faviconUrl ? (
                <div className="relative">
                  <img
                    src={company.faviconUrl}
                    alt="Favicon"
                    className="h-8 w-8 object-contain rounded"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDeleteFavicon}
                    disabled={uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="h-8 w-8 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
              <div className="flex-1">
                <Button
                  variant="outline"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {company.faviconUrl ? "Replace Favicon" : "Upload Favicon"}
                </Button>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFaviconUpload(file);
                  }}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, ICO, or SVG (max 1MB). Recommended: 32x32px or 16x16px
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Brand Colors */}
          <div className="space-y-4">
            <Label>Brand Colors</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color" className="text-sm text-muted-foreground">
                  Primary Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={primaryColor || "#000000"}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-20 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    placeholder="#FF5733"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary-color" className="text-sm text-muted-foreground">
                  Secondary Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={secondaryColor || "#000000"}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-20 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    placeholder="#33FF57"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 font-mono"
                  />
                </div>
              </div>
            </div>
            <Button onClick={handleSaveColors} disabled={uploading} className="gap-2">
              <Check className="h-4 w-4" />
              Save Colors
            </Button>
            <p className="text-xs text-muted-foreground">
              Brand colors are used for theming throughout the application
            </p>
          </div>

          {uploading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Uploading...
            </div>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  );
}

