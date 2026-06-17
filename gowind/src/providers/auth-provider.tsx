import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { User } from "@/api/auth";
import * as authApi from "@/api/auth";
import { consumeOAuthTokenFromHash, setAuthToken } from "@/api/auth-token";

const AUTH_CACHE_KEY = "gowind_auth_user";

export function getCachedAuthUser(): User | null {
    return getCachedUser();
}

function getCachedUser(): User | null {
    try {
        const cached = sessionStorage.getItem(AUTH_CACHE_KEY);
        return cached ? (JSON.parse(cached) as User) : null;
    } catch {
        return null;
    }
}

function setCachedUser(user: User | null) {
    if (user) {
        sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    } else {
        sessionStorage.removeItem(AUTH_CACHE_KEY);
    }
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
    const [user, setUser] = useState<User | null>(getCachedUser);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const applyUser = useCallback((nextUser: User | null, admin = false) => {
        setUser(nextUser);
        setIsAdmin(admin);
        setCachedUser(nextUser);
        if (!nextUser) setAuthToken(null);
    }, []);

    const loadUser = useCallback(
        async (options?: { retries?: number }) => {
            const retries = options?.retries ?? 1;
            setIsLoading(true);

            for (let attempt = 0; attempt < retries; attempt++) {
                try {
                    const { user: nextUser, isAdmin: admin } = await authApi.getMe();
                    applyUser(nextUser, admin ?? false);
                    setIsLoading(false);
                    return nextUser;
                } catch {
                    if (attempt < retries - 1) {
                        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
                    }
                }
            }

            applyUser(null);
            setIsLoading(false);
            return null;
        },
        [applyUser]
    );

    useEffect(() => {
        const oauthToken = consumeOAuthTokenFromHash();
        if (oauthToken) setAuthToken(oauthToken);

        const params = new URLSearchParams(window.location.search);
        const isOAuthReturn = params.get("logged_in") === "1";

        void (async () => {
            const authenticatedUser = await loadUser({ retries: isOAuthReturn ? 3 : 1 });
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
            navigate("/go-time");
        },
        [navigate, applyUser]
    );

    const signup = useCallback(
        async (email: string, password: string, name?: string) => {
            const { user: nextUser, token } = await authApi.signup(email, password, name);
            setAuthToken(token);
            applyUser(nextUser);
            navigate("/go-time");
        },
        [navigate, applyUser]
    );

    const logout = useCallback(async () => {
        await authApi.logout();
        applyUser(null);
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
