import { useLocale } from "@/providers/locale-provider";

export const Privacy = () => {
    const { t, dateLocale } = useLocale();
    const lastUpdated = new Date().toLocaleDateString(dateLocale);

    return (
        <main className="flex-1">
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("privacy.eyebrow")}</p>
                    <div className="mt-4 max-w-3xl">
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            {t("privacy.title")}
                        </h1>
                        <p className="mt-4 text-md text-tertiary">
                            {t("privacy.lastUpdated", { date: lastUpdated })}
                        </p>
                    </div>
                </div>
            </section>

            <section className="bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <div className="mx-auto max-w-3xl space-y-8 text-md text-tertiary">
                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.introduction.title")}</h2>
                            <p>{t("privacy.sections.introduction.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.informationWeCollect.title")}</h2>
                            <p className="mb-3">{t("privacy.sections.informationWeCollect.intro")}</p>
                            <p className="mb-2 font-medium text-secondary">{t("privacy.sections.informationWeCollect.youProvide")}</p>
                            <ul className="list-inside list-disc space-y-1 pl-2">
                                <li>{t("privacy.sections.informationWeCollect.items.account")}</li>
                                <li>{t("privacy.sections.informationWeCollect.items.locations")}</li>
                                <li>{t("privacy.sections.informationWeCollect.items.preferences")}</li>
                                <li>{t("privacy.sections.informationWeCollect.items.authentication")}</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.howWeUse.title")}</h2>
                            <p>{t("privacy.sections.howWeUse.intro")}</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                                <li>{t("privacy.sections.howWeUse.items.provide")}</li>
                                <li>{t("privacy.sections.howWeUse.items.forecasts")}</li>
                                <li>{t("privacy.sections.howWeUse.items.notifications")}</li>
                                <li>{t("privacy.sections.howWeUse.items.support")}</li>
                                <li>{t("privacy.sections.howWeUse.items.fraud")}</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.dataSharing.title")}</h2>
                            <p>{t("privacy.sections.dataSharing.intro")}</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                                <li>{t("privacy.sections.dataSharing.items.weather")}</li>
                                <li>{t("privacy.sections.dataSharing.items.providers")}</li>
                                <li>{t("privacy.sections.dataSharing.items.legal")}</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.dataRetention.title")}</h2>
                            <p>{t("privacy.sections.dataRetention.body")}</p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.yourRights.title")}</h2>
                            <p>{t("privacy.sections.yourRights.intro")}</p>
                            <ul className="mt-2 list-inside list-disc space-y-1 pl-2">
                                <li>{t("privacy.sections.yourRights.items.access")}</li>
                                <li>{t("privacy.sections.yourRights.items.export")}</li>
                                <li>{t("privacy.sections.yourRights.items.optOut")}</li>
                                <li>{t("privacy.sections.yourRights.items.cookies")}</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.cookies.title")}</h2>
                            <p className="mb-3">{t("privacy.sections.cookies.intro")}</p>
                            <p className="mb-2 font-medium text-secondary">{t("privacy.sections.cookies.essential")}</p>
                            <ul className="mb-3 list-inside list-disc space-y-1 pl-2">
                                <li>{t("privacy.sections.cookies.essentialItems.auth")}</li>
                                <li>{t("privacy.sections.cookies.essentialItems.theme")}</li>
                                <li>{t("privacy.sections.cookies.essentialItems.security")}</li>
                            </ul>
                            <p className="mb-2 font-medium text-secondary">{t("privacy.sections.cookies.analytics")}</p>
                            <ul className="list-inside list-disc space-y-1 pl-2">
                                <li>{t("privacy.sections.cookies.analyticsItems.usage")}</li>
                            </ul>
                            <p className="mt-3">
                                {t("privacy.sections.cookies.manage")}
                            </p>
                        </div>

                        <div>
                            <h2 className="mb-3 text-lg font-semibold text-primary">{t("privacy.sections.contact.title")}</h2>
                            <p>{t("privacy.sections.contact.body")}</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};
