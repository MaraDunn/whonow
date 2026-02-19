import sharp from 'sharp';
import ico from 'sharp-ico';
import { mkdirSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceIcon = join(__dirname, '../src/assets/whonow-logo-icon.png');
const outputDir = join(__dirname, '../src-tauri/icons');

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

async function generateIcons() {
  try {
    console.log('Generating Tauri icons from:', sourceIcon);
    
    // Generate PNG icons
    const sizes = [
      { name: '32x32.png', size: 32 },
      { name: '128x128.png', size: 128 },
      { name: '128x128@2x.png', size: 256 }, // Retina version
    ];

    for (const { name, size } of sizes) {
      const outputPath = join(outputDir, name);
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${name}`);
    }

    // Generate .ico file (Windows) with multiple sizes (sharp-ico: no vulnerable deps)
    console.log('\nGenerating icon.ico...');
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const icoSharps = await Promise.all(
      icoSizes.map((size) =>
        sharp(sourceIcon).resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
      )
    );

    const icoPath = join(outputDir, 'icon.ico');
    await ico.sharpsToIco(icoSharps, icoPath);
    console.log('✓ Generated icon.ico');

    // Generate .icns file (macOS)
    console.log('\nGenerating icon.icns...');
    const iconsetDir = join(outputDir, 'icon.iconset');
    
    // Remove existing iconset if it exists
    if (existsSync(iconsetDir)) {
      rmSync(iconsetDir, { recursive: true });
    }
    mkdirSync(iconsetDir, { recursive: true });

    // Create all required iconset images
    const iconsetSizes = [
      { name: 'icon_16x16.png', size: 16 },
      { name: 'icon_16x16@2x.png', size: 32 },
      { name: 'icon_32x32.png', size: 32 },
      { name: 'icon_32x32@2x.png', size: 64 },
      { name: 'icon_128x128.png', size: 128 },
      { name: 'icon_128x128@2x.png', size: 256 },
      { name: 'icon_256x256.png', size: 256 },
      { name: 'icon_256x256@2x.png', size: 512 },
      { name: 'icon_512x512.png', size: 512 },
      { name: 'icon_512x512@2x.png', size: 1024 },
    ];

    for (const { name, size } of iconsetSizes) {
      const outputPath = join(iconsetDir, name);
      await sharp(sourceIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
    }

    // Use iconutil to create .icns (macOS only)
    const icnsPath = join(outputDir, 'icon.icns');
    try {
      execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' });
      console.log('✓ Generated icon.icns');
      // Clean up iconset directory
      rmSync(iconsetDir, { recursive: true });
    } catch (error) {
      console.log('⚠️  Could not generate .icns file (iconutil not available or not on macOS)');
      console.log('   The iconset directory has been created at:', iconsetDir);
      console.log('   You can manually run: iconutil -c icns "' + iconsetDir + '" -o "' + icnsPath + '"');
    }
    
    console.log('\n✓ All icons generated successfully!');
    
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
