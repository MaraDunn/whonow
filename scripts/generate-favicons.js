/**
 * Generate favicons and public/logo-icon.png from the single source icon.
 * Run after updating src/assets/whonow-logo-icon.png (e.g. with final logo from designer).
 *
 * Outputs to public/:
 *   favicon.png (512x512)
 *   favicon-32x32.png
 *   favicon-16x16.png
 *   favicon.ico (multi-size)
 *   logo-icon.png (for Slack unfurl and Supabase email templates)
 */

import sharp from 'sharp';
import ico from 'sharp-ico';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceIcon = join(__dirname, '../src/assets/whonow-logo-icon.png');
const outputDir = join(__dirname, '../public');

mkdirSync(outputDir, { recursive: true });

async function generateFavicons() {
  try {
    console.log('Generating favicons and logo-icon from:', sourceIcon);

    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
    const resizeOpts = { fit: 'contain', background: transparent };

    // Favicon PNG sizes
    const pngSizes = [
      { name: 'favicon-16x16.png', size: 16 },
      { name: 'favicon-32x32.png', size: 32 },
      { name: 'favicon.png', size: 512 },
    ];

    for (const { name, size } of pngSizes) {
      const outputPath = join(outputDir, name);
      await sharp(sourceIcon).resize(size, size, resizeOpts).png().toFile(outputPath);
      console.log('✓ Generated', name);
    }

    // Multi-size .ico for Windows / legacy
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const icoSharps = await Promise.all(
      icoSizes.map((size) => sharp(sourceIcon).resize(size, size, resizeOpts))
    );
    const icoPath = join(outputDir, 'favicon.ico');
    await ico.sharpsToIco(icoSharps, icoPath);
    console.log('✓ Generated favicon.ico');

    // public/logo-icon.png for Slack and Supabase email (confirm-signup.html)
    const logoIconPath = join(outputDir, 'logo-icon.png');
    await sharp(sourceIcon).resize(512, 512, resizeOpts).png().toFile(logoIconPath);
    console.log('✓ Generated logo-icon.png');

    console.log('\n✓ Favicons and logo-icon generated in public/');
  } catch (error) {
    console.error('Error generating favicons:', error);
    process.exit(1);
  }
}

generateFavicons();
