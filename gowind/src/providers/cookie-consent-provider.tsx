import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CookieBanner } from "@/components/marketing/cookie-banner/cookie-banner";
import { applyAnalyticsConsent } from "@/lib/analytics";
import {
    createConsentRecord,
    hasCookieConsentAnswer,
    readCookieConsent,
    writeCookieConsent,
    type CookieConsentRecord,
} from "@/lib/cookie-consent";

interface CookieConsentContextValue {
    consent: CookieConsentRecord | null;
    acceptAll: () => void;
    rejectNonEssential: () => void;
    savePreferences: (analytics: boolean) => void;
    openPreferences: () => void;
    closePreferences: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
    const [consent, setConsent] = useState<CookieConsentRecord | null>(() => readCookieConsent());
    const [bannerOpen, setBannerOpen] = useState(() => !hasCookieConsentAnswer());
    const [preferencesOpen, setPreferencesOpen] = useState(false);

    const persist = useCallback((record: CookieConsentRecord) => {
        writeCookieConsent(record);
        setConsent(record);
        applyAnalyticsConsent(record);
        setBannerOpen(false);
        setPreferencesOpen(false);
    }, []);

    const acceptAll = useCallback(() => {
        persist(createConsentRecord(true));
    }, [persist]);

    const rejectNonEssential = useCallback(() => {
        persist(createConsentRecord(false));
    }, [persist]);

    const savePreferences = useCallback(
        (analytics: boolean) => {
            persist(createConsentRecord(analytics));
        },
        [persist]
    );

    const openPreferences = useCallback(() => {
        setPreferencesOpen(true);
        setBannerOpen(true);
    }, []);

    const closePreferences = useCallback(() => {
        setPreferencesOpen(false);
        if (hasCookieConsentAnswer()) {
            setBannerOpen(false);
        }
    }, []);

    useEffect(() => {
        const existing = readCookieConsent();
        if (existing) {
            applyAnalyticsConsent(existing);
        }
    }, []);

    const value = useMemo(
        () => ({
            consent,
            acceptAll,
            rejectNonEssential,
            savePreferences,
            openPreferences,
            closePreferences,
        }),
        [consent, acceptAll, rejectNonEssential, savePreferences, openPreferences, closePreferences]
    );

    return (
        <CookieConsentContext.Provider value={value}>
            {children}
            {bannerOpen ? (
                <CookieBanner
                    consent={consent}
                    preferencesOpen={preferencesOpen}
                    onAcceptAll={acceptAll}
                    onRejectNonEssential={rejectNonEssential}
                    onSavePreferences={savePreferences}
                    onOpenPreferences={() => setPreferencesOpen(true)}
                    onClosePreferences={closePreferences}
                />
            ) : null}
        </CookieConsentContext.Provider>
    );
}

export function useCookieConsent() {
    const ctx = useContext(CookieConsentContext);
    if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
    return ctx;
}
