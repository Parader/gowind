import dotenv from "dotenv";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

// Load .env - project root (.. from api/src) and cwd for overrides
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: rootEnv });
dotenv.config(); // cwd .env overrides (e.g. api/.env)
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version?: string };
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { setupRoutes } from "./routes/setup.js";
import { userDataRoutes } from "./routes/userData.js";
import { aviationRoutes } from "./routes/aviation.js";
import { weatherRoutes } from "./routes/weather.js";
import { goTimesRoutes } from "./routes/goTimes.js";
import { goTimeShareRoutes } from "./routes/goTimeShares.js";
import { adminRoutes } from "./routes/admin.js";
import "./auth/passport.js";
import posthog from "./posthog.js";

const PORT = process.env.PORT || 3001;

async function main() {
    await connectDb();

    const app = express();
    app.use(
        cors({
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            credentials: true,
        })
    );
    app.use(cookieParser());
    app.use(express.json());

    app.use("/auth", authRoutes);
    app.use("/setup", setupRoutes);
    app.use("/user-data", userDataRoutes);
    app.use("/aviation", aviationRoutes);
    app.use("/weather", weatherRoutes);
    app.use("/go-times", goTimesRoutes);
    app.use("/go-time-shares", goTimeShareRoutes);
    app.use("/admin", adminRoutes);

    app.get("/health", async (_req, res) => {
        const dbState = mongoose.connection.readyState;
        const dbConnected = dbState === 1;
        res.json({
            ok: dbConnected,
            timestamp: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
            db: dbConnected ? "connected" : { state: dbState, status: ["disconnected", "connected", "connecting", "disconnecting"][dbState] ?? "unknown" },
            version: pkg.version ?? "0.0.0",
        });
    });

    app.listen(PORT, () => {
        console.log(`GoWind API running at http://localhost:${PORT}`);
    });
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

process.on("SIGTERM", async () => {
    await posthog.shutdown();
    process.exit(0);
});

process.on("SIGINT", async () => {
    await posthog.shutdown();
    process.exit(0);
});
