import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

// Detect if device is touch-primary (phones/tablets) vs mouse-primary (desktops)
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for fine pointer (mouse/trackpad) - if this is the PRIMARY pointer, it's desktop
  // This handles touchscreen laptops correctly - they have both but mouse is primary
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (hasFinePointer) return false;
  
  // Check for coarse pointer (touch screens)
  const hasCoarsePointer = window.matchMedia('(any-pointer: coarse)').matches;
  // Check for touch points
  const hasTouchPoints = navigator.maxTouchPoints > 0;
  
  // It's a touch device if it has touch capabilities and no fine pointer as primary
  return hasCoarsePointer || hasTouchPoints;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

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

  return isMobile;
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
