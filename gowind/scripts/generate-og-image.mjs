/**
 * Build a 1200×630 Open Graph image from public assets (mountains + white logo).
 * Usage: node scripts/generate-og-image.mjs
 */
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const outPath = join(publicDir, "og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;

const backgroundPath = join(publicDir, "mountains.png");
const logoPath = join(publicDir, "gowind_logo_white.svg");

const title = "Find your next good wind window";
const subtitle = "GoWind — forecast windows for wind-sensitive activities";

const background = await sharp(backgroundPath)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .modulate({ brightness: 0.92 })
    .toBuffer();

const scrimSvg = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f1429" stop-opacity="0.55"/>
      <stop offset="45%" stop-color="#0f1429" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#0f1429" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
</svg>`);

const logoWidth = 420;
const logoMeta = await sharp(logoPath).metadata();
const logoHeight = Math.round((logoWidth / logoMeta.width) * logoMeta.height);
const logoLeft = Math.round((WIDTH - logoWidth) / 2);
const logoTop = Math.round(HEIGHT * 0.28);

const logo = await sharp(logoPath).resize(logoWidth, logoHeight).png().toBuffer();

const accentBar = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${logoLeft}" y="${logoTop + logoHeight + 28}" width="48" height="3" fill="#8098F9" rx="1.5"/>
  <text x="${WIDTH / 2}" y="${logoTop + logoHeight + 72}"
        text-anchor="middle"
        font-family="Inter, Segoe UI, system-ui, sans-serif"
        font-size="34"
        font-weight="600"
        fill="#FFFFFF">${escapeXml(title)}</text>
  <text x="${WIDTH / 2}" y="${logoTop + logoHeight + 118}"
        text-anchor="middle"
        font-family="Inter, Segoe UI, system-ui, sans-serif"
        font-size="22"
        font-weight="400"
        fill="#B3B8DB">${escapeXml(subtitle)}</text>
</svg>`);

await sharp(background)
    .composite([
        { input: scrimSvg, top: 0, left: 0 },
        { input: logo, top: logoTop, left: logoLeft },
        { input: accentBar, top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);

console.log(`Wrote ${outPath} (${WIDTH}×${HEIGHT})`);

function escapeXml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
