import React, { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { BrandingTheme } from "@/components/BrandingTheme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IS_WAITLIST_MODE_EFFECTIVE, isDesktopOrNativeApp } from "@/utils/launchMode";
import { pushErrorLog } from "@/utils/errorLogBuffer";
import { devLog } from "@/lib/devLog";

const RouteFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));
const Waitlist = lazy(() => import("./pages/Waitlist"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const ImportContactPage = lazy(() => import("./pages/ImportContactPage"));
const ExportSharedContactPage = lazy(() => import("./pages/ExportSharedContactPage"));
const HelpFAQPage = lazy(() => import("./pages/HelpFAQPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      gcTime: 5 * 60_000, // 5 minutes (formerly cacheTime)
      onError: (error) => {
        pushErrorLog(error instanceof Error ? error.message : String(error));
        toast.error("Something went wrong. Please try again.");
      },
    },
    mutations: {
      onError: (error) => {
        pushErrorLog(error instanceof Error ? error.message : String(error));
        toast.error("Something went wrong. Please try again.");
      },
    },
  },
});

// Protected route wrapper: requires a signed-in user with verified email.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const isNative = isDesktopOrNativeApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    // In desktop/native apps, redirect to /auth so users can sign back in
    if (isNative) {
      return <Navigate to="/auth" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Enforce email verification in-app (Supabase may have "Confirm email" off, which still issues sessions)
  if (!user.email_confirmed_at) {
    return <Navigate to="/auth?unverified=1" replace />;
  }

  return <>{children}</>;
};

// In waitlist mode, always render the Auth page at /auth so the email verification and
// password-reset links (which redirect to /auth with token in hash) work. Otherwise
// we'd redirect to / and the token would never be processed.
const AuthRouteInWaitlistMode = () => (
  <Suspense fallback={<RouteFallback />}>
    <Auth />
  </Suspense>
);

// Waitlist mode route guard - redirects non-public routes to home
// Respects development mode (bypasses restrictions in dev)
const WaitlistRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  if (IS_WAITLIST_MODE_EFFECTIVE) {
    // Public routes allowed in waitlist mode (include shared-contact links so Slack links still open)
    const publicRoutes = ["/", "/waitlist", "/privacy", "/terms", "/import-contact", "/export-shared-contact", "/auth"];
    const isPublicRoute = publicRoutes.includes(location.pathname);
    if (!isPublicRoute) {
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

// Component to handle desktop/native app root redirect
const DesktopAppRootRedirect = () => {
  const [isNative, setIsNative] = React.useState(false);
  
  // Check for native app after component mounts (Tauri globals may not be available immediately)
  React.useEffect(() => {
    const checkNative = () => {
      const detected = isDesktopOrNativeApp();
      devLog('[DesktopAppRootRedirect] Native detection result:', detected);
      setIsNative(detected);
    };
    
    // Check immediately
    checkNative();
    
    // Also check after a short delay in case Tauri hasn't initialized yet
    const timeout = setTimeout(checkNative, 100);
    
    return () => clearTimeout(timeout);
  }, []);
  
  // In desktop/native apps, redirect root path to /app
  if (isNative && !IS_WAITLIST_MODE_EFFECTIVE) {
    devLog('[DesktopAppRootRedirect] Redirecting to /app');
    return <Navigate to="/app" replace />;
  }
  
  // Otherwise show landing page
  devLog('[DesktopAppRootRedirect] Showing landing page, isNative:', isNative);
  return (
    <Suspense fallback={<RouteFallback />}>
      <Landing />
    </Suspense>
  );
};

const AppRoutes = () => {
  return (
    <>
      <BrandingTheme />
      <WaitlistRouteGuard>
        <Routes>
          {IS_WAITLIST_MODE_EFFECTIVE ? (
            <>
              <Route path="/" element={<Suspense fallback={<RouteFallback />}><Waitlist /></Suspense>} />
              <Route path="/waitlist" element={<Suspense fallback={<RouteFallback />}><Waitlist /></Suspense>} />
              <Route path="/privacy" element={<Suspense fallback={<RouteFallback />}><Privacy /></Suspense>} />
              <Route path="/terms" element={<Suspense fallback={<RouteFallback />}><Terms /></Suspense>} />
              <Route path="/import-contact" element={<Suspense fallback={<RouteFallback />}><ImportContactPage /></Suspense>} />
              <Route path="/export-shared-contact" element={<Suspense fallback={<RouteFallback />}><ExportSharedContactPage /></Suspense>} />
              {/* Block all other routes in waitlist mode; allow /auth when it's an email verification or password-reset callback */}
              <Route path="/app" element={<Navigate to="/" replace />} />
              <Route path="/auth" element={<AuthRouteInWaitlistMode />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<DesktopAppRootRedirect />} />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteFallback />}>
                      <Index />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/help/faq"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<RouteFallback />}>
                      <HelpFAQPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="/privacy" element={<Suspense fallback={<RouteFallback />}><Privacy /></Suspense>} />
              <Route path="/terms" element={<Suspense fallback={<RouteFallback />}><Terms /></Suspense>} />
              <Route path="/auth" element={<Suspense fallback={<RouteFallback />}><Auth /></Suspense>} />
              <Route path="/import-contact" element={<Suspense fallback={<RouteFallback />}><ImportContactPage /></Suspense>} />
              <Route path="/export-shared-contact" element={<Suspense fallback={<RouteFallback />}><ExportSharedContactPage /></Suspense>} />
              <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
            </>
          )}
        </Routes>
      </WaitlistRouteGuard>
    </>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
