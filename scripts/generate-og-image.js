/**
 * Generate OpenGraph (and Twitter) image from the full logo (icon + wordmark).
 * Output: public/og-image.png and public/twitter-image.png (1200x630).
 *
 * Run after updating src/assets/whonow-logo.png:
 *   node scripts/generate-og-image.js
 *
 * Optional env: OG_BACKGROUND_HEX (default: #0f172a) for the card background.
 */

import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const W = 1200;
const H = 630;
const fullLogoPath = join(__dirname, '../src/assets/whonow-logo.png');
const outputDir = join(__dirname, '../public');
const bgHex = process.env.OG_BACKGROUND_HEX || '#0f172a';

async function generateOgImage() {
  try {
    const logo = await sharp(fullLogoPath).metadata();
    const logoAspect = logo.width / logo.height;
    const maxLogoW = 600;
    const maxLogoH = 280;
    let logoW = logo.width;
    let logoH = logo.height;
    if (logoW > maxLogoW || logoH > maxLogoH) {
      if (logoAspect >= maxLogoW / maxLogoH) {
        logoW = maxLogoW;
        logoH = Math.round(maxLogoW / logoAspect);
      } else {
        logoH = maxLogoH;
        logoW = Math.round(maxLogoH * logoAspect);
      }
    }
    const x = Math.round((W - logoW) / 2);
    const y = Math.round((H - logoH) / 2);

    const background = Buffer.from(
      `<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="${bgHex}"/></svg>`
    );
    const resizedLogo = await sharp(fullLogoPath)
      .resize(logoW, logoH, { fit: 'inside' })
      .png()
      .toBuffer();

    const pngBuffer = await sharp(background)
      .composite([{ input: resizedLogo, left: x, top: y }])
      .png()
      .toBuffer();

    await sharp(pngBuffer).toFile(join(outputDir, 'og-image.png'));
    await sharp(pngBuffer).toFile(join(outputDir, 'twitter-image.png'));

    console.log('✓ Generated public/og-image.png and public/twitter-image.png (1200x630)');
  } catch (error) {
    console.error('Error generating OG image:', error);
    process.exit(1);
  }
}

generateOgImage();
