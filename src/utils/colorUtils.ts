/**
 * Convert hex color to HSL format
 * Returns HSL values as a string in format "h s% l%" (without hsl() wrapper)
 */
export function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Convert 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Find min and max
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  // Convert to degrees and percentages
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);
  
  return `${h} ${s}% ${lPercent}%`;
}

/**
 * Convert HSL string to RGB for contrast calculation
 */
function hslToRgb(hsl: string): [number, number, number] {
  const [h, s, l] = hsl.split(" ").map((val, idx) => {
    if (idx === 0) return parseInt(val);
    return parseInt(val.replace("%", "")) / 100;
  });
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * Calculate relative luminance for WCAG contrast calculation
 */
function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(val => {
    val = val / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate WCAG contrast ratio between two colors
 * Returns a value between 1 and 21 (21 is maximum contrast)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hslToRgb(color1);
  const rgb2 = hslToRgb(color2);
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Adjust HSL lightness to ensure minimum contrast ratio for background colors
 * Ensures that either white or black text will be readable on this background
 */
function adjustLightnessForContrast(
  hsl: string,
  targetContrast: number
): string {
  const [h, s, l] = hsl.split(" ").map((val, idx) => {
    if (idx === 0) return parseInt(val);
    return parseInt(val.replace("%", ""));
  });
  
  const white = "0 0% 100%";
  const black = "0 0% 0%";
  
  // Check current contrast
  const whiteContrast = getContrastRatio(hsl, white);
  const blackContrast = getContrastRatio(hsl, black);
  const bestContrast = Math.max(whiteContrast, blackContrast);
  
  // If already meets contrast requirement, return as-is
  if (bestContrast >= targetContrast) {
    return hsl;
  }
  
  // Determine which foreground provides better contrast
  const prefersWhite = whiteContrast > blackContrast;
  
  // Adjust lightness to improve contrast
  // If white text works better, make background darker
  // If black text works better, make background lighter
  let adjustedL = l;
  const step = 3; // Smaller steps for more precise adjustment
  const maxIterations = 30;
  let iterations = 0;
  let bestHsl = hsl;
  let bestContrastFound = bestContrast;
  
  while (iterations < maxIterations && adjustedL >= 0 && adjustedL <= 100) {
    const testHsl = `${h} ${s}% ${adjustedL}%`;
    const testWhiteContrast = getContrastRatio(testHsl, white);
    const testBlackContrast = getContrastRatio(testHsl, black);
    const testBestContrast = Math.max(testWhiteContrast, testBlackContrast);
    
    if (testBestContrast >= targetContrast) {
      return testHsl; // Found a good color
    }
    
    // Track the best we've found so far
    if (testBestContrast > bestContrastFound) {
      bestContrastFound = testBestContrast;
      bestHsl = testHsl;
    }
    
    // Adjust towards better contrast
    if (prefersWhite) {
      adjustedL = Math.max(0, adjustedL - step); // Darker for white text
    } else {
      adjustedL = Math.min(100, adjustedL + step); // Lighter for black text
    }
    
    iterations++;
  }
  
  // Return the best we found, even if it doesn't meet the target
  // (Better than returning an unreadable color)
  return bestHsl;
}

/**
 * Calculate a contrasting foreground color with WCAG compliance
 * Ensures minimum 4.5:1 contrast ratio for normal text
 */
export function getContrastingForeground(
  backgroundHsl: string,
  minContrast: number = 4.5
): string {
  const white = "0 0% 100%";
  const black = "0 0% 0%";
  
  const whiteContrast = getContrastRatio(backgroundHsl, white);
  const blackContrast = getContrastRatio(backgroundHsl, black);
  
  // Choose the color with better contrast
  if (whiteContrast >= minContrast && whiteContrast >= blackContrast) {
    return white;
  }
  
  if (blackContrast >= minContrast && blackContrast >= whiteContrast) {
    return black;
  }
  
  // If neither meets minimum, choose the better one
  // (This should rarely happen with proper color adjustment)
  return whiteContrast > blackContrast ? white : black;
}

/**
 * Ensure a color meets minimum contrast requirements
 * Adjusts the color if needed to ensure readability
 * For background colors, ensures white or black text will be readable
 */
export function ensureReadableColor(
  colorHsl: string,
  isBackground: boolean = true,
  minContrast: number = 4.5
): string {
  if (isBackground) {
    // For backgrounds, ensure white or black text is readable
    return adjustLightnessForContrast(colorHsl, minContrast);
  } else {
    // For foregrounds, return as-is (will be checked against background)
    return colorHsl;
  }
}

