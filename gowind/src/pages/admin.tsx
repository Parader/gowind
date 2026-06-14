import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { ArrowLeft, RefreshCw01, Trash01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "@/providers/auth-provider";
import * as adminApi from "@/api/admin";

export const Admin = () => {
    const { user, isAdmin, isLoading } = useAuth();
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            setError(null);
            const data = await adminApi.getApiStats();
            setCounts(data.counts);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load stats");
            setCounts({});
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin) fetchStats();
    }, [isAdmin, fetchStats]);

    const handleReset = useCallback(async () => {
        if (!confirm("Reset all API call counts?")) return;
        try {
            await adminApi.resetApiStats();
            setCounts({});
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to reset");
        }
    }, []);

    if (!isLoading && !user) {
        return <Navigate to="/login" replace />;
    }

    if (!isLoading && user && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    const entries = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
    const total = Object.values(counts).reduce((s, n) => s + n, 0);

    return (
        <main className="relative flex flex-1 flex-col">
            <div className="mx-auto w-full max-w-2xl px-4 py-12 md:px-8 md:py-16">
                <Link
                    to="/"
                    className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-secondary_hover"
                >
                    <ArrowLeft className="size-4" />
                    Back to home
                </Link>

                <div className="mb-6 h-px w-12 bg-brand-400" />
                <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                    Admin — API call counts
                </h1>
                <p className="mt-2 text-md text-tertiary">
                    External API requests since last server restart.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Button
                        size="md"
                        color="secondary"
                        iconLeading={RefreshCw01}
                        onClick={fetchStats}
                        isDisabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        size="md"
                        color="secondary"
                        iconLeading={Trash01}
                        onClick={handleReset}
                        isDisabled={loading || total === 0}
                    >
                        Reset counts
                    </Button>
                </div>

                {error && (
                    <p className="mt-4 text-sm text-error-600 dark:text-error-400">{error}</p>
                )}

                <section className="mt-8 rounded-xl border border-secondary bg-white dark:bg-primary">
                    {loading ? (
                        <div className="p-8 text-center text-tertiary">Loading…</div>
                    ) : entries.length === 0 ? (
                        <div className="p-8 text-center text-tertiary">
                            No API calls recorded yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-secondary bg-secondary_alt/30">
                                        <th className="px-4 py-3 text-left font-semibold text-secondary">API</th>
                                        <th className="px-4 py-3 text-right font-semibold text-secondary">Calls</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map(([api, n]) => (
                                        <tr
                                            key={api}
                                            className="border-b border-secondary/50 hover:bg-secondary_alt/20"
                                        >
                                            <td className="px-4 py-3 font-mono text-primary">{api}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-secondary">
                                                {n.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-secondary bg-secondary_alt/30 font-semibold">
                                        <td className="px-4 py-3 text-primary">Total</td>
                                        <td className="px-4 py-3 text-right tabular-nums text-secondary">
                                            {total.toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
};
