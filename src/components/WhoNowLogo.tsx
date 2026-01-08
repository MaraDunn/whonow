import { useBranding } from "@/hooks/useBranding";

interface WhoNowLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-16 w-16",
};

const textSizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function WhoNowLogo({ size = "md", showText = true, className = "" }: WhoNowLogoProps) {
  const branding = useBranding();

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={branding.logo}
        alt={branding.companyName || "Logo"}
        className={`${sizeClasses[size]} object-contain`}
      />
      {showText && (
        <span className={`font-display font-bold ${textSizes[size]} text-foreground`}>
          {branding.companyName || "WhoNow"}
        </span>
      )}
    </div>
  );
}
