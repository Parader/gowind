import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { Toggle } from "@/components/base/toggle/toggle";
import type { CookieConsentRecord } from "@/lib/cookie-consent";
import { cx } from "@/utils/cx";

interface CookieBannerProps {
    consent: CookieConsentRecord | null;
    preferencesOpen: boolean;
    onAcceptAll: () => void;
    onRejectNonEssential: () => void;
    onSavePreferences: (analytics: boolean) => void;
    onOpenPreferences: () => void;
    onClosePreferences: () => void;
}

export const CookieBanner = ({
    consent,
    preferencesOpen,
    onAcceptAll,
    onRejectNonEssential,
    onSavePreferences,
    onOpenPreferences,
    onClosePreferences,
}: CookieBannerProps) => {
    const [analyticsEnabled, setAnalyticsEnabled] = useState(consent?.analytics ?? false);

    const handleOpenPreferences = () => {
        setAnalyticsEnabled(consent?.analytics ?? false);
        onOpenPreferences();
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:p-6"
            role="dialog"
            aria-labelledby="cookie-banner-title"
            aria-describedby="cookie-banner-description"
            aria-modal="false"
        >
            <div className="pointer-events-none absolute inset-0 bg-overlay/50 backdrop-blur-[1px]" aria-hidden="true" />

            <div className="pointer-events-auto relative mx-auto w-full max-w-container">
                <div className="rounded-2xl border border-secondary bg-primary px-4 py-5 shadow-2xl ring-1 ring-secondary sm:px-6 sm:py-6 dark:bg-primary dark:shadow-[0_-8px_40px_rgba(0,0,0,0.45)]">
                    <div className="flex flex-col gap-4">
                        <div>
                            <h2 id="cookie-banner-title" className="text-md font-semibold text-primary sm:text-lg">
                                Cookie preferences
                            </h2>
                            <p id="cookie-banner-description" className="mt-2 text-sm leading-relaxed text-secondary">
                                We use essential cookies and local storage to keep you signed in, remember your theme, and
                                run GoWind. With your consent, we may also use analytics cookies to understand how the
                                service is used and improve it. This notice meets GDPR and Quebec Law 25 (Loi 25)
                                requirements.{" "}
                                <Link to="/privacy" className="font-medium text-primary underline underline-offset-2 hover:text-brand-600 dark:hover:text-brand-400">
                                    Privacy Policy
                                </Link>
                            </p>
                        </div>

                        {preferencesOpen ? (
                            <div className="space-y-4 rounded-xl border border-secondary bg-secondary_alt px-4 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-primary">Essential</p>
                                        <p className="mt-1 text-sm leading-snug text-secondary">
                                            Required for sign-in, security, and basic app functionality. Always active.
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary">
                                        Always on
                                    </span>
                                </div>

                                <div className="flex items-start justify-between gap-4 border-t border-secondary pt-4">
                                    <div className="min-w-0 flex-1 pr-2">
                                        <p className="text-sm font-semibold text-primary">Analytics</p>
                                        <p className="mt-1 text-sm leading-snug text-secondary">
                                            Helps us measure traffic and improve GoWind. Optional.
                                        </p>
                                    </div>
                                    <Toggle
                                        size="md"
                                        isSelected={analyticsEnabled}
                                        onChange={setAnalyticsEnabled}
                                        aria-label="Enable analytics cookies"
                                        className="shrink-0"
                                    />
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                    <Button color="secondary" size="md" className="w-full sm:w-auto" onClick={onClosePreferences}>
                                        {consent ? "Close" : "Back"}
                                    </Button>
                                    <Button
                                        color="primary"
                                        size="md"
                                        className="w-full sm:w-auto"
                                        onClick={() => onSavePreferences(analyticsEnabled)}
                                    >
                                        Save preferences
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div
                                className={cx(
                                    "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end",
                                )}
                            >
                                <Button
                                    color="link-gray"
                                    size="md"
                                    className="order-3 w-full justify-center sm:order-1 sm:mr-auto sm:w-auto sm:justify-start"
                                    onClick={handleOpenPreferences}
                                >
                                    Manage preferences
                                </Button>
                                <Button color="secondary" size="md" className="order-1 w-full sm:order-2 sm:w-auto" onClick={onRejectNonEssential}>
                                    Reject non-essential
                                </Button>
                                <Button color="primary" size="md" className="order-2 w-full sm:order-3 sm:w-auto" onClick={onAcceptAll}>
                                    Accept all
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
