import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { GoTimeWindowCard } from "@/components/go-time/go-time-window-card";
import { getGoTimeShare, type GoTimeShareResponse } from "@/api/go-time-shares";
import { useAuth } from "@/providers/auth-provider";
import { useLocale, useT } from "@/providers/locale-provider";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics-events";

function formatExpiry(iso: string, dateLocale: string): string {
    return new Intl.DateTimeFormat(dateLocale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}

export function GoTimeShare() {
    const [params] = useSearchParams();
    const shareId = params.get("id") ?? "";
    const { user, isLoading: authLoading } = useAuth();
    const t = useT();
    const { dateLocale } = useLocale();
    const [share, setShare] = useState<GoTimeShareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shareId) {
            setError(t("goTimeShare.missingId"));
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);
        getGoTimeShare(shareId)
            .then((data) => {
                if (!cancelled) {
                    setShare(data);
                    track(AnalyticsEvents.goTimeShareViewed, {
                        share_id: shareId,
                        available: true,
                        category: data.snapshot.window.category,
                    });
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : t("goTimeShare.unavailable"));
                    track(AnalyticsEvents.goTimeShareViewed, {
                        share_id: shareId,
                        available: false,
                    });
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [shareId, t]);

    const showUnavailable = !isLoading && (error || !share);

    return (
        <main className="flex min-h-[70vh] flex-1 bg-primary">
            <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-12 md:px-8 md:py-16">
                <div className="mb-6 h-px w-12 bg-brand-400" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
                    {t("goTimeShare.eyebrow")}
                </p>
                <h1 className="mt-3 text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                    {t("goTimeShare.title")}
                </h1>

                {isLoading ? (
                    <div className="mt-10 rounded-xl border border-secondary bg-white px-6 py-10 text-center dark:bg-primary">
                        <LoadingIndicator type="dot-circle" size="lg" label={t("goTimeShare.loading")} />
                    </div>
                ) : null}

                {share ? (
                    <div className="mt-8 space-y-5">
                        <div className="rounded-lg border border-warning-secondary bg-warning-secondary px-4 py-3 text-sm text-warning-primary">
                            {t("goTimeShare.snapshotWarning")}
                        </div>
                        <GoTimeWindowCard w={share.snapshot.window} allowShare={false} />
                        <p className="text-sm text-tertiary">
                            {t("goTimeShare.expires", { date: formatExpiry(share.expiresAt, dateLocale) })}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button href="/signup" size="lg">
                                {t("goTimeShare.createAccount")}
                            </Button>
                            <Button href="/go-time" color="secondary" size="lg">
                                {t("goTimeShare.openGoTime")}
                            </Button>
                        </div>
                    </div>
                ) : null}

                {showUnavailable ? (
                    <div className="mt-8 rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                        <h2 className="text-lg font-semibold text-primary">{t("goTimeShare.unavailableTitle")}</h2>
                        <p className="mt-2 text-sm text-tertiary">{t("goTimeShare.unavailableDescription")}</p>
                        {error ? <p className="mt-3 text-sm text-tertiary">{error}</p> : null}
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            {!authLoading && user ? (
                                <Button href="/go-time" size="lg">
                                    {t("goTimeShare.goToYourGoTime")}
                                </Button>
                            ) : (
                                <>
                                    <Button href="/signup" size="lg">
                                        {t("goTimeShare.signUp")}
                                    </Button>
                                    <Button href="/login" color="secondary" size="lg">
                                        {t("goTimeShare.logIn")}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </main>
    );
}
