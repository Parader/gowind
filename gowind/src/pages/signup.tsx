import { useState } from "react";
import { Link } from "react-router";
import { Lock01, Mail01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useAuth } from "@/providers/auth-provider";

export const Signup = () => {
    const { signup, getGoogleLoginUrl } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement)?.value;
        const password = (form.elements.namedItem("password") as HTMLInputElement)?.value;
        const name = (form.elements.namedItem("fullName") as HTMLInputElement)?.value;
        if (!email || !password) return;
        setIsLoading(true);
        try {
            await signup(email, password, name || undefined);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign up failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignup = () => {
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
                            Create your account
                        </h1>
                        <p className="mt-2 text-md text-tertiary">
                            Get started with GoWind and find your next good wind window.
                        </p>

                        <form
                            className="mt-8 flex flex-col gap-5"
                            onSubmit={handleSubmit}
                        >
                            <Input
                                name="fullName"
                                label="Name"
                                placeholder="Your name"
                                size="md"
                                autoComplete="name"
                            />
                            <Input
                                name="email"
                                type="email"
                                label="Email"
                                placeholder="you@example.com"
                                icon={Mail01}
                                size="md"
                                isRequired
                                autoComplete="email"
                            />
                            <Input
                                name="password"
                                type="password"
                                label="Password"
                                placeholder="Create a password"
                                icon={Lock01}
                                size="md"
                                isRequired
                                autoComplete="new-password"
                            />

                            {error && <p className="text-sm text-error-primary">{error}</p>}

                            <Button
                                type="submit"
                                size="lg"
                                color="primary"
                                className="mt-2"
                                isLoading={isLoading}
                                isDisabled={isLoading}
                            >
                                Create account
                            </Button>

                            <div className="my-4 flex items-center gap-3">
                                <div className="flex-1 border-t border-secondary" />
                                <span className="text-sm text-tertiary dark:text-secondary">or</span>
                                <div className="flex-1 border-t border-secondary" />
                            </div>

                            <Button
                                type="button"
                                size="lg"
                                color="secondary"
                                className="w-full"
                                onClick={handleGoogleSignup}
                                isDisabled={isLoading}
                            >
                                Sign up with Google
                            </Button>
                        </form>

                        <p className="mt-8 text-center text-sm text-tertiary">
                            Already have an account?{" "}
                            <Link
                                to="/login"
                                className="font-semibold text-secondary underline decoration-transparent underline-offset-2 hover:decoration-current"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>

                    <p className="mt-6 text-center">
                        <Link
                            to="/"
                            className="text-sm text-quaternary hover:text-tertiary"
                        >
                            ← Back to home
                        </Link>
                    </p>
                </div>
        </main>
    );
};
