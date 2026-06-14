export const Terms = () => {
    return (
        <main className="flex-1">
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">Legal</p>
                    <div className="mt-4 max-w-3xl">
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            Terms of Service
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
                            <h2 className="mb-3 text-lg font-semibold text-primary">1. Acceptance of Terms</h2>
                            <p>
                                By accessing or using GoWind ("the Service"), you agree to be bound by these Terms of
                                Service. If you do not agree, do not use the Service.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">2. Description of Service</h2>
                            <p>
                                GoWind is a wind window finder that helps you identify when and where weather conditions
                                match your preferences for outdoor activities such as paramotoring, paragliding, sailing,
                                kite surfing, and other wind-sensitive pursuits. The Service provides weather forecast
                                analysis and personalized recommendations based on locations and preferences you configure.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">3. Use of Weather Data</h2>
                            <p>
                                Weather forecasts are provided by third-party data providers (e.g., Open-Meteo,
                                WeatherAPI). GoWind does not guarantee the accuracy, completeness, or timeliness of
                                forecast data. Weather conditions can change rapidly. Do not rely solely on GoWind for
                                aviation or safety-critical decisions. Always verify conditions through official sources
                                and use your own judgment.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">4. Eligibility</h2>
                            <p>
                                You must be at least 13 years of age to use the Service. If you are under 18, you should
                                have parental or guardian consent. You are responsible for ensuring your use complies
                                with applicable local laws.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">5. Account Responsibilities</h2>
                            <p>
                                You are responsible for maintaining the confidentiality of your account credentials and
                                for all activity under your account. You agree to provide accurate information and to
                                notify us promptly of any unauthorized use.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">6. Acceptable Use</h2>
                            <p className="mb-2">You agree not to:</p>
                            <ul className="list-inside list-disc space-y-1 pl-2">
                                <li>Use the Service for any unlawful purpose</li>
                                <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
                                <li>Interfere with or disrupt the Service or its infrastructure</li>
                                <li>Scrape, harvest, or misuse data from the Service</li>
                                <li>Resell or sublicense access to the Service without permission</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">7. Disclaimer of Warranties</h2>
                            <p>
                                The Service is provided "as is" and "as available" without warranties of any kind, either
                                express or implied. We do not warrant that the Service will be uninterrupted, error-free,
                                or fit for any particular purpose. Use of the Service for flying or other activities
                                involving physical risk is at your own risk.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">8. Limitation of Liability</h2>
                            <p>
                                To the fullest extent permitted by law, GoWind and its operators shall not be liable for
                                any indirect, incidental, special, consequential, or punitive damages, or any loss of
                                profits, data, or goodwill, arising from your use of the Service. This includes but is
                                not limited to decisions made based on weather information displayed by the Service.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">9. Changes</h2>
                            <p>
                                We may update these Terms from time to time. We will notify you of material changes by
                                posting the updated Terms and updating the "Last updated" date. Continued use of the
                                Service after changes constitutes acceptance of the revised Terms.
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">10. Contact</h2>
                            <p>
                                For questions about these Terms, contact us via the information provided on the About
                                page.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};
