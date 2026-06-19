import { useState } from "react";
import { Link } from "react-router";
import { Lock01, Mail01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Input } from "@/components/base/input/input";
import { useAuth } from "@/providers/auth-provider";
import { useT } from "@/providers/locale-provider";
import { trackAuthFailure, trackOAuthStarted } from "@/lib/analytics";

export const Login = () => {
    const { login, getGoogleLoginUrl } = useAuth();
    const t = useT();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
        const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;
        if (!email || !password) return;
        setIsLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            trackAuthFailure("login", "email");
            setError(err instanceof Error ? err.message : t("auth.login.signInFailed"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        trackOAuthStarted("login");
        window.location.href = getGoogleLoginUrl();
    };
    return (
        <main className="relative -mt-20 flex flex-1 flex-col items-center justify-center overflow-hidden pt-20 md:-mt-[5rem] md:pt-[5rem]">
                {/* Background - image anchored to top */}
                <div
                    className="absolute inset-0 bg-cover bg-top bg-no-repeat"
                    style={{ backgroundImage: "url(/mountains.png)" }}
                    aria-hidden="true"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-primary/80" />
                <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-transparent to-primary/40" />

                {/* Form */}
                <div className="relative mx-auto w-full max-w-md px-4 py-16">
                    <div className="glass-strong rounded-2xl px-6 py-8 md:px-10 md:py-12">
                        <div className="mb-6 h-px w-12 bg-brand-400" />
                        <h1 className="text-display-sm font-semibold tracking-tight text-primary">
                            {t("auth.login.title")}
                        </h1>
                        <p className="mt-2 text-md text-tertiary">
                            {t("auth.login.subtitle")}
                        </p>

                        <div className="mt-8">
                            <Button
                                type="button"
                                size="lg"
                                color="secondary"
                                className="w-full"
                                onClick={handleGoogleLogin}
                                isDisabled={isLoading}
                            >
                                {t("auth.login.google")}
                            </Button>

                            <div className="my-6 flex items-center gap-3">
                                <div className="flex-1 border-t border-secondary" />
                                <span className="text-sm text-tertiary dark:text-secondary">{t("auth.login.orEmail")}</span>
                                <div className="flex-1 border-t border-secondary" />
                            </div>
                        </div>

                        <form
                            className="flex flex-col gap-5"
                            onSubmit={handleSubmit}
                        >
                            <Input
                                name="email"
                                type="email"
                                label={t("auth.login.emailLabel")}
                                placeholder={t("auth.login.emailPlaceholder")}
                                icon={Mail01}
                                size="md"
                                isRequired
                                autoComplete="email"
                            />
                            <Input
                                name="password"
                                type="password"
                                label={t("auth.login.passwordLabel")}
                                placeholder={t("auth.login.passwordPlaceholder")}
                                icon={Lock01}
                                size="md"
                                isRequired
                                autoComplete="current-password"
                            />

                            {error && <p className="text-sm text-error-primary">{error}</p>}

                            <div className="flex items-center justify-between">
                                <Checkbox name="remember" label={t("auth.login.rememberMe")} />
                                <Button color="link-gray" size="sm" href="/forgot-password">
                                    {t("auth.login.forgotPassword")}
                                </Button>
                            </div>

                            <Button
                                type="submit"
                                size="lg"
                                color="primary"
                                className="mt-2"
                                isLoading={isLoading}
                                isDisabled={isLoading}
                            >
                                {t("auth.login.submit")}
                            </Button>
                        </form>

                        <p className="mt-8 text-center text-sm text-tertiary">
                            {t("auth.login.noAccount")}{" "}
                            <Link
                                to="/signup"
                                className="font-semibold text-secondary underline decoration-transparent underline-offset-2 hover:decoration-current"
                            >
                                {t("auth.login.signUpFree")}
                            </Link>
                        </p>
                    </div>

                    <p className="mt-6 text-center">
                        <Link
                            to="/"
                            className="text-sm text-quaternary hover:text-tertiary"
                        >
                            {t("auth.login.backToHome")}
                        </Link>
                    </p>
                </div>
        </main>
    );
};
