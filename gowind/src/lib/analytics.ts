import type { CookieConsentRecord } from "@/lib/cookie-consent";

let analyticsEnabled = false;

/** Apply analytics consent. Third-party analytics should only load after opt-in. */
export function applyAnalyticsConsent(consent: CookieConsentRecord): void {
    analyticsEnabled = consent.analytics;

    if (!consent.analytics) return;

    const posthogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
    if (!posthogKey) return;

    // When posthog-js is added, initialize it here after explicit consent only.
}

export function isAnalyticsEnabled(): boolean {
    return analyticsEnabled;
}
