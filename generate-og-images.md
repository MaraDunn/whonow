# Generate OpenGraph Images for WhoNow

## Quick Start

**Option A — Node script (recommended):**  
Run `npm run generate:og-image` (or `node scripts/generate-og-image.js`). This produces `public/og-image.png`, `public/twitter-image.png`, and `public/og-image-4x5.png` from `src/assets/whonow-logo.png`.

**Option B — Browser generator:**  
1. Open `generate-og-image.html` in your browser (or via `npx serve .` if downloads are blocked).  
2. Download the desktop (1200×630), 4:5 (1080×1350), and/or square (1080×1080) images.  
3. Copy the files into `public/`.

## Image Specifications

- **Desktop (OG/Twitter)**: 1200×630px — `public/og-image.png` and `public/twitter-image.png`
- **Vertical 4:5**: 1080×1350px — `public/og-image-4x5.png` (for feed and vertical placements)
- **Format**: PNG (with transparency support)

## Alternative Methods

If the download button doesn't work, try these methods:

### Method 1: Chrome DevTools Screenshot
1. Open `generate-og-image.html` in Chrome
2. Press F12 to open DevTools
3. Find the `.og-image` element in the Elements panel
4. Right-click → "Capture node screenshot"

### Method 2: Browser Extension
- Install "Full Page Screen Capture" or "Nimbus Screenshot"
- Navigate to the generator page
- Capture the image area

### Method 3: Manual Screenshot
- Use macOS screenshot (Cmd+Shift+4) or Windows Snipping Tool
- Capture the 1200x630px image area
- Save as PNG

## After Generating

Once you have the image:

1. Copy `whonow-og-image.png` to `public/og-image.png`
2. Copy the same image to `public/twitter-image.png` (or create a Twitter-specific version)
3. The `index.html` file is already configured to use these images

## Testing

After updating the images, test them using:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Notes

- The generator uses the same full logo as the main site (`src/assets/whonow-logo.png`). A copy at `og-logo.png` in the project root lets the logo load when you open the HTML file directly; if you update the logo in `src/assets/`, run `cp src/assets/whonow-logo.png og-logo.png` so the generator stays in sync.
- The image uses WhoNow branding colors (teal/cyan gradient)
- The design matches your app's visual style
- Both OpenGraph and Twitter will use the same image (you can create separate versions if needed)
