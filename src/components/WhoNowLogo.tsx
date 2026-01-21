import { useBranding } from "@/hooks/useBranding";

interface WhoNowLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-20 w-20",
};

const textSizes = {
  sm: "text-xl",
  md: "text-3xl",
  lg: "text-4xl",
};

export function WhoNowLogo({ size = "md", showText = true, className = "" }: WhoNowLogoProps) {
  const branding = useBranding();
  const companyName = branding.companyName || "WhoNow";
  
  // Split company name: "Who" in white, "Now" with gradient
  // For custom company names, use the whole name but apply styling to appropriate parts
  const nameParts = companyName.toLowerCase() === "whonow" 
    ? { first: "Who", rest: "Now" }
    : { first: companyName, rest: "" };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={branding.logo}
        alt={branding.companyName || "Logo"}
        className={`${sizeClasses[size]} object-contain`}
      />
      {showText && (
        <span className={`font-display font-bold ${textSizes[size]}`}>
          <span className="text-foreground">{nameParts.first}</span>
          {nameParts.rest && <span className="text-gradient">{nameParts.rest}</span>}
        </span>
      )}
    </div>
  );
}
