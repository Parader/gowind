import { Link, Navigate } from "react-router";
import { ArrowLeft } from "@untitledui/icons";
import { useAuth } from "@/providers/auth-provider";

export const AccountSettings = () => {
    const { user, isLoading } = useAuth();

    if (!isLoading && !user) {
        return <Navigate to="/login" replace />;
    }

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
                        Account settings
                    </h1>
                    <p className="mt-2 text-md text-tertiary">
                        Manage your GoWind account.
                    </p>

                    <div className="mt-10 space-y-6">
                        <section className="rounded-xl border border-secondary bg-white p-6 dark:bg-primary">
                            <h2 className="text-lg font-semibold text-secondary">Profile</h2>
                            <dl className="mt-4 space-y-3">
                                <div>
                                    <dt className="text-xs font-semibold uppercase tracking-wider text-quaternary">Email</dt>
                                    <dd className="mt-0.5 text-md text-primary">{user?.email}</dd>
                                </div>
                                {user?.name && (
                                    <div>
                                        <dt className="text-xs font-semibold uppercase tracking-wider text-quaternary">Name</dt>
                                        <dd className="mt-0.5 text-md text-primary">{user.name}</dd>
                                    </div>
                                )}
                            </dl>
                        </section>
                    </div>
                </div>
        </main>
    );
};
