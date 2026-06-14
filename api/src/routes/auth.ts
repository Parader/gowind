import type { Request, Response } from "express";
import { Router } from "express";
import passport from "passport";
import { User } from "../models/User.js";
import { signToken } from "../auth/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { isAdmin } from "../middleware/adminAuth.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function setTokenCookie(res: Response, token: string): void {
    res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}

export function toSafeUser(user: { _id: unknown; email: string; name?: string; image?: string }) {
    return {
        id: String(user._id),
        email: user.email,
        name: user.name,
        image: user.image,
    };
}

// POST /auth/signup
router.post("/signup", async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }
        const existing = await User.findOne({ email });
        if (existing) {
            res.status(409).json({ error: "An account with this email already exists" });
            return;
        }
        const user = await User.create({ email, password, name: name || undefined });
        const token = signToken({ userId: String(user._id), email: user.email });
        setTokenCookie(res, token);
        res.status(201).json({ user: toSafeUser(user) });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Sign up failed" });
    }
});

// POST /auth/login
router.post("/login", (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: Error | null, user: object | false, info?: { message?: string }) => {
        if (err) {
            res.status(500).json({ error: "Login failed" });
            return;
        }
        if (!user) {
            res.status(401).json({ error: info?.message || "Invalid email or password" });
            return;
        }
        const u = user as { _id: unknown; email: string; name?: string; image?: string };
        const token = signToken({ userId: String(u._id), email: u.email });
        setTokenCookie(res, token);
        res.json({ user: toSafeUser(u) });
    })(req, res, next);
});

// GET /auth/google - redirect to Google
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// GET /auth/google/callback
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
    (req: Request, res: Response) => {
        const user = req.user as { _id: unknown; email: string; name?: string; image?: string };
        const token = signToken({ userId: String(user._id), email: user.email });
        setTokenCookie(res, token);
        res.redirect(`${FRONTEND_URL}/?logged_in=1`);
    }
);

// GET /auth/me - current user (protected)
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as Request & { userId?: string; userEmail?: string }).userId;
    const userEmail = (req as Request & { userEmail?: string }).userEmail;
    if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
    }
    res.json({ user: toSafeUser(user), isAdmin: isAdmin(userEmail ?? user.email) });
});

// POST /auth/logout
router.post("/logout", (_req: Request, res: Response) => {
    res.clearCookie("token");
    res.json({ ok: true });
});

export const authRoutes = router;
