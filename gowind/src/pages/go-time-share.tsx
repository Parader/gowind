import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/base/buttons/button";
import { LoadingIndicator } from "@/components/application/loading-indicator/loading-indicator";
import { GoTimeWindowCard } from "@/components/go-time/go-time-window-card";
import { getGoTimeShare, type GoTimeShareResponse } from "@/api/go-time-shares";
import { useAuth } from "@/providers/auth-provider";

function formatExpiry(iso: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
}

export function GoTimeShare() {
    const [params] = useSearchParams();
    const shareId = params.get("id") ?? "";
    const { user, isLoading: authLoading } = useAuth();
    const [share, setShare] = useState<GoTimeShareResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!shareId) {
            setError("This shared go-time window is missing a share id.");
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);
        getGoTimeShare(shareId)
            .then((data) => {
                if (!cancelled) setShare(data);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "This shared go-time window is unavailable.");
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [shareId]);

    const showUnavailable = !isLoading && (error || !share);

    return (
        <main className="flex min-h-[70vh] flex-1 bg-primary">
            <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-12 md:px-8 md:py-16">
                <div className="mb-6 h-px w-12 bg-brand-400" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">Shared Go Time</p>
                <h1 className="mt-3 text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                    Shared flying window
                </h1>

                {isLoading ? (
                    <div className="mt-10 rounded-xl border border-secondary bg-white px-6 py-10 text-center dark:bg-primary">
                        <LoadingIndicator type="dot-circle" size="lg" label="Loading shared window..." />
                    </div>
                ) : null}

                {share ? (
                    <div className="mt-8 space-y-5">
                        <div className="rounded-lg border border-warning-secondary bg-warning-secondary px-4 py-3 text-sm text-warning-primary">
                            This is a snapshot shared from GoWind. Weather changes quickly, so this window may no
                            longer be valid or safe to use. Always check current conditions before flying.
                        </div>
                        <GoTimeWindowCard w={share.snapshot.window} allowShare={false} />
                        <p className="text-sm text-tertiary">
                            This shared link expires around {formatExpiry(share.expiresAt)}.
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button href="/signup" size="lg">
                                Create your own GoWind account
                            </Button>
                            <Button href="/go-time" color="secondary" size="lg">
                                Open Go Time
                            </Button>
                        </div>
                    </div>
                ) : null}

                {showUnavailable ? (
                    <div className="mt-8 rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                        <h2 className="text-lg font-semibold text-primary">This shared window is no longer available</h2>
                        <p className="mt-2 text-sm text-tertiary">
                            Shared Go Time links expire after a few hours because forecast data can become outdated.
                        </p>
                        {error ? <p className="mt-3 text-sm text-tertiary">{error}</p> : null}
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            {!authLoading && user ? (
                                <Button href="/go-time" size="lg">
                                    Go to your Go Time
                                </Button>
                            ) : (
                                <>
                                    <Button href="/signup" size="lg">
                                        Sign up
                                    </Button>
                                    <Button href="/login" color="secondary" size="lg">
                                        Log in
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
