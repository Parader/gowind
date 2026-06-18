export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_STORAGE_KEY = "gowind_cookie_consent";

export type CookieConsentRecord = {
    version: typeof COOKIE_CONSENT_VERSION;
    essential: true;
    analytics: boolean;
    updatedAt: string;
};

export function readCookieConsent(): CookieConsentRecord | null {
    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CookieConsentRecord;
        if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
        if (typeof parsed.analytics !== "boolean") return null;
        return parsed;
    } catch {
        return null;
    }
}

export function writeCookieConsent(record: CookieConsentRecord): void {
    try {
        localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
    } catch {
        // ignore storage errors
    }
}

export function createConsentRecord(analytics: boolean): CookieConsentRecord {
    return {
        version: COOKIE_CONSENT_VERSION,
        essential: true,
        analytics,
        updatedAt: new Date().toISOString(),
    };
}

export function hasCookieConsentAnswer(): boolean {
    return readCookieConsent() !== null;
}
