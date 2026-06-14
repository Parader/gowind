import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
    /** Load `.env` from monorepo root (`tempest/.env`) so one file can serve API + Vite. */
    envDir: path.resolve(__dirname, ".."),
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
