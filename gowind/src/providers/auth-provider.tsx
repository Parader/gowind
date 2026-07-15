import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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

function requestPersistentStorage() {
    try {
        void navigator.storage?.persist?.();
    } catch {
        /* ignore */
    }
}

interface AuthContextValue {
    user: User | null;
    isAdmin: boolean;
    /** True until the first session check finishes (or we know there is no token). */
    isLoading: boolean;
    /** True when a token exists locally — protected routes should not bounce to login yet. */
    hasSession: boolean;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name?: string) => Promise<void>;
    logout: () => Promise<void>;
    getGoogleLoginUrl: () => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readInitialSession(): { user: User | null; hasSession: boolean } {
    const token = getAuthToken();
    if (!token) return { user: null, hasSession: false };
    return { user: getCachedUser(), hasSession: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const initial = readInitialSession();
    const [user, setUser] = useState<User | null>(initial.user);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(initial.hasSession);
    const [hasSession, setHasSession] = useState(initial.hasSession);
    const navigate = useNavigate();
    const loadGeneration = useRef(0);

    const applyUser = useCallback((nextUser: User | null, admin = false, options?: { clearToken?: boolean }) => {
        setUser(nextUser);
        setIsAdmin(admin);
        setCachedUser(nextUser);
        if (!nextUser) {
            if (options?.clearToken !== false) {
                setAuthToken(null);
                setHasSession(false);
            }
            resetAnalyticsUser();
            return;
        }
        setHasSession(true);
        identifyUser(nextUser.id, {
            email: nextUser.email,
            name: nextUser.name,
            is_admin: admin,
        });
    }, []);

    const loadUser = useCallback(
        async (options?: { retries?: number }) => {
            const generation = ++loadGeneration.current;
            const retries = options?.retries ?? 3;
            const token = getAuthToken();
            setIsLoading(true);

            if (!token) {
                if (generation !== loadGeneration.current) return null;
                applyUser(null, false, { clearToken: false });
                setHasSession(false);
                setIsLoading(false);
                return null;
            }

            setHasSession(true);
            requestPersistentStorage();

            let lastError: unknown;
            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const { user: nextUser, isAdmin: admin } = await authApi.getMe();
                    if (generation !== loadGeneration.current) return nextUser;
                    applyUser(nextUser, admin ?? false);
                    setIsLoading(false);
                    return nextUser;
                } catch (err) {
                    lastError = err;
                    if (isUnauthorizedError(err)) break;
                    if (attempt < retries - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
                    }
                }
            }

            if (generation !== loadGeneration.current) return null;

            if (isUnauthorizedError(lastError)) {
                applyUser(null);
                setIsLoading(false);
                return null;
            }

            // Network/server blip: keep local session so killing Chrome does not log the user out.
            const cached = getCachedUser();
            if (cached) {
                applyUser(cached, false, { clearToken: false });
            } else {
                // Token still present — stay "has session" and avoid login bounce; user refetch later.
                setHasSession(true);
            }
            setIsLoading(false);
            return cached;
        },
        [applyUser]
    );

    useEffect(() => {
        const oauthToken = consumeOAuthTokenFromHash();
        if (oauthToken) {
            setAuthToken(oauthToken);
            setHasSession(true);
        }

        const params = new URLSearchParams(window.location.search);
        const isOAuthReturn = params.get("logged_in") === "1";

        void (async () => {
            const authenticatedUser = await loadUser({ retries: isOAuthReturn ? 5 : 4 });
            if (isOAuthReturn && authenticatedUser) {
                trackAuthSuccess(AnalyticsEvents.userLoggedIn, "google");
            }
            if (!isOAuthReturn) return;

            params.delete("logged_in");
            const remainingSearch = params.toString();
            navigate(
                {
                    pathname: authenticatedUser || getAuthToken() ? "/go-time" : "/login",
                    search: remainingSearch ? `?${remainingSearch}` : "",
                },
                { replace: true }
            );
        })();
    }, [loadUser, navigate]);

    // Re-validate when the tab/app becomes visible again (mobile Chrome resume).
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            if (!getAuthToken()) return;
            void loadUser({ retries: 2 });
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        return () => {
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
        };
    }, [loadUser]);

    const login = useCallback(
        async (email: string, password: string) => {
            const { user: nextUser, token } = await authApi.login(email, password);
            setAuthToken(token);
            setHasSession(true);
            requestPersistentStorage();
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
            setHasSession(true);
            requestPersistentStorage();
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
        hasSession,
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
