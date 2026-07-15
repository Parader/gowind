import posthog from "posthog-js";
import type { CookieConsentRecord } from "@/lib/cookie-consent";
import { AnalyticsEvents } from "@/lib/analytics-events";

let analyticsEnabled = false;
let initialized = false;

function posthogKey(): string | undefined {
    return import.meta.env.VITE_POSTHOG_KEY?.trim() || undefined;
}

function posthogHost(): string {
    return import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
}

function initPostHog(): void {
    const key = posthogKey();
    if (!key || initialized) return;

    posthog.init(key, {
        api_host: posthogHost(),
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        autocapture: true,
        loaded: (client) => {
            if (analyticsEnabled) {
                client.opt_in_capturing();
            }
        },
    });
    initialized = true;
}

function shutdownCapturing(): void {
    if (!initialized) return;
    posthog.opt_out_capturing();
    posthog.reset();
}

/** Apply analytics consent. PostHog loads only after explicit opt-in. */
export function applyAnalyticsConsent(consent: CookieConsentRecord): void {
    const wasEnabled = analyticsEnabled;
    analyticsEnabled = consent.analytics;

    if (!consent.analytics) {
        if (wasEnabled) shutdownCapturing();
        return;
    }

    initPostHog();
    if (initialized) {
        posthog.opt_in_capturing();
        identifyCachedUser();
        trackPageView(window.location.pathname, window.location.search);
    }
}

function identifyCachedUser(): void {
    try {
        const cached = localStorage.getItem("gowind_auth_user") ?? sessionStorage.getItem("gowind_auth_user");
        if (!cached) return;
        const user = JSON.parse(cached) as { id: string; email?: string; name?: string };
        if (user?.id) {
            identifyUser(user.id, { email: user.email, name: user.name });
        }
    } catch {
        /* ignore */
    }
}

export function isAnalyticsEnabled(): boolean {
    return analyticsEnabled && initialized;
}

export function track(event: string, properties?: Record<string, unknown>): void {
    if (!analyticsEnabled || !initialized) return;
    posthog.capture(event, properties);
}

export function trackPageView(pathname: string, search = ""): void {
    track(AnalyticsEvents.pageView, {
        $current_url: `${window.location.origin}${pathname}${search}`,
        pathname,
        search,
    });
}

export function identifyUser(
    userId: string,
    traits?: { email?: string; name?: string; is_admin?: boolean },
): void {
    if (!analyticsEnabled || !initialized) return;
    posthog.identify(userId, traits);
}

export function resetAnalyticsUser(): void {
    if (!initialized) return;
    posthog.reset();
}

export function trackCookieConsent(analytics: boolean, source: "accept_all" | "reject" | "preferences"): void {
    track(AnalyticsEvents.cookieConsentUpdated, { analytics, source });
}

export function trackAuthSuccess(
    event: typeof AnalyticsEvents.userSignedUp | typeof AnalyticsEvents.userLoggedIn,
    method: "email" | "google",
): void {
    track(event, { method });
}

export function trackAuthFailure(action: "login" | "signup", method: "email" | "google"): void {
    track(AnalyticsEvents.authFailed, { action, method });
}

export function trackOAuthStarted(action: "login" | "signup"): void {
    track(AnalyticsEvents.oauthStarted, { action });
}
