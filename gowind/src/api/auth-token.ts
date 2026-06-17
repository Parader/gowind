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

/** Read token from OAuth redirect hash (`#token=...`) and remove it from the URL. */
export function consumeOAuthTokenFromHash(): string | null {
    const match = window.location.hash.match(/^#token=(.+)$/);
    if (!match?.[1]) return null;

    const token = decodeURIComponent(match[1]);
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", cleanUrl);
    return token || null;
}
