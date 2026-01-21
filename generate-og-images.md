# Generate OpenGraph Images for WhoNow

## Quick Start

1. **Open the generator**: Open `generate-og-image.html` in your browser
2. **Generate the image**: Click "Download as PNG" button
3. **Save the image**: The image will be downloaded as `whonow-og-image.png`
4. **Move to public folder**: Copy the image to the `public/` folder
5. **Update index.html**: The image paths are already configured (see below)

## Image Specifications

- **Dimensions**: 1200x630px (standard OpenGraph/Twitter card size)
- **Format**: PNG (with transparency support)
- **File location**: `public/og-image.png` and `public/twitter-image.png`

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

- The image uses WhoNow branding colors (teal/cyan gradient)
- The design matches your app's visual style
- Both OpenGraph and Twitter will use the same image (you can create separate versions if needed)
