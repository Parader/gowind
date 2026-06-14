import type { Request, Response } from "express";
import { Router } from "express";
import { UserData } from "../models/UserData.js";
import { authMiddleware } from "../middleware/auth.js";
import { invalidateGoTimesCache } from "../services/goTimes.js";
import mongoose from "mongoose";

const router = Router();

export interface SetupData {
    locations: Array<{ id: string; name: string; lat: number; lng: number; region?: string }>;
    preferences: Record<string, unknown> | null;
}

// GET /setup - get user's locations and preferences
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const doc = await UserData.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        type: "setup",
    });

    const data = (doc?.data as unknown as SetupData | undefined) ?? { locations: [], preferences: null };
    const locations = Array.isArray(data.locations)
        ? data.locations.filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
        : [];
    const preferences = data.preferences && typeof data.preferences === "object" ? data.preferences : null;

    res.json({ locations, preferences });
});

// PUT /setup - save user's locations and preferences
router.put("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { locations, preferences } = req.body;
    const locs = Array.isArray(locations)
        ? locations.filter((l) => l && typeof l.lat === "number" && typeof l.lng === "number")
        : [];
    const prefs = preferences && typeof preferences === "object" ? preferences : null;

    await UserData.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), type: "setup" },
        { $set: { data: { locations: locs, preferences: prefs } } },
        { new: true, upsert: true }
    );

    await invalidateGoTimesCache(userId);

    res.json({ locations: locs, preferences: prefs });
});

export const setupRoutes = router;
