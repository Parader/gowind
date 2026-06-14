import { Heart } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

export const About = () => {
    const donateUrl =
        import.meta.env.VITE_STRIPE_DONATE_URL?.trim() || import.meta.env.VITE_DONATE_URL?.trim();

    return (
        <main className="flex-1">
            {/* Hero */}
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">About</p>
                    <div className="mt-4 max-w-3xl">
                        <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                            Why I Built GoWind
                        </h1>
                        <p className="mt-4 text-lg text-tertiary">
                            GoWind started as a tool I built for myself: a faster way to find the next flyable day
                            without hunting through forecast after forecast.
                        </p>
                    </div>
                </div>
            </section>

            {/* Rich text split image */}
            <section className="border-b border-secondary bg-primary">
                <div className="mx-auto max-w-container px-4 py-14 md:px-8 md:py-20">
                    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
                        <article className="max-w-3xl">
                            <div className="space-y-5 text-md leading-7 text-tertiary">
                                <p>
                                    Like most paramotor pilots, I was spending way too much time checking weather
                                    forecasts. I'd open one app for wind speed, another for gusts, another for direction,
                                    then try to piece everything together to figure out if it was worth packing my gear
                                    and heading to the field.
                                </p>
                                <p>Most of the time, I wasn't looking for more weather data.</p>
                                <p>I was looking for a simple answer:</p>
                                <blockquote className="border-l-4 border-brand pl-5 text-xl font-semibold leading-8 text-primary">
                                    "When's my next good flying window?"
                                </blockquote>
                                <p>So I started building GoWind.</p>
                                <p>
                                    The idea was straightforward: save my favorite flying spots, define my personal limits,
                                    and let the app scan the forecast for me. Instead of manually checking dozens of hourly
                                    forecasts, I could instantly see the next opportunities to fly.
                                </p>
                                <p>
                                    I built it mainly for myself and still use it whenever I'm planning a flight. Before
                                    long, I realized other pilots might find it useful too.
                                </p>
                                <p>
                                    Today, GoWind remains a simple tool focused on one goal: helping pilots spend less time
                                    analyzing weather and more time doing what they actually enjoy: flying.
                                </p>
                                <p>No complicated setup. No endless forecast hunting.</p>
                                <p className="font-semibold text-secondary">Just a faster way to find the next flyable day.</p>

                                <div className="pt-6">
                                    <h2 className="text-display-xs font-semibold tracking-tight text-primary">
                                        Built by a Pilot
                                    </h2>
                                    <p className="mt-4">
                                        I'm Dérick, a software designer, developer, and paramotor pilot from Canada. What
                                        started as a personal project turned into something I use every week, and now
                                        something I can share with other pilots.
                                    </p>
                                    <p className="mt-4">
                                        If you have ideas, feedback, or feature requests, I'd love to hear from you. GoWind
                                        is still evolving, and many of the best improvements come directly from fellow
                                        pilots.
                                    </p>
                                    <p className="mt-4">See you in the air. ✈️</p>
                                </div>
                            </div>
                        </article>

                        <aside className="lg:sticky lg:top-24 lg:self-start">
                            <div className="overflow-hidden rounded-2xl border border-secondary bg-secondary_alt shadow-xs">
                                <img
                                    src="/derick-roger.jpeg"
                                    alt="Dérick Paradis and his friend Roger after Dérick's first flight"
                                    className="aspect-[4/5] w-full object-cover"
                                />
                            </div>
                            <div className="mt-6 rounded-xl border border-secondary bg-secondary_alt/40 p-6">
                                <p className="text-sm font-semibold text-primary">Dérick and Roger</p>
                                <p className="mt-1 text-sm text-tertiary">
                                    Dérick, GoWind's creator, on the right with his friend Roger after their first flight.
                                </p>
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
                                        Support GoWind
                                    </p>
                                    <h2 className="mt-2 text-display-xs font-semibold tracking-tight text-primary_on-brand">
                                        Contribute to the platform
                                    </h2>
                                    <p className="mt-3 text-md leading-relaxed text-tertiary_on-brand">
                                        GoWind is a small passion project built for pilots. If it helped you find a good
                                        flying window, your support helps keep the forecasts flowing and the platform
                                        getting better.
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
                                    Buy me a drink
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}
        </main>
    );
};
