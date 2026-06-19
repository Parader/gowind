import crypto from "crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/auth.js";
import { GoTimeShare } from "../models/GoTimeShare.js";
import { captureServerEvent } from "../posthog.js";

const router = Router();
const SHARE_TTL_MS = 4 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function publicPayload(doc: { shareId: string; snapshot: Record<string, unknown>; expiresAt: Date; createdAt: Date }) {
    return {
        shareId: doc.shareId,
        snapshot: doc.snapshot,
        expiresAt: doc.expiresAt.toISOString(),
        createdAt: doc.createdAt.toISOString(),
    };
}

router.post("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string; userEmail?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const snapshot = req.body?.snapshot;
    if (!isRecord(snapshot) || !isRecord(snapshot.window)) {
        return res.status(400).json({ error: "A go-time window snapshot is required" });
    }

    const shareId = crypto.randomBytes(12).toString("base64url");
    const expiresAt = new Date(Date.now() + SHARE_TTL_MS);

    const doc = await GoTimeShare.create({
        shareId,
        createdBy: new mongoose.Types.ObjectId(userId),
        snapshot,
        expiresAt,
    });

    captureServerEvent(userId, "go_time_card_shared", {
            shareId,
            expiresAt: expiresAt.toISOString(),
        windowId: isRecord(snapshot.window) ? snapshot.window.id : undefined,
        locationName: isRecord(snapshot.window) ? snapshot.window.locationName : undefined,
    });

    return res.status(201).json(publicPayload(doc));
});

router.get("/:shareId", async (req: Request, res: Response) => {
    const shareId = String(req.params.shareId ?? "").trim();
    if (!shareId) return res.status(400).json({ error: "Share id required" });

    const doc = await GoTimeShare.findOne({ shareId });
    if (!doc || doc.expiresAt.getTime() <= Date.now()) {
        return res.status(410).json({ error: "This shared go-time window has expired" });
    }

    return res.json(publicPayload(doc));
});

export const goTimeShareRoutes = router;
