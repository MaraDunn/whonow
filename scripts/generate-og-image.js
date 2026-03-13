/**
 * Generate OpenGraph (and Twitter) image from the full logo (icon + wordmark).
 * Output:
 *   - public/og-image.png and public/twitter-image.png (1200x630)
 *   - public/og-image-4x5.png (1080x1350, 4:5 for feed/vertical)
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
const W_4x5 = 1080;
const H_4x5 = 1350; // 4:5 aspect
const fullLogoPath = join(__dirname, '../src/assets/whonow-logo.png');
const outputDir = join(__dirname, '../public');
const bgHex = process.env.OG_BACKGROUND_HEX || '#0f172a';

const CONTACTS = [
  { initials: 'SC', name: 'Sarah Chen', title: 'Engineering Lead', color: '#34d399' },
  { initials: 'DP', name: 'David Park', title: 'VP of Product', color: '#818cf8' },
  { initials: 'LW', name: 'Lisa Wang', title: 'Head of Sales', color: '#f87171' },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function compositeLogo(logoW, logoH, width, height, options = {}) {
  const { top: fixedTop } = options;
  const logo = await sharp(fullLogoPath).metadata();
  const logoAspect = logo.width / logo.height;
  let w = logoW;
  let h = logoH;
  if (logo.width > w || logo.height > h) {
    if (logoAspect >= w / h) {
      w = Math.min(w, logo.width);
      h = Math.round(w / logoAspect);
    } else {
      h = Math.min(h, logo.height);
      w = Math.round(h * logoAspect);
    }
  } else {
    w = logo.width;
    h = logo.height;
  }
  const x = Math.round((width - w) / 2);
  const y = fixedTop != null ? fixedTop : Math.round((height - h) / 2);
  const resizedLogo = await sharp(fullLogoPath)
    .resize(w, h, { fit: 'inside' })
    .png()
    .toBuffer();
  return { buffer: resizedLogo, left: x, top: y };
}

/** Build SVG for 4:5 full design (background, gradients, text, contact cards). Logo is composited separately. */
function buildSvg4x5() {
  const cx = W_4x5 / 2;
  const cy = H_4x5 / 2;
  const r = Math.max(W_4x5, H_4x5) * 0.8;
  const cardW = 360;
  const cardH = 126;
  const cardGap = 35;
  const cardLeft = (W_4x5 - cardW) / 2;
  const topOffset = Math.round((H_4x5 - 870) / 2); // center content block (870 = content height)
  let cardY = 422 + topOffset;
  const avatarR = cardH * 0.3;
  const headlineY = 295 + topOffset;
  const taglineSize = 22;

  const cardsSvg = CONTACTS.map((contact) => {
    const avatarX = cardLeft + 24 + avatarR;
    const avatarY = cardY + cardH / 2;
    const textX = avatarX + avatarR + 18;
    const nameY = cardY + cardH * 0.4;
    const titleY = cardY + cardH * 0.66;
    const cardSvg = `
      <rect x="${cardLeft}" y="${cardY}" width="${cardW}" height="${cardH}" rx="14" ry="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
      <rect x="${avatarX - avatarR}" y="${avatarY - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" rx="${avatarR * 0.3}" ry="${avatarR * 0.3}" fill="${contact.color}"/>
      <text x="${avatarX}" y="${avatarY + 1}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(avatarR * 0.85)}" font-weight="bold" fill="#fff" text-anchor="middle" dominant-baseline="middle">${escapeXml(contact.initials)}</text>
      <text x="${textX}" y="${nameY}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(cardH * 0.24)}" font-weight="600" fill="#f3f4f6">${escapeXml(contact.name)}</text>
      <text x="${textX}" y="${titleY}" font-family="Inter, system-ui, sans-serif" font-size="${Math.round(cardH * 0.19)}" fill="#9ca3af">${escapeXml(contact.title)}</text>`;
    cardY += cardH + cardGap;
    return cardSvg;
  }).join('');

  return `<svg width="${W_4x5}" height="${H_4x5}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="rad45" cx="${cx}" cy="${cy}" r="${r}" fx="${cx}" fy="${cy - H_4x5 * 0.2}" fr="0" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgb(61,184,163)" stop-opacity="0.22"/>
      <stop offset="50%" stop-color="rgb(58,184,212)" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="rgb(15,23,42)" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lin45" x1="0" y1="0" x2="${W_4x5}" y2="${H_4x5}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="rgb(58,184,212)" stop-opacity="0.08"/>
      <stop offset="50%" stop-color="rgb(58,184,212)" stop-opacity="0"/>
      <stop offset="100%" stop-color="rgb(61,184,163)" stop-opacity="0.06"/>
    </linearGradient>
    <linearGradient id="headline45" x1="${cx - 260}" y1="${headlineY}" x2="${cx + 260}" y2="${headlineY}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#2dd4bf"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${bgHex}"/>
  <rect width="100%" height="100%" fill="url(#rad45)"/>
  <rect width="100%" height="100%" fill="url(#lin45)"/>
  <text x="${cx}" y="${headlineY}" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="800" fill="url(#headline45)" text-anchor="middle" dominant-baseline="hanging">Smart Contacts</text>
  <text x="${cx}" y="${365 + topOffset}" font-family="Inter, system-ui, sans-serif" font-size="${taglineSize}" fill="#9ca3af" text-anchor="middle" dominant-baseline="hanging">Need to find a contact?</text>
  <text x="${cx}" y="${391 + topOffset}" font-family="Inter, system-ui, sans-serif" font-size="${taglineSize}" fill="#9ca3af" text-anchor="middle" dominant-baseline="hanging">Don't ask your boss, ask WhoNow.</text>
  ${cardsSvg}
</svg>`;
}

async function generateOgImage() {
  try {
    // ── 1200×630 (desktop / OG / Twitter) ──
    const composite630 = await compositeLogo(600, 280, W, H);
    const background630 = Buffer.from(
      `<svg width="${W}" height="${H}"><rect width="100%" height="100%" fill="${bgHex}"/></svg>`
    );
    const png630 = await sharp(background630)
      .composite([{ input: composite630.buffer, left: composite630.left, top: composite630.top }])
      .png()
      .toBuffer();

    await sharp(png630).toFile(join(outputDir, 'og-image.png'));
    await sharp(png630).toFile(join(outputDir, 'twitter-image.png'));

    // ── 1080×1350 (4:5 vertical / feed) — full design ──
    const logoTop4x5 = Math.round((H_4x5 - 870) / 2); // content block starts here
    const svg4x5 = buildSvg4x5();
    const composite4x5 = await compositeLogo(560, 211, W_4x5, H_4x5, { top: logoTop4x5 });
    const background4x5 = Buffer.from(svg4x5);
    const png4x5 = await sharp(background4x5)
      .composite([{ input: composite4x5.buffer, left: composite4x5.left, top: composite4x5.top }])
      .png()
      .toBuffer();

    await sharp(png4x5).toFile(join(outputDir, 'og-image-4x5.png'));

    console.log('✓ Generated public/og-image.png and public/twitter-image.png (1200×630)');
    console.log('✓ Generated public/og-image-4x5.png (1080×1350, 4:5)');
  } catch (error) {
    console.error('Error generating OG image:', error);
    process.exit(1);
  }
}

generateOgImage();
