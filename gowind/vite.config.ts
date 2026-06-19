import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig, loadEnv } from "vite";

const SITE_META = {
    title: "GoWind — Find your next good wind window",
    description:
        "GoWind analyzes forecasts and highlights when conditions match your limits — so you spend less time checking and more time outside.",
    imageAlt: "GoWind — Find your next good wind window",
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
    const siteUrl = (env.VITE_SITE_URL || env.FRONTEND_URL || "https://gowind.com").replace(/\/$/, "");

    return {
        /** Load `.env` from monorepo root (`tempest/.env`) so one file can serve API + Vite. */
        envDir: path.resolve(__dirname, ".."),
        plugins: [
            react(),
            tailwindcss(),
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
