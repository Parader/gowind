import { Heart } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useT } from "@/providers/locale-provider";

export const About = () => {
    const t = useT();
    const donateUrl =
        import.meta.env.VITE_STRIPE_DONATE_URL?.trim() || import.meta.env.VITE_DONATE_URL?.trim();

    return (
        <main className="flex-1">
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">{t("about.eyebrow")}</p>
                    <div className="mt-4 max-w-3xl">
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            {t("about.title")}
                        </h1>
                        <p className="mt-4 text-lg text-tertiary">{t("about.intro")}</p>
                    </div>
                </div>
            </section>

            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
                        <article className="max-w-3xl">
                            <div className="space-y-5 text-md leading-7 text-tertiary">
                                <p>{t("about.story.p1")}</p>
                                <p>{t("about.story.p2")}</p>
                                <p>{t("about.story.p3")}</p>
                                <blockquote className="border-l-4 border-brand pl-5 text-xl font-semibold leading-8 text-primary">
                                    {t("about.story.quote")}
                                </blockquote>
                                <p>{t("about.story.p4")}</p>
                                <p>{t("about.story.p5")}</p>
                                <p>{t("about.story.p6")}</p>
                                <p>{t("about.story.p7")}</p>
                                <p>{t("about.story.p8")}</p>
                                <p className="font-semibold text-secondary">{t("about.story.p9")}</p>

                                <div className="pt-6">
                                    <h2 className="text-display-xs font-semibold tracking-tight text-primary">
                                        {t("about.builtByPilot.title")}
                                    </h2>
                                    <p className="mt-4">{t("about.builtByPilot.p1")}</p>
                                    <p className="mt-4">{t("about.builtByPilot.p2")}</p>
                                    <p className="mt-4">{t("about.builtByPilot.p3")}</p>
                                </div>
                            </div>
                        </article>

                        <aside className="lg:sticky lg:top-24 lg:self-start">
                            <div className="overflow-hidden rounded-2xl border border-secondary bg-secondary_alt shadow-xs">
                                <img
                                    src="/derick-roger.jpeg"
                                    alt={t("about.photo.alt")}
                                    className="aspect-[4/5] w-full object-cover"
                                />
                            </div>
                            <div className="mt-6 rounded-xl border border-secondary bg-secondary_alt/40 p-6">
                                <p className="text-sm font-semibold text-primary">{t("about.photo.captionTitle")}</p>
                                <p className="mt-1 text-sm text-tertiary">{t("about.photo.caption")}</p>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            {donateUrl ? (
                <section className="border-b border-secondary bg-secondary">
                    <div className="mx-auto max-w-container px-4 py-10 md:px-8 md:py-14">
                        <div className="overflow-hidden rounded-2xl border border-brand bg-brand-section_subtle p-6 shadow-lg md:p-8">
                            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                <div className="max-w-2xl">
                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary_on-brand">
                                        {t("about.donate.eyebrow")}
                                    </p>
                                    <h2 className="mt-2 text-display-xs font-semibold tracking-tight text-primary_on-brand">
                                        {t("about.donate.title")}
                                    </h2>
                                    <p className="mt-3 text-md leading-relaxed text-tertiary_on-brand">
                                        {t("about.donate.description")}
                                    </p>
                                </div>
                                <Button
                                    size="lg"
                                    color="secondary"
                                    href={donateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    iconLeading={Heart}
                                    className="w-fit shrink-0 rounded-full"
                                >
                                    {t("about.donate.button")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}
        </main>
    );
};
