const AUTH_TOKEN_KEY = "gowind_auth_token";

export function getAuthToken(): string | null {
    try {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setAuthToken(token: string | null): void {
    try {
        if (token) {
            localStorage.setItem(AUTH_TOKEN_KEY, token);
        } else {
            localStorage.removeItem(AUTH_TOKEN_KEY);
        }
    } catch {
        // ignore storage errors (private mode, etc.)
    }
}

/**
 * Read OAuth token from redirect URL and scrub it from the address bar.
 * Prefers `?token=` (current API), still accepts legacy `#token=` hashes.
 */
export function consumeOAuthTokenFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("token");
    const hashMatch = window.location.hash.match(/^#token=(.+)$/);
    const fromHash = hashMatch?.[1] ? decodeURIComponent(hashMatch[1]) : null;
    const token = (fromQuery || fromHash || "").trim();

    if (!token && !fromQuery && !hashMatch) return null;

    params.delete("token");
    const search = params.toString();
    const cleanUrl = window.location.pathname + (search ? `?${search}` : "");
    window.history.replaceState(null, "", cleanUrl);
    return token || null;
}

/** @deprecated Use consumeOAuthTokenFromUrl */
export function consumeOAuthTokenFromHash(): string | null {
    return consumeOAuthTokenFromUrl();
}
