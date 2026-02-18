import { useState } from "react";
import { Monitor, Smartphone, Download, ExternalLink, BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectPlatform,
  getDownloadUrl,
  type Platform,
} from "@/utils/downloadLinks";
import { useReleaseDownloads } from "@/hooks/useReleaseDownloads";
import { AddToHomeScreenDialog } from "@/components/landing/AddToHomeScreenDialog";

/** Set to false when release downloads are ready to be offered. */
const DOWNLOADS_COMING_SOON = true;

/** Desktop download URL: runtime (GitHub release) if set, else env fallback. */
function getDesktopDownloadUrl(
  platform: Platform,
  releaseUrls: Partial<Record<Platform, string>>
): string | null {
  return releaseUrls[platform] ?? getDownloadUrl(platform) ?? null;
}

interface PlatformConfig {
  platform: Platform;
  icon: typeof Monitor;
  label: string;
  description: string;
  isMobile: boolean;
}

const platforms: PlatformConfig[] = [
  {
    platform: "windows",
    icon: Monitor,
    label: "Windows",
    description: "Download for Windows",
    isMobile: false,
  },
  {
    platform: "mac",
    icon: Monitor,
    label: "macOS",
    description: "Download for Mac",
    isMobile: false,
  },
  {
    platform: "linux",
    icon: Monitor,
    label: "Linux",
    description: "Download for Linux",
    isMobile: false,
  },
  {
    platform: "ios",
    icon: Smartphone,
    label: "iOS",
    description: "Available on App Store",
    isMobile: true,
  },
  {
    platform: "android",
    icon: Smartphone,
    label: "Android",
    description: "Available on Play Store",
    isMobile: true,
  },
];

export const DownloadSection = () => {
  const currentPlatform = detectPlatform();
  const [addToHomeDialogOpen, setAddToHomeDialogOpen] = useState(false);
  const { releaseUrls, loading: releasesLoading } = useReleaseDownloads();

  const getUrl = (platform: Platform, isMobile: boolean) =>
    isMobile ? getDownloadUrl(platform) : getDesktopDownloadUrl(platform, releaseUrls);

  const handleDownload = (platform: Platform, isMobile: boolean) => {
    const url = getUrl(platform, isMobile);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const desktopPlatforms = platforms.filter((p) => !p.isMobile);
  const mobilePlatforms = platforms.filter((p) => p.isMobile);

  return (
    <section id="downloads" className="py-24 sm:py-32 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Download WhoNow
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Native apps for desktop and mobile are coming soon. We’re making sure everything works perfectly before release.
          </p>
        </div>

        {/* Desktop Downloads */}
        <div className="mb-16">
          <h3 className="text-xl font-semibold mb-8 text-center text-foreground">
            Desktop Apps
          </h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {desktopPlatforms.map((platformConfig) => {
              const { platform, icon: Icon, label, description } = platformConfig;
              const url = getUrl(platform, false);
              const isAvailable = !DOWNLOADS_COMING_SOON && !!url;
              const isCurrentPlatform = currentPlatform === platform;
              const isLoading = !DOWNLOADS_COMING_SOON && releasesLoading && !getDownloadUrl(platform);

              return (
                <div
                  key={platform}
                  className={`group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border ${
                    isCurrentPlatform
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border/50"
                  } animate-fade-in`}
                >
                  {/* Current platform badge */}
                  {isCurrentPlatform && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                      Your Platform
                    </div>
                  )}

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>

                  {/* Content */}
                  <h4 className="font-display text-lg font-semibold mb-2 text-foreground">
                    {label}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {description}
                  </p>

                  {/* Download Button */}
                  {isAvailable ? (
                    <Button
                      onClick={() => handleDownload(platform, false)}
                      className="w-full gradient-hero text-primary-foreground hover:shadow-lg transition-shadow"
                      size="sm"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  ) : isLoading ? (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      Coming Soon
                    </Button>
                  )}

                  {/* Hover glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile Downloads + Add to Home Screen */}
        <div>
          <h3 className="text-xl font-semibold mb-8 text-center text-foreground">
            Mobile Apps
          </h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {mobilePlatforms.map((platformConfig) => {
              const { platform, icon: Icon, label, description } = platformConfig;
              const url = getUrl(platform, true);
              const isAvailable = !DOWNLOADS_COMING_SOON && !!url;
              const isCurrentPlatform = currentPlatform === platform;

              return (
                <div
                  key={platform}
                  className={`group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border ${
                    isCurrentPlatform
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border/50"
                  } animate-fade-in`}
                >
                  {/* Current platform badge */}
                  {isCurrentPlatform && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                      Your Platform
                    </div>
                  )}

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>

                  {/* Content */}
                  <h4 className="font-display text-lg font-semibold mb-2 text-foreground">
                    {label}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    {description}
                  </p>

                  {/* App Store Button */}
                  {isAvailable ? (
                    <Button
                      onClick={() => handleDownload(platform, true)}
                      className="w-full gradient-hero text-primary-foreground hover:shadow-lg transition-shadow"
                      size="sm"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View in Store
                    </Button>
                  ) : (
                    <Button
                      disabled
                      variant="outline"
                      className="w-full"
                      size="sm"
                    >
                      Coming Soon
                    </Button>
                  )}

                  {/* Hover glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              );
            })}
            {/* Add to Home Screen - bookmark / PWA icon without native app */}
            <div className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50 animate-fade-in">
              <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <BookmarkPlus className="h-6 w-6 text-primary-foreground" />
              </div>
              <h4 className="font-display text-lg font-semibold mb-2 text-foreground">
                Add to Home Screen
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Get a WhoNow icon on your phone or desktop. No app store required.
              </p>
              <Button
                onClick={() => setAddToHomeDialogOpen(true)}
                className="w-full gradient-hero text-primary-foreground hover:shadow-lg transition-shadow"
                size="sm"
              >
                <BookmarkPlus className="mr-2 h-4 w-4" />
                Add to Home Screen
              </Button>
              <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
      <AddToHomeScreenDialog
        open={addToHomeDialogOpen}
        onOpenChange={setAddToHomeDialogOpen}
      />
    </section>
  );
};
