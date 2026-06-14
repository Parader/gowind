import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { User } from "@/api/auth";
import * as authApi from "@/api/auth";

const AUTH_CACHE_KEY = "gowind_auth_user";

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

    const loadUser = useCallback(async () => {
        try {
            const { user, isAdmin: admin } = await authApi.getMe();
            setUser(user);
            setIsAdmin(admin ?? false);
            setCachedUser(user);
        } catch {
            setUser(null);
            setIsAdmin(false);
            setCachedUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const login = useCallback(
        async (email: string, password: string) => {
            const { user } = await authApi.login(email, password);
            setUser(user);
            setCachedUser(user);
            navigate("/");
        },
        [navigate]
    );

    const signup = useCallback(
        async (email: string, password: string, name?: string) => {
            const { user } = await authApi.signup(email, password, name);
            setUser(user);
            setCachedUser(user);
            navigate("/");
        },
        [navigate]
    );

    const logout = useCallback(async () => {
        await authApi.logout();
        setUser(null);
        setCachedUser(null);
        navigate("/");
    }, [navigate]);

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
