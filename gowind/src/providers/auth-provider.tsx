import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { User } from "@/api/auth";
import * as authApi from "@/api/auth";
import { getAuthToken, consumeOAuthTokenFromHash, setAuthToken } from "@/api/auth-token";
import { ApiError } from "@/api/client";
import {
    identifyUser,
    resetAnalyticsUser,
    track,
    trackAuthSuccess,
} from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics-events";

const AUTH_CACHE_KEY = "gowind_auth_user";

export function getCachedAuthUser(): User | null {
    return getCachedUser();
}

function getCachedUser(): User | null {
    try {
        const cached = localStorage.getItem(AUTH_CACHE_KEY) ?? sessionStorage.getItem(AUTH_CACHE_KEY);
        if (!cached) return null;
        // Migrate older sessionStorage cache to localStorage so closing the browser keeps the session UX.
        if (!localStorage.getItem(AUTH_CACHE_KEY) && sessionStorage.getItem(AUTH_CACHE_KEY)) {
            localStorage.setItem(AUTH_CACHE_KEY, cached);
            sessionStorage.removeItem(AUTH_CACHE_KEY);
        }
        return JSON.parse(cached) as User;
    } catch {
        return null;
    }
}

function setCachedUser(user: User | null) {
    try {
        if (user) {
            localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
            sessionStorage.removeItem(AUTH_CACHE_KEY);
        } else {
            localStorage.removeItem(AUTH_CACHE_KEY);
            sessionStorage.removeItem(AUTH_CACHE_KEY);
        }
    } catch {
        /* private mode / quota */
    }
}

function isUnauthorizedError(err: unknown): boolean {
    return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

interface AuthContextValue {
    user: User | null;
    isAdmin: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
    getGoogleLoginUrl: () => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    // Prefer a localStorage cache for instant restore; always confirm with /auth/me when online.
    const [user, setUser] = useState<User | null>(() => (getAuthToken() ? getCachedUser() : null));
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const applyUser = useCallback((nextUser: User | null, admin = false, options?: { clearToken?: boolean }) => {
        setUser(nextUser);
        setIsAdmin(admin);
        setCachedUser(nextUser);
        if (!nextUser) {
            if (options?.clearToken !== false) {
                setAuthToken(null);
            }
            resetAnalyticsUser();
            return;
        }
        identifyUser(nextUser.id, {
            email: nextUser.email,
            name: nextUser.name,
            is_admin: admin,
        });
    }, []);

    const loadUser = useCallback(
        async (options?: { retries?: number }) => {
            const retries = options?.retries ?? 3;
            const hasToken = Boolean(getAuthToken());
            setIsLoading(true);

            // No stored session — stay logged out.
            if (!hasToken) {
                applyUser(null, false, { clearToken: false });
                setIsLoading(false);
                return null;
            }

            let lastError: unknown;
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const { user: nextUser, isAdmin: admin } = await authApi.getMe();
                    applyUser(nextUser, admin ?? false);
                    setIsLoading(false);
                    return nextUser;
                } catch (err) {
                    lastError = err;
                    if (isUnauthorizedError(err)) {
                        break;
                    }
                    if (attempt < retries - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
                    }
                }
            }

            // Real auth failure → clear session.
            if (isUnauthorizedError(lastError)) {
                applyUser(null);
                setIsLoading(false);
                return null;
            }

            // Transient network/server error: keep token + cached user so closing the mobile
            // browser and coming back does not force a logout.
            const cached = getCachedUser();
            if (cached) {
                applyUser(cached, false, { clearToken: false });
            }
            setIsLoading(false);
            return cached;
        },
        [applyUser]
    );

    useEffect(() => {
        const oauthToken = consumeOAuthTokenFromHash();
        if (oauthToken) setAuthToken(oauthToken);

        const params = new URLSearchParams(window.location.search);
        const isOAuthReturn = params.get("logged_in") === "1";

        void (async () => {
            const authenticatedUser = await loadUser({ retries: isOAuthReturn ? 4 : 3 });
            if (isOAuthReturn && authenticatedUser) {
                trackAuthSuccess(AnalyticsEvents.userLoggedIn, "google");
            }
            if (!isOAuthReturn) return;

            params.delete("logged_in");
            const remainingSearch = params.toString();
            navigate(
                {
                    pathname: authenticatedUser ? "/go-time" : "/login",
                    search: remainingSearch ? `?${remainingSearch}` : "",
                },
                { replace: true }
            );
        })();
    }, [loadUser, navigate]);

    const login = useCallback(
        async (email: string, password: string) => {
            const { user: nextUser, token } = await authApi.login(email, password);
            setAuthToken(token);
            applyUser(nextUser);
            trackAuthSuccess(AnalyticsEvents.userLoggedIn, "email");
            navigate("/go-time");
        },
        [navigate, applyUser]
    );

    const signup = useCallback(
        async (email: string, password: string, name?: string) => {
            const { user: nextUser, token } = await authApi.signup(email, password, name);
            setAuthToken(token);
            applyUser(nextUser);
            trackAuthSuccess(AnalyticsEvents.userSignedUp, "email");
            navigate("/go-time");
        },
        [navigate, applyUser]
    );

    const logout = useCallback(async () => {
        try {
            await authApi.logout();
        } catch {
            /* still clear local session */
        }
        applyUser(null);
        track(AnalyticsEvents.userLoggedOut);
        navigate("/");
    }, [navigate, applyUser]);

    const value: AuthContextValue = {
        user,
        isAdmin,
        isLoading,
        login,
        signup,
        logout,
        getGoogleLoginUrl: authApi.getGoogleLoginUrl,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
