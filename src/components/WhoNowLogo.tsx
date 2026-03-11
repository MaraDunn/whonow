import { useBranding } from "@/hooks/useBranding";

interface WhoNowLogoProps {
  /** "icon" = icon only (optionally with text); "full" = icon + wordmark image from branding */
  variant?: "icon" | "full";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

/** Icon-only sizes (2x scale from base) */
const iconSizeClasses = {
  sm: "h-20 w-20",
  md: "h-32 w-32",
  lg: "h-40 w-40",
};

/** Full logo height (2x scale from base) */
const fullLogoHeightClasses = {
  sm: "h-28",
  md: "h-32",
  lg: "h-40",
};

const textSizes = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
};

export function WhoNowLogo({
  variant = "icon",
  size = "md",
  showText = true,
  className = "",
}: WhoNowLogoProps) {
  const branding = useBranding();
  const companyName = branding.companyName || "WhoNow";

  // Full logo (icon + wordmark): single image for headers, OG
  if (variant === "full") {
    const fullSrc = branding.logoFull || branding.logo;
    return (
      <img
        src={fullSrc}
        alt={companyName}
        className={`${fullLogoHeightClasses[size]} w-auto shrink-0 object-contain object-left ${className}`}
        title={companyName}
      />
    );
  }

  // Icon only (optionally with rendered text) — favicon-style, compact UI
  const nameParts =
    companyName.toLowerCase() === "whonow"
      ? { first: "Who", rest: "Now" }
      : { first: companyName, rest: "" };

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <img
        src={branding.logo}
        alt={companyName}
        className={`${iconSizeClasses[size]} shrink-0 object-contain`}
      />
      {showText && (
        <span
          className={`font-display font-bold truncate ${textSizes[size]}`}
          title={companyName}
        >
          <span className="text-foreground">{nameParts.first}</span>
          {nameParts.rest && <span className="text-gradient">{nameParts.rest}</span>}
        </span>
      )}
    </div>
  );
}
