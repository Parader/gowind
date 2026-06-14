import type { Request, Response } from "express";
import { Router } from "express";
import { UserData } from "../models/UserData.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// GET /user-data - list user's data by type
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const type = req.query.type as string | undefined;
    const filter = { userId };
    if (type) (filter as Record<string, unknown>).type = type;
    const items = await UserData.find(filter).sort({ updatedAt: -1 });
    res.json({ items });
});

// POST /user-data - create/upsert user data
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ error: "type is required" });
    const item = await UserData.findOneAndUpdate(
        { userId, type },
        { $set: { data: data || {} } },
        { new: true, upsert: true }
    );
    res.json({ item });
});

// DELETE /user-data?type=weather - remove user data by type (e.g. legacy weather)
router.delete("/", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const type = req.query.type as string | undefined;
    if (!type) return res.status(400).json({ error: "type query param is required" });
    const result = await UserData.deleteMany({ userId, type });
    res.json({ deleted: result.deletedCount });
});

export const userDataRoutes = router;
