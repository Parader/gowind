import type { ReactNode } from "react";
import {
    Wind03,
    LayersThree01,
    Thermometer02,
    Clock,
} from "@untitledui/icons";
import { cx } from "@/utils/cx";
import type { PreferenceSectionId } from "@/components/preferences/preferences-form";

export const PREF_SUBSTEP_ICONS = [Wind03, LayersThree01, Thermometer02, Clock] as const;

export const PREF_SUBSTEPS: {
    section: PreferenceSectionId;
    label: string;
    title: string;
    subtitle: string;
}[] = [
    {
        section: "wind",
        label: "Wind",
        title: "Wind",
        subtitle: "Set your speed range, gust limits, and gust–wind shear.",
    },
    {
        section: "altitude",
        label: "Heights",
        title: "Forecast heights",
        subtitle: "Choose which altitudes to use for wind and weather.",
    },
    {
        section: "comfort",
        label: "Comfort",
        title: "Comfort & sky",
        subtitle: "Temperature, feels-like, and precipitation limits.",
    },
    {
        section: "timing",
        label: "Timing",
        title: "Timing",
        subtitle: "Preferred time windows and minimum session length.",
    },
];

export interface PreferencesSubstepLayoutProps {
    /** Active substep index (0–3). */
    activeIndex: number;
    /** Called when a pill is clicked (caller should flush save before changing index). */
    onSelectSubstep: (index: number) => void;
    title: string;
    description: string;
    /** Page uses h1; onboarding uses h2 inside the flow. */
    headingLevel?: "h1" | "h2";
    showAccent?: boolean;
    className?: string;
    children: ReactNode;
    /** e.g. wizard back/continue row or null */
    footer?: ReactNode;
}

/**
 * Shared “pill” navigation + section heading used by the preferences page and onboarding.
 */
export function PreferencesSubstepLayout({
    activeIndex,
    onSelectSubstep,
    title,
    description,
    headingLevel = "h1",
    showAccent = true,
    className,
    children,
    footer,
}: PreferencesSubstepLayoutProps) {
    const safeIndex = Math.min(Math.max(activeIndex, 0), PREF_SUBSTEPS.length - 1);
    const sub = PREF_SUBSTEPS[safeIndex];

    const HeadingTag = headingLevel === "h1" ? "h1" : "h2";

    return (
        <div className={cx("w-full max-w-3xl", className)}>
            {showAccent && <div className="mb-6 h-px w-12 bg-brand-400" />}
            <HeadingTag className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                {title}
            </HeadingTag>
            <p className="mt-2 text-md text-tertiary">{description}</p>

            <nav className="mt-6" aria-label="Preference sections">
                <ol className="flex flex-wrap justify-center gap-2 sm:justify-start sm:gap-1.5">
                    {PREF_SUBSTEPS.map((s, i) => {
                        const Icon = PREF_SUBSTEP_ICONS[i];
                        const active = i === safeIndex;
                        return (
                            <li key={s.section}>
                                <button
                                    type="button"
                                    onClick={() => onSelectSubstep(i)}
                                    className={cx(
                                        "flex items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-medium transition sm:min-w-0 sm:px-3.5 sm:text-sm",
                                        active
                                            ? "border-brand-600 bg-brand-50 text-brand-800 shadow-sm dark:border-brand-500 dark:bg-brand-950/40 dark:text-brand-200"
                                            : "border-secondary bg-white text-secondary hover:bg-secondary_alt dark:bg-primary"
                                    )}
                                    aria-current={active ? "step" : undefined}
                                >
                                    <Icon
                                        className="size-4 shrink-0 opacity-80"
                                        strokeWidth={1.5}
                                        aria-hidden
                                    />
                                    <span className="whitespace-nowrap">{s.label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
                <p className="mt-3 text-center text-xs text-tertiary sm:text-left">
                    Section {safeIndex + 1} of {PREF_SUBSTEPS.length}
                </p>
            </nav>

            <h3 className="mt-6 text-lg font-semibold text-primary">{sub.title}</h3>
            <p className="mt-1 text-sm text-tertiary">{sub.subtitle}</p>

            <div className="mt-6 w-full">{children}</div>

            {footer != null ? <div className="mt-8 w-full">{footer}</div> : null}
        </div>
    );
}
