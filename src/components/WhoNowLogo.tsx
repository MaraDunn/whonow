import whonowLogo from "@/assets/whonow-logo.png";

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
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={whonowLogo}
        alt="WhoNow Logo"
        className={`${sizeClasses[size]} object-contain`}
      />
      {showText && (
        <span className={`font-display font-bold ${textSizes[size]} text-foreground`}>
          WhoNow
        </span>
      )}
    </div>
  );
}
