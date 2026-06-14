import { useState, useRef } from "react";
import { Map01, Sliders01, ArrowRight, ArrowLeft, Check, Activity } from "@untitledui/icons";
import { CheckboxGroup } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { LocationsManager } from "@/components/location-picker/locations-manager";
import {
    PreferencesForm,
    type PreferencesFormHandle,
} from "@/components/preferences/preferences-form";
import {
    PREF_SUBSTEPS,
    PreferencesSubstepLayout,
} from "@/components/preferences/preferences-substep-layout";
import {
    useSetup,
    defaultPreferences,
} from "@/providers/setup-provider";
import { SPORTS, SPORT_PRESETS } from "./onboarding-data";
import { cx } from "@/utils/cx";
import type { Preferences } from "@/types/setup";

const STEPS = [
    { id: "welcome", label: "Welcome", icon: Check },
    { id: "sports", label: "Sports", icon: Activity },
    { id: "location", label: "Locations", icon: Map01 },
    { id: "preferences", label: "Preferences", icon: Sliders01 },
    { id: "review", label: "Review", icon: Check },
] as const;

const TIME_OF_DAY_OPTIONS = [
    { id: "morning", label: "Morning", start: 6, end: 12 },
    { id: "afternoon", label: "Afternoon", start: 12, end: 17 },
    { id: "evening", label: "Evening", start: 17, end: 24 },
    { id: "anytime", label: "Anytime", start: 0, end: 24 },
] as const;

interface OnboardingQuestionnaireProps {
    onComplete?: () => void;
}

export const OnboardingQuestionnaire = (props: OnboardingQuestionnaireProps = {}) => {
    const { onComplete } = props;
    const { setPreferences, locations, preferences } = useSetup();

    const initialStep = onComplete ? 0 : locations.length > 0 ? 3 : 0;
    const [stepIndex, setStepIndex] = useState(initialStep);
    /** Sub-step within the single Preferences wizard step (0 = wind … 3 = timing). */
    const [prefSubIndex, setPrefSubIndex] = useState(0);
    const [selectedSports, setSelectedSports] = useState<string[]>(() => preferences?.sports ?? []);

    const preferencesFormRef = useRef<PreferencesFormHandle>(null);

    const step = STEPS[stepIndex];
    const mergedPrefs = { ...defaultPreferences, ...preferences };
    const sessionTimeBlocks =
        mergedPrefs.preferredTimeBlocks?.filter((b) =>
            TIME_OF_DAY_OPTIONS.some((o) => o.id === b.id)
        ) ?? [];
    const sessionSummary =
        sessionTimeBlocks.length > 0
            ? `${sessionTimeBlocks
                  .map(
                      (b) =>
                          `${b.label} ${b.start}:00–${b.end === 24 ? "24" : b.end}:00`
                  )
                  .join(", ")} · min ${mergedPrefs.minSessionLengthMinutes ?? 60} min`
            : `None · min ${mergedPrefs.minSessionLengthMinutes ?? 60} min`;

    const handleSaveSports = () => {
        const primarySport = selectedSports[0];
        const base: Preferences = {
            ...defaultPreferences,
            ...preferences,
            sports: selectedSports,
        };
        if (primarySport && SPORT_PRESETS[primarySport]) {
            const preset = SPORT_PRESETS[primarySport];
            const timeOpt = TIME_OF_DAY_OPTIONS.find(
                (o) => o.id === (preset.preferredTimeOfDay ?? "anytime")
            );
            setPreferences({
                ...base,
                minWindKph: preset.minWindKph,
                maxWindKph: preset.maxWindKph,
                maxGustKph: preset.maxGustKph,
                ...(preset.maxGustWindDifferenceKph != null && {
                    maxGustWindDifferenceKph: preset.maxGustWindDifferenceKph,
                }),
                minTempC: preset.minTempC,
                maxTempC: preset.maxTempC,
                useFeelsLikeTemp: preset.useFeelsLikeTemp ?? false,
                maxPrecipitationProbabilityPercent: preset.maxPrecipitationProbabilityPercent,
                minSessionLengthMinutes: preset.minSessionLengthMinutes,
                preferredTimeBlocks:
                    timeOpt != null
                        ? [
                              {
                                  id: timeOpt.id,
                                  label: timeOpt.label,
                                  start: timeOpt.start,
                                  end: timeOpt.end === 24 ? 24 : timeOpt.end,
                              },
                          ]
                        : base.preferredTimeBlocks,
            });
        } else {
            setPreferences(base);
        }
        setStepIndex(2);
    };

    const flushPreferencesForm = () => {
        preferencesFormRef.current?.flushSave();
    };

    const goToWizardStep = (i: number) => {
        setStepIndex(i);
        if (i === 3) setPrefSubIndex(0);
    };

    const handleContinueFromPref = () => {
        flushPreferencesForm();
        if (prefSubIndex < PREF_SUBSTEPS.length - 1) {
            setPrefSubIndex((j) => j + 1);
        } else {
            setStepIndex(4);
        }
    };

    const handleBackFromPref = () => {
        flushPreferencesForm();
        if (prefSubIndex > 0) {
            setPrefSubIndex((j) => j - 1);
        } else {
            setStepIndex(2);
        }
    };

    const jumpToPrefSubstep = (i: number) => {
        flushPreferencesForm();
        setPrefSubIndex(i);
    };


    return (
        <main className="flex-1">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                {/* Progress */}
                <div className="mb-10">
                    <ol className="flex items-center justify-center gap-2 sm:gap-4" aria-label="Progress">
                        {STEPS.map((s, i) => (
                            <li
                                key={s.id}
                                className={cx(
                                    "flex items-center gap-2",
                                    i < stepIndex && "text-brand-500",
                                    i === stepIndex && "text-primary font-semibold",
                                    i > stepIndex && "text-quaternary"
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => goToWizardStep(i)}
                                    className={cx(
                                        "flex size-8 items-center justify-center rounded-full text-sm font-semibold outline-focus-ring transition duration-100 ease-linear",
                                        i < stepIndex &&
                                            "bg-brand-100 text-brand-600 hover:bg-brand-200 dark:bg-brand-900/50 dark:text-brand-400 dark:hover:bg-brand-800/50",
                                        i === stepIndex &&
                                            "bg-brand-500 text-white ring-2 ring-brand-primary ring-offset-2 ring-offset-primary cursor-default dark:bg-brand-600 dark:ring-offset-primary",
                                        i > stepIndex &&
                                            "bg-secondary_alt/50 text-quaternary hover:bg-secondary_alt cursor-pointer"
                                    )}
                                    aria-current={i === stepIndex ? "step" : undefined}
                                    aria-label={`${s.label}${i < stepIndex ? ", completed" : i === stepIndex ? ", current" : ""}`}
                                >
                                    {i < stepIndex ? <Check className="size-4" /> : i + 1}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => goToWizardStep(i)}
                                    className={cx(
                                        "hidden text-sm sm:inline outline-focus-ring rounded px-1 -mx-1",
                                        i === stepIndex ? "cursor-default font-semibold text-primary" : "font-medium hover:text-secondary_hover cursor-pointer"
                                    )}
                                    aria-current={i === stepIndex ? "step" : undefined}
                                >
                                    {s.label}
                                </button>
                                {i < STEPS.length - 1 && (
                                    <ArrowRight className="hidden size-4 shrink-0 sm:block" aria-hidden />
                                )}
                            </li>
                        ))}
                    </ol>
                </div>

                <div
                    className={cx(
                        "mx-auto w-full",
                        step.id === "preferences" ? "max-w-3xl" : "max-w-xl"
                    )}
                >
                    {/* Step 0: Welcome */}
                    {step.id === "welcome" && (
                        <div className="text-center">
                            <div className="mb-6 h-px w-12 bg-brand-400 mx-auto" />
                            <h1 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                Find your next good wind window
                            </h1>
                            <p className="mt-4 text-md text-tertiary">
                                Answer a few quick questions and GoWind will set up your locations and weather
                                preferences.
                            </p>
                            <Button
                                size="lg"
                                color="primary"
                                className="mt-8"
                                iconTrailing={ArrowRight}
                                onClick={() => setStepIndex(1)}
                            >
                                Get started
                            </Button>
                        </div>
                    )}

                    {/* Step 1: Sports */}
                    {step.id === "sports" && (
                        <div>
                            <div className="mb-6 h-px w-12 bg-brand-400" />
                            <h2 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                What activity do you practice?
                            </h2>
                            <p className="mt-2 text-md text-tertiary">
                                We'll use this to suggest the best default weather settings.
                            </p>
                            <CheckboxGroup
                                value={selectedSports}
                                onChange={setSelectedSports}
                                className="mt-8"
                                aria-label="Sports"
                            >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {SPORTS.map((sport) => (
                                        <Checkbox
                                            key={sport.id}
                                            value={sport.id}
                                            size="md"
                                            label={sport.label}
                                            className={(state) =>
                                                cx(
                                                    "w-full cursor-pointer items-center rounded-xl border p-4 transition duration-100 ease-linear",
                                                    "border-secondary bg-white outline-focus-ring dark:bg-primary",
                                                    "hover:border-secondary_alt hover:bg-primary_hover",
                                                    state.isSelected &&
                                                        "border-brand ring-2 ring-brand-primary ring-offset-2 ring-offset-primary bg-brand-25 dark:bg-brand-950/20 dark:ring-offset-primary"
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </CheckboxGroup>
                            <div className="mt-8 flex w-full items-center justify-between gap-2">
                                <Button
                                    size="lg"
                                    color="tertiary"
                                    iconLeading={ArrowLeft}
                                    onClick={() => setStepIndex(0)}
                                >
                                    Go back
                                </Button>
                                <Button
                                    size="lg"
                                    color="primary"
                                    iconTrailing={ArrowRight}
                                    onClick={handleSaveSports}
                                    isDisabled={selectedSports.length === 0}
                                >
                                    Continue
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Locations (same UI as /locations) */}
                    {step.id === "location" && (
                        <div>
                            <LocationsManager
                                headingLevel="h2"
                                title="Choose your locations"
                                description="Choose one or more places you often go to. You can always edit them later."
                            />

                            <div className="mt-8 flex w-full items-center justify-between gap-2">
                                <Button
                                    size="lg"
                                    color="tertiary"
                                    iconLeading={ArrowLeft}
                                    onClick={() => setStepIndex(1)}
                                >
                                    Go back
                                </Button>
                                <Button
                                    size="lg"
                                    color="primary"
                                    iconTrailing={ArrowRight}
                                    onClick={() => goToWizardStep(3)}
                                    isDisabled={locations.length === 0}
                                >
                                    Continue to preferences
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Preferences (4 substeps: wind → timing) */}
                    {step.id === "preferences" && (
                        <PreferencesSubstepLayout
                            activeIndex={prefSubIndex}
                            onSelectSubstep={jumpToPrefSubstep}
                            headingLevel="h2"
                            title="Set your preferred conditions"
                            description="Work through each area — your progress is saved as you go."
                            footer={
                                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                                    <Button
                                        size="lg"
                                        color="tertiary"
                                        iconLeading={ArrowLeft}
                                        onClick={handleBackFromPref}
                                    >
                                        Go back
                                    </Button>
                                    <Button
                                        size="lg"
                                        color="primary"
                                        iconTrailing={ArrowRight}
                                        onClick={handleContinueFromPref}
                                    >
                                        {prefSubIndex >= PREF_SUBSTEPS.length - 1
                                            ? "Continue to review"
                                            : "Continue"}
                                    </Button>
                                </div>
                            }
                        >
                            <PreferencesForm
                                ref={preferencesFormRef}
                                embedded
                                embeddedLockedSection={PREF_SUBSTEPS[prefSubIndex].section}
                                hideFloatingSave
                                sportsFromParent={selectedSports}
                            />
                        </PreferencesSubstepLayout>
                    )}

                    {/* Step 4: Review */}
                    {step.id === "review" && (
                        <div>
                            <div className="text-center">
                                <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50">
                                    <Check className="size-8 text-brand-600 dark:text-brand-400" />
                                </div>
                                <h2 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                    You're ready to find your next windows
                                </h2>
                                <p className="mt-4 text-md text-tertiary">
                                    GoWind will now find the best upcoming windows based on your locations and
                                    preferences.
                                </p>

                                <div className="mt-8 rounded-xl border border-secondary bg-white p-6 text-left dark:bg-primary">
                                    <h3 className="text-sm font-semibold text-secondary">Summary</h3>
                                    <dl className="mt-4 space-y-3">
                                        <div>
                                            <dt className="text-xs text-tertiary">Activity</dt>
                                            <dd className="text-sm font-medium text-primary">
                                                {selectedSports
                                                    .map((id) => SPORTS.find((s) => s.id === id)?.label ?? id)
                                                    .join(", ")}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-tertiary">Locations</dt>
                                            <dd className="text-sm font-medium text-primary">
                                                {locations.map((l) => l.name).join(", ")}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-tertiary">Conditions</dt>
                                            <dd className="text-sm font-medium text-primary">
                                                Wind &lt; {mergedPrefs.maxWindKph} km/h, gusts &lt;{" "}
                                                {mergedPrefs.maxGustKph} km/h
                                                {mergedPrefs.maxGustWindDifferenceKph != null &&
                                                    mergedPrefs.maxGustWindDifferenceKph > 0 && (
                                                        <> (max {mergedPrefs.maxGustWindDifferenceKph} km/h diff)</>
                                                    )}
                                                {" · "}
                                                {mergedPrefs.minTempC ?? 0}–{mergedPrefs.maxTempC ?? 35}°C
                                                {mergedPrefs.useFeelsLikeTemp ? " (feels like)" : ""} · Precip &lt;{" "}
                                                {mergedPrefs.maxPrecipitationProbabilityPercent ?? 20}%
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-tertiary">Session</dt>
                                            <dd className="text-sm font-medium text-primary">{sessionSummary}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="mt-8 flex w-full items-center justify-between gap-2">
                                    <Button
                                        size="lg"
                                        color="tertiary"
                                        iconLeading={ArrowLeft}
                                        onClick={() => {
                                            setStepIndex(3);
                                            setPrefSubIndex(3);
                                        }}
                                    >
                                        Go back
                                    </Button>
                                    <Button
                                        size="lg"
                                        color="primary"
                                        href={onComplete ? undefined : "/go-time"}
                                        onClick={onComplete}
                                    >
                                        See my windows
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};
