import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const iconSvg = await readFile(path.join(publicDir, "gowind-icon.svg"));

await mkdir(publicDir, { recursive: true });

const outputs = [
    { name: "pwa-192x192.png", size: 192 },
    { name: "pwa-512x512.png", size: 512 },
    { name: "pwa-maskable-512x512.png", size: 512 },
    { name: "apple-touch-icon.png", size: 180 },
    { name: "favicon-32x32.png", size: 32 },
];

await Promise.all(
    outputs.map(({ name, size }) =>
        sharp(iconSvg)
            .resize(size, size, { fit: "contain" })
            .png()
            .toFile(path.join(publicDir, name)),
    ),
);

console.log(`Generated ${outputs.length} GoWind PWA icons`);
