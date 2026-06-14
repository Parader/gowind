export const Privacy = () => {
    return (
        <main className="flex-1">
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">Legal</p>
                    <div className="mt-4 max-w-3xl">
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            Privacy Policy
                        </h1>
                        <p className="mt-4 text-md text-tertiary">
                            Last updated: {new Date().toLocaleDateString("en-US")}
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <div className="mx-auto max-w-3xl space-y-8 text-md text-tertiary">
                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">1. Introduction</h2>
                                <p>
                                    GoWind ("we", "our", or "us") is committed to protecting your privacy. This Privacy
                                    Policy explains how we collect, use, disclose, and safeguard your information when
                                    you use our wind window finder service at gowind.app and related services (the
                                    "Service").
                                </p>
                            </div>

                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">2. Information We Collect</h2>
                                <p className="mb-3">
                                    We collect information you provide directly to us and information we obtain
                                    automatically when you use the Service.
                                </p>
                                <p className="mb-2 font-medium text-secondary">Information you provide:</p>
                                <ul className="list-inside list-disc space-y-1 pl-2">
                                    <li>Account information: email address, name (if you choose to provide it)</li>
                                    <li>Location data: flying sites and check spots you add to your account</li>
                                    <li>Preferences: wind limits, temperature range, and other conditions you configure</li>
                                    <li>Authentication: when you sign up or log in (including via Google)</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">3. How We Use Your Information</h2>
                                <p>We use the information we collect to:</p>
                                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                                    <li>Provide, maintain, and improve the Service</li>
                                    <li>Fetch and analyze weather forecasts for your saved locations</li>
                                    <li>Send you service-related notifications (if you opt in)</li>
                                    <li>Respond to your requests and support inquiries</li>
                                    <li>Protect against fraud and abuse</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">4. Data Sharing</h2>
                                <p>
                                    We do not sell your personal information. We may share your data with:
                                </p>
                                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                                    <li>Weather data providers (e.g., Open-Meteo) when fetching forecasts for your locations</li>
                                    <li>Service providers who help us operate the Service (hosting, analytics)</li>
                                    <li>Legal authorities when required by law</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">5. Data Retention</h2>
                                <p>
                                    We retain your account data and saved locations for as long as your account is
                                    active. If you delete your account, we will remove your personal data within a
                                    reasonable period.
                                </p>
                            </div>

                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">6. Your Rights</h2>
                                <p>You may:</p>
                                <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                                    <li>Access, update, or delete your account and data through the app</li>
                                    <li>Export your data (contact us to request an export)</li>
                                    <li>Opt out of non-essential communications</li>
                                </ul>
                            </div>

                            <div>
                                <h2 className="mb-3 text-lg font-semibold text-primary">7. Contact</h2>
                                <p>
                                    For privacy-related questions, contact us at the email or address provided on the
                                    About page.
                                </p>
                            </div>
                    </div>
                </div>
            </section>
        </main>
    );
};
