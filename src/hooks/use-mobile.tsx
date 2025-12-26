import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

// Detect if device is touch-primary (phones/tablets) vs mouse-primary (desktops)
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for coarse pointer (touch screens)
  const hasCoarsePointer = window.matchMedia('(any-pointer: coarse)').matches;
  // Check for touch points
  const hasTouchPoints = navigator.maxTouchPoints > 0;
  // Check for fine pointer (mouse/trackpad) - if this is the PRIMARY pointer, it's desktop
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  
  // If primary pointer is fine (mouse/trackpad), treat as desktop regardless of touch capability
  // This handles touchscreen laptops correctly - they have both but mouse is primary
  if (hasFinePointer) return false;
  
  // Otherwise, it's a touch device if it has touch capabilities
  return hasCoarsePointer || hasTouchPoints;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const checkMobile = () => {
      const isTouch = isTouchDevice();
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
      // Only consider mobile if it's a touch device AND small screen
      setIsMobile(isTouch && isSmallScreen);
    };
    
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", checkMobile);
    checkMobile();
    
    return () => mql.removeEventListener("change", checkMobile);
  }, []);

  return !!isMobile;
}

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const checkTablet = () => {
      const isTouch = isTouchDevice();
      const width = window.innerWidth;
      const isTabletSize = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
      // Only consider tablet if it's a touch device AND tablet-sized screen
      setIsTablet(isTouch && isTabletSize);
    };
    
    const mqlMin = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT}px)`);
    const mqlMax = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    
    mqlMin.addEventListener("change", checkTablet);
    mqlMax.addEventListener("change", checkTablet);
    checkTablet();
    
    return () => {
      mqlMin.removeEventListener("change", checkTablet);
      mqlMax.removeEventListener("change", checkTablet);
    };
  }, []);

  return !!isTablet;
}

export type ResponsiveView = 'mobile' | 'tablet' | 'desktop';

export function useResponsiveView(): ResponsiveView {
  const [view, setView] = React.useState<ResponsiveView>('desktop');

  React.useEffect(() => {
    const checkView = () => {
      const isTouch = isTouchDevice();
      
      // If not a touch device, always return desktop regardless of window size
      if (!isTouch) {
        setView('desktop');
        return;
      }
      
      // For touch devices, use screen size to determine mobile vs tablet
      const width = window.innerWidth;
      if (width < MOBILE_BREAKPOINT) {
        setView('mobile');
      } else if (width < TABLET_BREAKPOINT) {
        setView('tablet');
      } else {
        // Large touch screens (like large iPads) still get tablet treatment
        setView('tablet');
      }
    };
    
    window.addEventListener("resize", checkView);
    checkView();
    
    return () => window.removeEventListener("resize", checkView);
  }, []);

  return view;
}
