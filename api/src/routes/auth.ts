import type { Request, Response } from "express";
import { Router } from "express";
import passport from "passport";
import { User } from "../models/User.js";
import { signToken } from "../auth/jwt.js";
import { authMiddleware } from "../middleware/auth.js";
import { isAdmin } from "../middleware/adminAuth.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function getTokenCookieOptions() {
    const isProduction =
        process.env.NODE_ENV === "production" ||
        process.env.RENDER === "true" ||
        Boolean(process.env.FLY_APP_NAME) ||
        Boolean(process.env.KOYEB_APP_ID) ||
        Boolean(process.env.KOYEB_SERVICE_ID) ||
        process.env.API_URL?.startsWith("https://");
    const sameSite: "lax" | "none" = isProduction ? "none" : "lax";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite,
        // Helps some browsers retain cross-site cookies; Bearer token is the primary prod auth path.
        ...(isProduction ? { partitioned: true as const } : {}),
    };
}

function setTokenCookie(res: Response, token: string): void {
    res.cookie("token", token, {
        ...getTokenCookieOptions(),
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
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

function normalizeEmail(email: unknown): string {
    return String(email ?? "")
        .trim()
        .toLowerCase();
}

// POST /auth/signup
router.post("/signup", async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password ?? "");
        const name = typeof req.body?.name === "string" ? req.body.name.trim() : undefined;

        if (!email || !password) {
            res.status(400).json({ error: "Email and password are required" });
            return;
        }
        if (password.length < 8) {
            res.status(400).json({ error: "Password must be at least 8 characters" });
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
        res.status(201).json({ user: toSafeUser(user), token });
    } catch (err) {
        const code = (err as { code?: number }).code;
        if (code === 11000) {
            res.status(409).json({ error: "An account with this email already exists" });
            return;
        }
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
        res.json({ user: toSafeUser(u), token });
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
        res.redirect(`${FRONTEND_URL}/go-time?logged_in=1#token=${encodeURIComponent(token)}`);
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
    res.clearCookie("token", getTokenCookieOptions());
    res.json({ ok: true });
});

export const authRoutes = router;
