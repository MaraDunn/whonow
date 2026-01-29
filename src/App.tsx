import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { BrandingTheme } from "@/components/BrandingTheme";
import { IS_WAITLIST_MODE_EFFECTIVE, isDesktopOrNativeApp } from "@/utils/launchMode";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Waitlist from "./pages/Waitlist";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ImportContactPage from "./pages/ImportContactPage";
import ExportSharedContactPage from "./pages/ExportSharedContactPage";

const queryClient = new QueryClient();

// Protected route wrapper
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

  return <>{children}</>;
};

// Waitlist mode route guard - redirects non-public routes to home
// Respects development mode (bypasses restrictions in dev)
const WaitlistRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  if (IS_WAITLIST_MODE_EFFECTIVE) {
    // Public routes allowed in waitlist mode (include shared-contact links so Slack links still open)
    const publicRoutes = ["/", "/waitlist", "/privacy", "/terms", "/import-contact", "/export-shared-contact"];
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
      console.log('[DesktopAppRootRedirect] Native detection result:', detected);
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
    console.log('[DesktopAppRootRedirect] Redirecting to /app');
    return <Navigate to="/app" replace />;
  }
  
  // Otherwise show landing page
  console.log('[DesktopAppRootRedirect] Showing landing page, isNative:', isNative);
  return <Landing />;
};

const AppRoutes = () => {
  return (
    <>
      <BrandingTheme />
      <WaitlistRouteGuard>
        <Routes>
          {IS_WAITLIST_MODE_EFFECTIVE ? (
            <>
              <Route path="/" element={<Waitlist />} />
              <Route path="/waitlist" element={<Waitlist />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/import-contact" element={<ImportContactPage />} />
              <Route path="/export-shared-contact" element={<ExportSharedContactPage />} />
              {/* Block all other routes in waitlist mode */}
              <Route path="/app" element={<Navigate to="/" replace />} />
              <Route path="/auth" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<DesktopAppRootRedirect />} />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/import-contact" element={<ImportContactPage />} />
              <Route path="/export-shared-contact" element={<ExportSharedContactPage />} />
              <Route path="*" element={<NotFound />} />
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
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
