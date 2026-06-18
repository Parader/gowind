import { useState, useRef, useMemo, useEffect } from "react";
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
import { useT } from "@/providers/locale-provider";
import {
    SPORTS,
    SPORT_PRESETS,
    getTimeOfDayOptions,
    sportListKey,
    timeOfDayKey,
} from "./onboarding-data";
import { cx } from "@/utils/cx";
import type { Preferences } from "@/types/setup";

const STEP_IDS = ["welcome", "sports", "location", "preferences", "review"] as const;

const STEP_ICONS = [Check, Activity, Map01, Sliders01, Check] as const;

interface OnboardingQuestionnaireProps {
    onComplete?: () => void;
}

export const OnboardingQuestionnaire = (props: OnboardingQuestionnaireProps = {}) => {
    const { onComplete } = props;
    const t = useT();
    const { setPreferences, locations, preferences } = useSetup();

    const STEPS = useMemo(
        () =>
            STEP_IDS.map((id, i) => ({
                id,
                label: t(`onboarding.steps.${id === "location" ? "locations" : id}`),
                icon: STEP_ICONS[i],
            })),
        [t],
    );

    const timeOfDayOptions = useMemo(() => getTimeOfDayOptions(t), [t]);

    const initialStep = onComplete ? 0 : locations.length > 0 ? 3 : 0;
    const [stepIndex, setStepIndex] = useState(initialStep);
    /** Sub-step within the single Preferences wizard step (0 = wind … 3 = timing). */
    const [prefSubIndex, setPrefSubIndex] = useState(0);
    const [selectedSports, setSelectedSports] = useState<string[]>(() => preferences?.sports ?? []);

    const preferencesFormRef = useRef<PreferencesFormHandle>(null);
    const skipInitialScrollRef = useRef(true);

    useEffect(() => {
        if (skipInitialScrollRef.current) {
            skipInitialScrollRef.current = false;
            return;
        }
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [stepIndex, prefSubIndex]);

    const step = STEPS[stepIndex];
    const mergedPrefs = { ...defaultPreferences, ...preferences };
    const sessionTimeBlocks =
        mergedPrefs.preferredTimeBlocks?.filter((b) =>
            timeOfDayOptions.some((o) => o.id === b.id)
        ) ?? [];
    const minSession = mergedPrefs.minSessionLengthMinutes ?? 60;
    const sessionSummary =
        sessionTimeBlocks.length > 0
            ? t("onboarding.review.sessionBlock", {
                  blocks: sessionTimeBlocks
                      .map((b) =>
                          t("onboarding.review.sessionTime", {
                              label: t(timeOfDayKey(b.id)),
                              start: b.start,
                              end: b.end === 24 ? 24 : b.end,
                          })
                      )
                      .join(", "),
                  minutes: minSession,
              })
            : t("onboarding.review.sessionNone", { minutes: minSession });

    const handleSaveSports = () => {
        const primarySport = selectedSports[0];
        const base: Preferences = {
            ...defaultPreferences,
            ...preferences,
            sports: selectedSports,
        };
        if (primarySport && SPORT_PRESETS[primarySport]) {
            const preset = SPORT_PRESETS[primarySport];
            const timeOpt = timeOfDayOptions.find(
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

    const gustDiffSuffix =
        mergedPrefs.maxGustWindDifferenceKph != null && mergedPrefs.maxGustWindDifferenceKph > 0
            ? t("onboarding.review.gustDiff", { diff: mergedPrefs.maxGustWindDifferenceKph })
            : "";

    const conditionsSummary = t("onboarding.review.conditionsValue", {
        maxWind: mergedPrefs.maxWindKph,
        maxGust: mergedPrefs.maxGustKph,
        gustDiff: gustDiffSuffix,
        minTemp: mergedPrefs.minTempC ?? 0,
        maxTemp: mergedPrefs.maxTempC ?? 35,
        feelsLike: mergedPrefs.useFeelsLikeTemp ? t("onboarding.review.feelsLike") : "",
        maxPrecip: mergedPrefs.maxPrecipitationProbabilityPercent ?? 20,
    });

    return (
        <main className="flex-1">
            <div className="mx-auto max-w-container px-4 py-12 md:px-8 md:py-16">
                {/* Progress */}
                <div className="mb-10">
                    <ol className="flex items-center justify-center gap-2 sm:gap-4" aria-label={t("onboarding.progressAria")}>
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
                                    aria-label={`${s.label}${i < stepIndex ? t("onboarding.stepCompleted") : i === stepIndex ? t("onboarding.stepCurrent") : ""}`}
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
                                {t("onboarding.welcome.title")}
                            </h1>
                            <p className="mt-4 text-md text-tertiary">
                                {t("onboarding.welcome.description")}
                            </p>
                            <Button
                                size="lg"
                                color="primary"
                                className="mt-8"
                                iconTrailing={ArrowRight}
                                onClick={() => setStepIndex(1)}
                            >
                                {t("onboarding.welcome.getStarted")}
                            </Button>
                        </div>
                    )}

                    {/* Step 1: Sports */}
                    {step.id === "sports" && (
                        <div>
                            <div className="mb-6 h-px w-12 bg-brand-400" />
                            <h2 className="text-display-xs font-semibold tracking-tight text-primary md:text-display-sm">
                                {t("onboarding.sports.title")}
                            </h2>
                            <p className="mt-2 text-md text-tertiary">
                                {t("onboarding.sports.description")}
                            </p>
                            <CheckboxGroup
                                value={selectedSports}
                                onChange={setSelectedSports}
                                className="mt-8"
                                aria-label={t("onboarding.sports.aria")}
                            >
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    {SPORTS.map((sport) => (
                                        <Checkbox
                                            key={sport.id}
                                            value={sport.id}
                                            size="md"
                                            label={t(sportListKey(sport.id))}
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
                                    {t("common.actions.goBack")}
                                </Button>
                                <Button
                                    size="lg"
                                    color="primary"
                                    iconTrailing={ArrowRight}
                                    onClick={handleSaveSports}
                                    isDisabled={selectedSports.length === 0}
                                >
                                    {t("onboarding.sports.continue")}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Locations (same UI as /locations) */}
                    {step.id === "location" && (
                        <div>
                            <LocationsManager
                                headingLevel="h2"
                                title={t("onboarding.locations.title")}
                                description={t("onboarding.locations.description")}
                            />

                            <div className="mt-8 flex w-full items-center justify-between gap-2">
                                <Button
                                    size="lg"
                                    color="tertiary"
                                    iconLeading={ArrowLeft}
                                    onClick={() => setStepIndex(1)}
                                >
                                    {t("common.actions.goBack")}
                                </Button>
                                <Button
                                    size="lg"
                                    color="primary"
                                    iconTrailing={ArrowRight}
                                    onClick={() => goToWizardStep(3)}
                                    isDisabled={locations.length === 0}
                                >
                                    {t("onboarding.locations.continue")}
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
                            title={t("preferences.page.title")}
                            description={t("preferences.page.descriptionOnboarding")}
                            footer={
                                <div className="flex w-full flex-wrap items-center justify-between gap-2">
                                    <Button
                                        size="lg"
                                        color="tertiary"
                                        iconLeading={ArrowLeft}
                                        onClick={handleBackFromPref}
                                    >
                                        {t("common.actions.goBack")}
                                    </Button>
                                    <Button
                                        size="lg"
                                        color="primary"
                                        iconTrailing={ArrowRight}
                                        onClick={handleContinueFromPref}
                                    >
                                        {prefSubIndex >= PREF_SUBSTEPS.length - 1
                                            ? t("onboarding.preferences.continueToReview")
                                            : t("onboarding.preferences.continue")}
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
                                    {t("onboarding.review.title")}
                                </h2>
                                <p className="mt-4 text-md text-tertiary">
                                    {t("onboarding.review.description")}
                                </p>

                                <div className="mt-8 rounded-xl border border-secondary bg-white p-6 text-left dark:bg-primary">
                                    <h3 className="text-sm font-semibold text-secondary">{t("onboarding.review.summary")}</h3>
                                    <dl className="mt-4 space-y-3">
                                        <div>
                                            <dt className="text-xs text-tertiary">{t("onboarding.review.activity")}</dt>
                                            <dd className="text-sm font-medium text-primary">
                                                {selectedSports
                                                    .map((id) => t(sportListKey(id)))
                                                    .join(", ")}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-tertiary">{t("onboarding.review.locations")}</dt>
                                            <dd className="text-sm font-medium text-primary">
                                                {locations.map((l) => l.name).join(", ")}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-tertiary">{t("onboarding.review.conditions")}</dt>
                                            <dd className="text-sm font-medium text-primary">
                                                {conditionsSummary}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-tertiary">{t("onboarding.review.session")}</dt>
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
                                        {t("common.actions.goBack")}
                                    </Button>
                                    <Button
                                        size="lg"
                                        color="primary"
                                        href={onComplete ? undefined : "/go-time"}
                                        onClick={onComplete}
                                    >
                                        {t("onboarding.review.seeWindows")}
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
