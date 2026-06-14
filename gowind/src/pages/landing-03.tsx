import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, Heart, Map01, Sliders01, Stars01 } from "@untitledui/icons";
import "@sneas/telephone/iphone-16-max.js";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Button } from "@/components/base/buttons/button";
import { GoTimeWindowCard } from "@/components/go-time/go-time-window-card";
import { getLandingDemoGoTimeWindows, LANDING_DEMO_ROTATE_MS } from "@/data/landing-demo-go-time";
import { useAuth } from "@/providers/auth-provider";
import {
    APP_BACKGROUND_IMAGE,
    APP_BACKGROUND_IMAGE_OPACITY,
    APP_BACKGROUND_SCRIM_OPACITY,
} from "@/config/app-background";

const howItWorks = [
    {
        title: "Add your locations",
        description:
            "Monitor the places where you want to check conditions — flying sites, hills, lakes, or outdoor areas.",
        icon: Map01,
    },
    {
        title: "Set your preferences",
        description:
            "Define the conditions that work for you: wind speed, gust limits, temperature, precipitation, preferred time of day, and how long you want to go out. Everyone has different limits, so GoWind adapts to your personal settings.",
        icon: Sliders01,
    },
    {
        title: "Discover good windows",
        description:
            "GoWind analyzes weather forecasts and highlights the time windows that match your preferences. You instantly see when conditions are good enough to go.",
        icon: Stars01,
    },
];

const activities = [
    "Paramotor",
    "Paragliding",
    "Sailing",
    "Kite surfing",
    "Drone flying",
    "Hiking",
    "Outdoor photography",
];

const dataSources = ["Open-Meteo", "WeatherAPI", "Meteosource", "Visual Crossing"];

/** One line per Go Time focus view (`go-time-focus-views.tsx`); prose only—no separate title row. */
const whyGoWindFocusLines = [
    "Earliest window that still fits your limits, with good slots ahead of marginal when both are still coming up.",
    "Strongest suitability in the next seven days—scoped to one saved spot or your whole list.",
    "Every window in scope, grouped by day and place—when you want the full picture.",
];

const REVEAL_BASE_DELAY = 0.12;
const REVEAL_DURATION = 0.7;
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({
    children,
    className,
    delay = 0,
    y = 16,
}: {
    children: ReactNode;
    className?: string;
    delay?: number;
    y?: number;
}) {
    const prefersReducedMotion = useReducedMotion();

    if (prefersReducedMotion) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            className={["transform-gpu will-change-transform", className].filter(Boolean).join(" ")}
            initial={{ opacity: 0, y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.16, margin: "0px 0px -12% 0px" }}
            transition={{
                duration: REVEAL_DURATION,
                delay: REVEAL_BASE_DELAY + delay,
                ease: REVEAL_EASE,
            }}
        >
            {children}
        </motion.div>
    );
}

export const Landing03 = () => {
    const { user } = useAuth();
    const prefersReducedMotion = useReducedMotion();
    const heroRef = useRef<HTMLElement>(null);
    const [demoWindows] = useState(() => getLandingDemoGoTimeWindows());
    const [demoIndex, setDemoIndex] = useState(0);
    const demoGoTime = demoWindows[demoIndex] ?? demoWindows[0]!;
    const { scrollYProgress: heroScrollProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"],
    });
    const heroBgY = useTransform(heroScrollProgress, [0, 1], ["0%", "18%"]);
    const heroBgScale = useTransform(heroScrollProgress, [0, 1], [1.04, 1.14]);
    const heroGlowY = useTransform(heroScrollProgress, [0, 1], ["0%", "-42%"]);
    const heroContentY = useTransform(heroScrollProgress, [0, 1], [0, 84]);
    const heroContentOpacity = useTransform(heroScrollProgress, [0, 0.8], [1, 0.45]);

    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (mq.matches) return;
        const id = window.setInterval(() => {
            setDemoIndex((i) => (i + 1) % demoWindows.length);
        }, LANDING_DEMO_ROTATE_MS);
        return () => clearInterval(id);
    }, [demoWindows.length]);

    const donateUrl =
        import.meta.env.VITE_STRIPE_DONATE_URL?.trim() || import.meta.env.VITE_DONATE_URL?.trim();
    const loggedIn = Boolean(user);

    return (
        <main className="flex-1">
                {/* Hero — default dark header (white nav only on Built for / Say thanks bands) */}
                <motion.section
                    ref={heroRef}
                    className="relative -mt-20 flex min-h-screen flex-col justify-between overflow-hidden md:-mt-[5rem]"
                >
                    <motion.div
                        className="absolute -inset-x-6 -inset-y-10 bg-cover bg-center bg-no-repeat will-change-transform md:-inset-x-10 md:-inset-y-16"
                        style={
                            prefersReducedMotion
                                ? { backgroundImage: "url(/mountains.png)" }
                                : { backgroundImage: "url(/mountains.png)", y: heroBgY, scale: heroBgScale }
                        }
                        aria-hidden="true"
                    />
                    <motion.div
                        className="absolute right-[8%] top-[18%] size-56 rounded-full bg-brand-400/20 blur-3xl md:size-80"
                        style={prefersReducedMotion ? undefined : { y: heroGlowY }}
                        aria-hidden="true"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/60 via-transparent to-transparent" />
                    <motion.div
                        className="relative flex flex-1 flex-col justify-end pb-[12vh] will-change-transform"
                        style={prefersReducedMotion ? undefined : { y: heroContentY, opacity: heroContentOpacity }}
                    >
                        <div className="mx-auto w-full max-w-container px-4 pb-8 pt-32 md:px-8 md:pt-40">
                            <Reveal className="max-w-2xl md:max-w-xl" y={12}>
                                <div className="mb-6 h-px w-12 bg-brand-400" />
                                <h1 className="text-display-md font-semibold tracking-tight text-primary md:text-display-lg">
                                    Find your next good wind window
                                </h1>
                                <p className="mt-6 max-w-xl text-lg leading-relaxed text-tertiary md:text-xl">
                                    GoWind analyzes forecasts and highlights when conditions match your limits — so you spend less
                                    time checking and more time outside.
                                </p>
                                <div className="mt-10">
                                    <Button
                                        size="lg"
                                        color="primary"
                                        className="rounded-full"
                                        iconTrailing={ArrowRight}
                                        href={loggedIn ? "/go-time" : "/signup"}
                                    >
                                        {loggedIn ? "Check my Go Times" : "Sign up"}
                                    </Button>
                                </div>
                                <p className="mt-6 text-sm text-quaternary">
                                    Free to use · Built for paramotor pilots and wind-sensitive activities
                                </p>
                            </Reveal>
                        </div>
                    </motion.div>
                    <a
                        href="#how-it-works"
                        aria-label="Scroll to how it works"
                        className="relative z-10 flex flex-col items-center gap-1 pb-8 pt-4 text-primary opacity-80 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:pb-10"
                    >
                        <span className="text-xs font-medium uppercase tracking-widest">Learn more</span>
                        <ChevronDown className="size-6 stroke-[2.5px] animate-bounce" aria-hidden />
                    </a>
                </motion.section>

                {/* What GoWind Does — sample Go Time card beside copy */}
                <section className="overflow-hidden border-b border-secondary bg-secondary_alt/50">
                    <div className="mx-auto max-w-container px-4 pt-16 md:px-8 md:pt-20">
                        <div className="grid gap-10 md:grid-cols-2 md:items-start md:gap-8 lg:gap-12">
                            <Reveal className="min-w-0 self-start">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
                                    VALUE
                                </p>
                                <h2 className="mt-2 text-display-xs font-semibold text-primary md:text-display-sm">
                                    What GoWind Does
                                </h2>
                                <p className="mt-4 text-md leading-relaxed text-tertiary md:text-lg">
                                    Most weather apps show raw forecasts. GoWind focuses on something simpler: finding the next
                                    good time window.
                                </p>
                                <p className="mt-4 text-md leading-relaxed text-tertiary md:text-lg">
                                    Instead of checking multiple weather apps and interpreting wind charts, GoWind scans forecast
                                    data and highlights the times that match your conditions. This helps you quickly answer:
                                    “When and where are the conditions good?”
                                </p>
                            </Reveal>
                            <motion.div
                                className="mx-auto -mb-32 flex h-[34rem] min-w-0 w-full max-w-[23rem] transform-gpu justify-center overflow-hidden self-end will-change-transform md:-mb-40 md:h-[38rem] md:max-w-[25rem]"
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 36, scale: 0.98 }}
                                whileInView={
                                    prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }
                                }
                                viewport={{ once: true, amount: 0.18, margin: "0px 0px -12% 0px" }}
                                transition={
                                    prefersReducedMotion
                                        ? undefined
                                        : { duration: 0.8, delay: 0.18, ease: REVEAL_EASE }
                                }
                            >
                                <iphone-16-max mode="light" className="block w-full translate-y-2 md:translate-y-4">
                                    <div className="flex min-h-full flex-col bg-secondary_alt/60 p-4 pt-8">
                                        <div className="mx-auto mt-5 flex w-full max-w-[15rem] items-center justify-center rounded-full border border-secondary/60 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-tertiary shadow-xs">
                                            go-wind.com
                                        </div>
                                        <div className="mt-5">
                                        <GoTimeWindowCard key={demoGoTime.id} w={demoGoTime} allowShare={false} compact />
                                        </div>
                                    </div>
                                </iphone-16-max>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* How It Works */}
                <section id="how-it-works" className="relative overflow-hidden border-b border-secondary">
                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-primary" />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${APP_BACKGROUND_IMAGE})`,
                            opacity: APP_BACKGROUND_IMAGE_OPACITY,
                        }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-primary"
                        style={{ opacity: APP_BACKGROUND_SCRIM_OPACITY }}
                    />
                    <div className="relative z-10 mx-auto flex max-w-container flex-col gap-12 px-4 py-16 md:px-8 md:py-24">
                        <Reveal className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
                                PROCESS
                            </p>
                            <h2 className="mt-2 text-display-xs font-semibold text-primary md:text-display-sm">
                                How It Works
                            </h2>
                            <p className="mt-4 text-md text-tertiary">
                                Three simple steps to find your next good window.
                            </p>
                        </Reveal>

                        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
                            {howItWorks.map((item, i) => (
                                <Reveal
                                    key={item.title}
                                    className="group flex flex-col gap-5 rounded-2xl border border-secondary bg-white px-6 py-8 shadow-sm transition hover:border-secondary_alt hover:shadow-md dark:bg-primary md:px-8 md:py-10"
                                    delay={i * 0.07}
                                    y={16}
                                >
                                    <div className="flex items-center gap-4">
                                        <span
                                            className="flex size-12 items-center justify-center rounded-xl bg-brand-50 font-mono text-xl font-semibold tabular-nums text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 md:text-2xl"
                                            aria-hidden="true"
                                        >
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <item.icon className="size-6 shrink-0 text-brand-500 dark:text-brand-400" aria-hidden="true" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-primary">{item.title}</h3>
                                    <p className="text-sm leading-relaxed text-tertiary">{item.description}</p>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Built for — only sections with `data-header-contrast="light"` get white header */}
                <section
                    className="border-b border-secondary bg-brand-section_subtle text-primary_on-brand"
                    data-header-contrast="light"
                >
                    <div className="mx-auto flex max-w-container flex-col gap-12 px-4 py-16 md:px-8 md:py-24">
                        <Reveal className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary_on-brand">
                                ACTIVITIES
                            </p>
                            <h2 className="mt-2 text-display-xs font-semibold md:text-display-sm">
                                Built for Wind-Sensitive Activities
                            </h2>
                            <p className="mt-4 text-md leading-relaxed text-tertiary_on-brand md:text-lg">
                                GoWind was originally built for paramotor pilots, where wind conditions determine when flying is
                                possible. It can also help plan any activity where timing and weather conditions matter.
                            </p>

                            <div className="mt-8 flex flex-wrap gap-3">
                                {activities.map((activity) => (
                                    <span
                                        key={activity}
                                        className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium backdrop-blur-sm transition hover:bg-white/20"
                                    >
                                        {activity}
                                    </span>
                                ))}
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* Why different — canvas band after brand; pairs with Support (brand subtle) + Final (primary) for alternation */}
                <section className="border-b border-secondary bg-primary">
                    <div className="mx-auto flex max-w-container flex-col gap-10 px-4 py-14 md:gap-12 md:px-8 md:py-20">
                        <Reveal className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
                                DIFFERENT
                            </p>
                            <h2 className="mt-2 text-display-xs font-semibold text-primary md:text-display-sm">
                                Why GoWind Is Different
                            </h2>
                            <p className="mt-4 text-md leading-relaxed text-tertiary md:text-lg">
                                Go Time reuses the same window cards everywhere—you just change the slice.{" "}
                                <span className="font-medium text-secondary">Next</span>,{" "}
                                <span className="font-medium text-secondary">Best</span>, and{" "}
                                <span className="font-medium text-secondary">All</span> in the app line up with the ideas
                                below, with several forecast models blended underneath.
                            </p>
                        </Reveal>

                        <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-14">
                            <Reveal>
                                <ul className="grid gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3 lg:grid-cols-1">
                                    {whyGoWindFocusLines.map((line) => (
                                        <li key={line} className="flex gap-3">
                                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                                            <p className="text-sm leading-relaxed text-tertiary md:text-md">{line}</p>
                                        </li>
                                    ))}
                                </ul>
                            </Reveal>
                            <Reveal
                                className="rounded-2xl border border-secondary/50 bg-secondary_alt/30 px-6 py-5 shadow-sm dark:border-secondary dark:bg-secondary_alt/20 md:px-8 md:py-6"
                                delay={0.08}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
                                    Data sources
                                </p>
                                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5 text-sm font-medium text-secondary">
                                    {dataSources.map((source) => (
                                        <span key={source} className="transition hover:text-primary">
                                            {source}
                                        </span>
                                    ))}
                                </div>
                            </Reveal>
                        </div>
                    </div>
                </section>

                {/* Say thanks — white header on this band only */}
                <section className="border-b border-secondary bg-brand-section_subtle" data-header-contrast="light">
                    <div className="mx-auto max-w-container px-4 py-16 md:px-8 md:py-20">
                        <Reveal className="max-w-xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary_on-brand">
                                SUPPORT
                            </p>
                            <h2 className="mt-2 text-display-xs font-semibold text-primary_on-brand md:text-display-sm">
                                Say thanks
                            </h2>
                            <p className="mt-4 text-md leading-relaxed text-tertiary_on-brand md:text-lg">
                                GoWind is built as a passion project. If it helps you plan safer, more enjoyable days outside, you
                                are welcome to chip in — it keeps the lights on and the forecasts flowing.
                            </p>
                            {donateUrl ? (
                                <Button
                                    size="md"
                                    color="secondary"
                                    href={donateUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    iconLeading={Heart}
                                    className="mt-8 w-fit rounded-md border border-[#E1707A]/40 bg-[#E1707A] !px-5 !text-white shadow-[0_2px_0_rgba(0,0,0,0.06),0_4px_14px_rgba(225,112,122,0.26)] ring-0 transition-[background-color,box-shadow] duration-200 ease-out hover:!border-[#E89AA2]/55 hover:!bg-[#E4767E] hover:!text-white hover:shadow-[0_2px_0_rgba(0,0,0,0.06),0_4px_14px_rgba(225,112,122,0.22),0_0_0_1px_rgba(225,112,122,0.08),0_0_16px_rgba(225,112,122,0.22),0_0_28px_rgba(225,112,122,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F0A8AE] active:!bg-[#D8636E] active:!text-white dark:border-[#E1707A]/40 dark:!bg-[#E1707A] dark:hover:!border-[#E89AA2]/55 dark:hover:!bg-[#E4767E] dark:hover:shadow-[0_2px_0_rgba(0,0,0,0.06),0_4px_14px_rgba(225,112,122,0.22),0_0_0_1px_rgba(225,112,122,0.08),0_0_16px_rgba(225,112,122,0.22),0_0_28px_rgba(225,112,122,0.08)] [&_[data-icon]]:!text-white hover:[&_[data-icon]]:!text-white"
                                >
                                    Donate
                                </Button>
                            ) : null}
                        </Reveal>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="relative overflow-hidden border-t border-secondary">
                    <div aria-hidden className="pointer-events-none absolute inset-0 bg-primary" />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                        style={{
                            backgroundImage: `url(${APP_BACKGROUND_IMAGE})`,
                            opacity: APP_BACKGROUND_IMAGE_OPACITY,
                        }}
                    />
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-primary"
                        style={{ opacity: APP_BACKGROUND_SCRIM_OPACITY }}
                    />
                    <div className="relative z-10 mx-auto flex max-w-container flex-col items-start gap-10 px-4 py-20 md:flex-row md:items-center md:justify-between md:gap-16 md:px-8 md:py-24">
                        <Reveal className="glass-strong max-w-xl rounded-2xl border border-secondary/50 px-8 py-8 shadow-lg md:px-10 md:py-10">
                            <h2 className="text-display-xs font-semibold text-primary md:text-display-sm">GoWind</h2>
                            <p className="mt-4 text-lg font-medium text-primary md:text-xl">
                                Know when and where to go.
                            </p>
                            <p className="mt-3 text-md leading-relaxed text-tertiary md:max-w-lg">
                                Instead of constantly checking forecasts, GoWind helps you quickly see when conditions match
                                your preferences. Whether you are planning a flight, a hike, or a session on the water, GoWind
                                helps you find the right window.
                            </p>
                        </Reveal>
                        <Reveal delay={0.08} y={12}>
                            <Button
                                size="lg"
                                color="primary"
                                className="rounded-full shrink-0"
                                iconTrailing={ArrowRight}
                                href={loggedIn ? "/go-time" : "/signup"}
                            >
                                {loggedIn ? "Check my Go Times" : "Get started free"}
                            </Button>
                        </Reveal>
                    </div>
                </section>
        </main>
    );
};
