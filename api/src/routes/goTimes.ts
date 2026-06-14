import type { Request, Response } from "express";
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getGoTimes } from "../services/goTimes.js";

const router = Router();

/** GET /go-times - Returns next wind windows for user's locations. Computes and stores if stale. */
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { windows, meta, computedAt, weatherDataFetchedAt, providersUsed, providerStatuses, heightsSubscribed, minSessionLengthMinutes } = await getGoTimes(userId);
        const payload = meta
            ? { windows, meta, computedAt, weatherDataFetchedAt, providersUsed, providerStatuses, heightsSubscribed, minSessionLengthMinutes }
            : { windows, computedAt, weatherDataFetchedAt, providersUsed, providerStatuses, heightsSubscribed, minSessionLengthMinutes };
        res.json(payload);
    } catch (err) {
        console.error("Go-times error:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "Failed to get go-times" });
    }
});

export const goTimesRoutes = router;
