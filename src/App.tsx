import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { BrandingTheme } from "@/components/BrandingTheme";
import { IS_WAITLIST_MODE } from "@/utils/launchMode";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import Waitlist from "./pages/Waitlist";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Waitlist mode route guard - redirects non-public routes to home
const WaitlistRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  if (IS_WAITLIST_MODE) {
    // Public routes allowed in waitlist mode
    const publicRoutes = ["/", "/waitlist", "/privacy", "/terms"];
    const isPublicRoute = publicRoutes.includes(location.pathname);
    
    if (!isPublicRoute) {
      return <Navigate to="/" replace />;
    }
  }
  
  return <>{children}</>;
};

const AppRoutes = () => (
  <>
    <BrandingTheme />
    <WaitlistRouteGuard>
      <Routes>
        {IS_WAITLIST_MODE ? (
          <>
            <Route path="/" element={<Waitlist />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            {/* Block all other routes in waitlist mode */}
            <Route path="/app" element={<Navigate to="/" replace />} />
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Landing />} />
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
            {/* Redirect old /auth route to landing */}
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </>
        )}
      </Routes>
    </WaitlistRouteGuard>
  </>
);

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
