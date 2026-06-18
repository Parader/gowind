import { useLocale } from "@/providers/locale-provider";

export const Terms = () => {
    const { t, dateLocale } = useLocale();
    const lastUpdated = new Date().toLocaleDateString(dateLocale);

    return (
        <main className="flex-1">
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("terms.eyebrow")}</p>
                    <div className="mt-4 max-w-3xl">
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            {t("terms.title")}
                        </h1>
                        <p className="mt-4 text-md text-tertiary">
                            {t("terms.lastUpdated", { date: lastUpdated })}
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <div className="mx-auto max-w-3xl space-y-8 text-md text-tertiary">
                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.acceptance.title")}</h2>
                            <p>{t("terms.sections.acceptance.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.description.title")}</h2>
                            <p>{t("terms.sections.description.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.weatherData.title")}</h2>
                            <p>{t("terms.sections.weatherData.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.eligibility.title")}</h2>
                            <p>{t("terms.sections.eligibility.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.account.title")}</h2>
                            <p>{t("terms.sections.account.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.acceptableUse.title")}</h2>
                            <p className="mb-2">{t("terms.sections.acceptableUse.intro")}</p>
                            <ul className="list-inside list-disc space-y-1 pl-2">
                                <li>{t("terms.sections.acceptableUse.items.unlawful")}</li>
                                <li>{t("terms.sections.acceptableUse.items.unauthorized")}</li>
                                <li>{t("terms.sections.acceptableUse.items.interfere")}</li>
                                <li>{t("terms.sections.acceptableUse.items.scrape")}</li>
                                <li>{t("terms.sections.acceptableUse.items.resell")}</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.disclaimer.title")}</h2>
                            <p>{t("terms.sections.disclaimer.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.liability.title")}</h2>
                            <p>{t("terms.sections.liability.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.changes.title")}</h2>
                            <p>{t("terms.sections.changes.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("terms.sections.contact.title")}</h2>
                            <p>{t("terms.sections.contact.body")}</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};
