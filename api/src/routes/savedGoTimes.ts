import type { Request, Response } from "express";
import { Router } from "express";
import mongoose from "mongoose";
import { authMiddleware } from "../middleware/auth.js";
import { UserData } from "../models/UserData.js";
import { captureServerEvent } from "../posthog.js";

const router = Router();
const DATA_TYPE = "saved-go-times";
const MAX_SAVED = 100;

export type SavedGoTimeStatus = "upcoming" | "passed";

export interface SavedGoTimeItem {
    key: string;
    locationId: string;
    startTime: string;
    endTime: string;
    savedAt: string;
    status: SavedGoTimeStatus;
    window: Record<string, unknown>;
}

interface SavedGoTimesData {
    items: SavedGoTimeItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function savedGoTimeKey(locationId: string, startTime: string): string {
    return `${locationId}|${startTime}`;
}

function isPassedWindow(startTime: string, displayStartTime?: unknown): boolean {
    const display =
        typeof displayStartTime === "string" && displayStartTime.trim()
            ? displayStartTime
            : startTime;
    const t = new Date(display).getTime();
    return Number.isFinite(t) && t < Date.now();
}

function normalizeItems(raw: unknown): SavedGoTimeItem[] {
    if (!Array.isArray(raw)) return [];
    const out: SavedGoTimeItem[] = [];
    for (const row of raw) {
        if (!isRecord(row) || !isRecord(row.window)) continue;
        const locationId = typeof row.locationId === "string" ? row.locationId : "";
        const startTime = typeof row.startTime === "string" ? row.startTime : "";
        if (!locationId || !startTime) continue;
        const key =
            typeof row.key === "string" && row.key
                ? row.key
                : savedGoTimeKey(locationId, startTime);
        const endTime =
            typeof row.endTime === "string" && row.endTime
                ? row.endTime
                : typeof row.window.endTime === "string"
                  ? row.window.endTime
                  : startTime;
        const savedAt =
            typeof row.savedAt === "string" && row.savedAt
                ? row.savedAt
                : new Date(0).toISOString();
        const status: SavedGoTimeStatus = isPassedWindow(startTime, row.window.displayStartTime)
            ? "passed"
            : "upcoming";
        out.push({
            key,
            locationId,
            startTime,
            endTime,
            savedAt,
            status,
            window: row.window,
        });
    }
    return out;
}

function sortItems(items: SavedGoTimeItem[]): SavedGoTimeItem[] {
    return [...items].sort((a, b) => {
        if (a.status !== b.status) return a.status === "upcoming" ? -1 : 1;
        const ta = new Date(a.startTime).getTime();
        const tb = new Date(b.startTime).getTime();
        if (a.status === "upcoming") return ta - tb;
        return tb - ta;
    });
}

async function loadDoc(userId: string) {
    return UserData.findOne({
        userId: new mongoose.Types.ObjectId(userId),
        type: DATA_TYPE,
    });
}

async function writeItems(userId: string, items: SavedGoTimeItem[]) {
    await UserData.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(userId), type: DATA_TYPE },
        { $set: { data: { items } satisfies SavedGoTimesData } },
        { upsert: true, new: true },
    );
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const doc = await loadDoc(userId);
    const previous = normalizeItems((doc?.data as SavedGoTimesData | undefined)?.items);
    const items = sortItems(normalizeItems(previous));
    const changed =
        items.length !== previous.length ||
        items.some((item, i) => item.status !== previous[i]?.status || item.key !== previous[i]?.key);
    if (changed) {
        await writeItems(userId, items);
    }

    return res.json({ items });
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const window = req.body?.window;
    if (!isRecord(window)) {
        return res.status(400).json({ error: "A go-time window is required" });
    }
    const locationId = typeof window.locationId === "string" ? window.locationId.trim() : "";
    const startTime = typeof window.startTime === "string" ? window.startTime.trim() : "";
    const endTime = typeof window.endTime === "string" ? window.endTime.trim() : startTime;
    if (!locationId || !startTime) {
        return res.status(400).json({ error: "locationId and startTime are required" });
    }

    const key = savedGoTimeKey(locationId, startTime);
    const doc = await loadDoc(userId);
    const existing = normalizeItems((doc?.data as SavedGoTimesData | undefined)?.items);
    if (existing.some((item) => item.key === key)) {
        return res.json({ items: sortItems(existing), item: existing.find((i) => i.key === key) });
    }
    if (existing.length >= MAX_SAVED) {
        return res.status(400).json({ error: `You can save at most ${MAX_SAVED} windows` });
    }

    const item: SavedGoTimeItem = {
        key,
        locationId,
        startTime,
        endTime,
        savedAt: new Date().toISOString(),
        status: isPassedWindow(startTime, window.displayStartTime) ? "passed" : "upcoming",
        window,
    };
    const items = sortItems([item, ...existing]);
    await writeItems(userId, items);

    captureServerEvent(userId, "go_time_window_saved", {
        key,
        locationId,
        category: typeof window.category === "string" ? window.category : undefined,
    });

    return res.status(201).json({ items, item });
});

router.delete("/:key", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const key = decodeURIComponent(String(req.params.key ?? "")).trim();
    if (!key) return res.status(400).json({ error: "Save key required" });

    const doc = await loadDoc(userId);
    const existing = normalizeItems((doc?.data as SavedGoTimesData | undefined)?.items);
    const items = sortItems(existing.filter((item) => item.key !== key));
    await writeItems(userId, items);

    captureServerEvent(userId, "go_time_window_unsaved", { key });

    return res.json({ items });
});

export const savedGoTimeRoutes = router;
