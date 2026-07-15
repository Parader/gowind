import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const PRODUCTION_SITE_URL = "https://go-wind.com";

const SITE_META = {
    title: "GoWind — Find your next good wind window",
    description:
        "GoWind analyzes forecasts and highlights when conditions match your limits — so you spend less time checking and more time outside.",
    imageAlt: "GoWind — Find your next good wind window",
};

function resolveSiteUrl(mode: string, env: Record<string, string>): string {
    const candidates = [
        env.VITE_SITE_URL,
        process.env.URL,
        process.env.DEPLOY_PRIME_URL,
        mode === "development" ? env.FRONTEND_URL : undefined,
        PRODUCTION_SITE_URL,
    ];

    for (const candidate of candidates) {
        const url = candidate?.trim();
        if (!url) continue;
        if (mode === "production" && /localhost|127\.0\.0\.1/i.test(url)) continue;
        return url.replace(/\/$/, "");
    }

    return PRODUCTION_SITE_URL;
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
    const siteUrl = resolveSiteUrl(mode, env);

    return {
        /** Load `.env` from monorepo root (`tempest/.env`) so one file can serve API + Vite. */
        envDir: path.resolve(__dirname, ".."),
        plugins: [
            react(),
            tailwindcss(),
            VitePWA({
                registerType: "autoUpdate",
                injectRegister: "auto",
                includeAssets: [
                    "favicon-32x32.png",
                    "apple-touch-icon.png",
                    "gowind_logo.svg",
                    "gowind_logo_white.svg",
                ],
                manifest: {
                    name: "GoWind",
                    short_name: "GoWind",
                    description: SITE_META.description,
                    start_url: "/go-time?source=pwa",
                    scope: "/",
                    display: "standalone",
                    orientation: "portrait-primary",
                    background_color: "#ffffff",
                    theme_color: "#3e4784",
                    categories: ["weather", "lifestyle", "utilities"],
                    icons: [
                        {
                            src: "/pwa-192x192.png",
                            sizes: "192x192",
                            type: "image/png",
                            purpose: "any",
                        },
                        {
                            src: "/pwa-512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "any",
                        },
                        {
                            src: "/pwa-maskable-512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "maskable",
                        },
                    ],
                },
                workbox: {
                    cleanupOutdatedCaches: true,
                    navigateFallback: "/index.html",
                    navigateFallbackDenylist: [/^\/api\//],
                    runtimeCaching: [
                        {
                            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                            handler: "CacheFirst",
                            options: {
                                cacheName: "google-fonts",
                                expiration: {
                                    maxEntries: 20,
                                    maxAgeSeconds: 60 * 60 * 24 * 365,
                                },
                                cacheableResponse: { statuses: [0, 200] },
                            },
                        },
                    ],
                },
            }),
            {
                name: "inject-social-meta",
                transformIndexHtml(html) {
                    const imageUrl = `${siteUrl}/og-image.png`;
                    return html
                        .replaceAll("%SITE_URL%", siteUrl)
                        .replaceAll("%OG_TITLE%", SITE_META.title)
                        .replaceAll("%OG_DESCRIPTION%", SITE_META.description)
                        .replaceAll("%OG_IMAGE%", imageUrl)
                        .replaceAll("%OG_IMAGE_ALT%", SITE_META.imageAlt);
                },
            },
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    };
});
