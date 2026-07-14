import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { A11y, Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper/types";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { NativeSelect } from "@/components/base/select/select-native";
import { Tabs } from "@/components/application/tabs/tabs";
import { GoTimeWindowCard } from "@/components/go-time/go-time-window-card";
import type { GoTimeWindow } from "@/api/goTimes";
import type { SavedGoTimeItem } from "@/api/savedGoTimes";
import { keyForGoTimeWindow } from "@/api/savedGoTimes";
import { useT } from "@/providers/locale-provider";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@/lib/analytics-events";
import { cx } from "@/utils/cx";

export type GoTimeFocusView = "next" | "best" | "saved";

type CardSaveProps = {
    isWindowSaved: (w: GoTimeWindow) => boolean;
    onToggleSave: (w: GoTimeWindow) => Promise<void>;
};

/** `all` = every saved location; otherwise filter to this `locationId`. */
export const GO_TIME_ALL_LOCATIONS = "all" as const;

function startOfLocalDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function addDaysLocal(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function displayStart(w: GoTimeWindow): string {
    return w.displayStartTime ?? w.startTime;
}

function displayEnd(w: GoTimeWindow): string {
    return w.displayEndTime ?? w.endTime;
}

function applyLocationFilter(windows: GoTimeWindow[], locationId: string): GoTimeWindow[] {
    if (locationId === GO_TIME_ALL_LOCATIONS) return windows;
    return windows.filter((w) => w.locationId === locationId);
}

function isWindowInNextSevenDays(w: GoTimeWindow, now: Date): boolean {
    const start = startOfLocalDay(now);
    const end = addDaysLocal(start, 7);
    const ws = new Date(displayStart(w));
    return ws >= start && ws < end;
}

/** Clock order (not suitability). */
function compareByStartTime(a: GoTimeWindow, b: GoTimeWindow): number {
    const ta = new Date(displayStart(a)).getTime();
    const tb = new Date(displayStart(b)).getTime();
    if (ta !== tb) return ta - tb;
    const ea = new Date(displayEnd(a)).getTime();
    const eb = new Date(displayEnd(b)).getTime();
    if (ea !== eb) return ea - eb;
    return a.id.localeCompare(b.id);
}

interface GoTimeFocusViewsProps {
    windows: GoTimeWindow[];
    view: GoTimeFocusView;
    onViewChange: (v: GoTimeFocusView) => void;
    locationFilterId: string;
    onLocationFilterChange: (id: string) => void;
    savedItems: SavedGoTimeItem[];
    onToggleSave: (w: GoTimeWindow) => Promise<void>;
}

export function GoTimeFocusViews({
    windows,
    view,
    onViewChange,
    locationFilterId,
    onLocationFilterChange,
    savedItems,
    onToggleSave,
}: GoTimeFocusViewsProps) {
    const t = useT();
    const now = useMemo(() => new Date(), []);
    const defaultLocation = t("goTime.page.defaultLocation");

    const savedKeySet = useMemo(() => new Set(savedItems.map((item) => item.key)), [savedItems]);
    const cardSaveProps: CardSaveProps = useMemo(
        () => ({
            isWindowSaved: (w) => savedKeySet.has(keyForGoTimeWindow(w)),
            onToggleSave,
        }),
        [onToggleSave, savedKeySet],
    );

    const locationOptions = useMemo(() => {
        const map = new Map<string, string>();
        for (const w of windows) {
            if (!map.has(w.locationId)) {
                map.set(w.locationId, (w.locationName ?? "").trim() || defaultLocation);
            }
        }
        for (const item of savedItems) {
            if (!map.has(item.locationId)) {
                const name = (item.window.locationName ?? "").trim() || defaultLocation;
                map.set(item.locationId, name);
            }
        }
        return [...map.entries()]
            .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }))
            .map(([id, name]) => ({ value: id, label: name }));
    }, [windows, savedItems, defaultLocation]);

    useEffect(() => {
        if (
            locationFilterId !== GO_TIME_ALL_LOCATIONS &&
            !locationOptions.some((o) => o.value === locationFilterId)
        ) {
            onLocationFilterChange(GO_TIME_ALL_LOCATIONS);
        }
    }, [locationFilterId, locationOptions, onLocationFilterChange]);

    /** API may send suitability-sorted windows; normalize to time-of-day order before any view logic. */
    const windowsChronological = useMemo(
        () => [...windows].sort(compareByStartTime),
        [windows],
    );

    const filtered = useMemo(
        () => applyLocationFilter(windowsChronological, locationFilterId),
        [windowsChronological, locationFilterId],
    );

    const locationScopeLabel =
        locationFilterId === GO_TIME_ALL_LOCATIONS
            ? t("goTime.focusViews.scopeAllLocations")
            : locationOptions.find((o) => o.value === locationFilterId)?.label ??
              t("goTime.focusViews.scopeThisLocation");

    /** Upcoming windows in clock order — every category (good, marginal, no-go). */
    const nextCandidates = useMemo(
        () =>
            [...filtered]
                .filter((w) => new Date(displayStart(w)) >= now)
                .sort(compareByStartTime),
        [filtered, now],
    );

    const bestCandidates = useMemo(() => {
        const pool = filtered.filter(
            (w) => w.category === "GOOD" && isWindowInNextSevenDays(w, now),
        );
        if (pool.length === 0) return [];
        return [...pool].sort(compareByStartTime);
    }, [filtered, now]);

    const savedFiltered = useMemo(() => {
        if (locationFilterId === GO_TIME_ALL_LOCATIONS) return savedItems;
        return savedItems.filter((item) => item.locationId === locationFilterId);
    }, [savedItems, locationFilterId]);

    const savedUpcoming = useMemo(
        () => savedFiltered.filter((item) => item.status === "upcoming"),
        [savedFiltered],
    );
    const savedPassed = useMemo(
        () => savedFiltered.filter((item) => item.status === "passed"),
        [savedFiltered],
    );

    return (
        <div className="space-y-4 md:space-y-6">
            <Tabs
                selectedKey={view}
                onSelectionChange={(k) => {
                    const next = String(k) as GoTimeFocusView;
                    onViewChange(next);
                    track(AnalyticsEvents.goTimeFocusViewChanged, { view: next });
                }}
            >
                <div className="flex min-w-0 max-w-full flex-col gap-2 md:gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4 lg:gap-y-2">
                    <Tabs.List
                        type="button-minimal"
                        size="sm"
                        fullWidth
                        className="min-w-0 opacity-95 sm:min-w-0 sm:max-w-[min(100%,36rem)] sm:flex-1"
                    >
                        <Tabs.Item id="next" label={t("goTime.focusViews.tabs.next")} />
                        <Tabs.Item id="best" label={t("goTime.focusViews.tabs.best")} />
                        <Tabs.Item id="saved" label={t("goTime.focusViews.tabs.saved")} />
                    </Tabs.List>
                    <div className="w-full min-w-0 max-w-full sm:w-48 sm:shrink-0 lg:max-w-[16rem]">
                        <NativeSelect
                            aria-label={t("goTime.focusViews.locationFilterAria")}
                            value={locationFilterId}
                            onChange={(e) => {
                                const value = e.target.value;
                                onLocationFilterChange(value);
                                track(AnalyticsEvents.goTimeLocationFilterChanged, {
                                    filter: value === GO_TIME_ALL_LOCATIONS ? "all" : value,
                                });
                            }}
                            options={[
                                { value: GO_TIME_ALL_LOCATIONS, label: t("goTime.focusViews.allLocations") },
                                ...locationOptions.map((o) => ({ value: o.value, label: o.label })),
                            ]}
                            className="w-full max-w-full"
                            selectClassName="w-full max-w-full truncate pr-9 py-2 text-sm font-normal shadow-none ring-secondary/60"
                        />
                    </div>
                </div>
                <Tabs.Panel id="next" className="mt-3 outline-none focus:outline-none md:mt-8">
                        <section aria-label={t("goTime.focusViews.next.title")} className="space-y-3 md:space-y-4">
                            <header className="max-md:hidden">
                                <h2 id="focus-next-heading" className="text-lg font-semibold text-primary">
                                    {t("goTime.focusViews.next.title")}
                                </h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    {t("goTime.focusViews.next.description", { scope: locationScopeLabel })}
                                </p>
                            </header>
                            {nextCandidates.length > 0 ? (
                                <FocusWindowSwiper
                                    key={`next-${locationFilterId}-${nextCandidates.map((w) => w.id).join("|")}`}
                                    windows={nextCandidates}
                                    navLabel={t("goTime.focusViews.next.navLabel")}
                                    cardSaveProps={cardSaveProps}
                                />
                            ) : (
                                <EmptyFocus
                                    title={t("goTime.focusViews.next.emptyTitle")}
                                    body={t("goTime.focusViews.next.emptyDefault")}
                                />
                            )}
                        </section>
                    </Tabs.Panel>
                    <Tabs.Panel id="best" className="mt-3 outline-none focus:outline-none md:mt-8">
                        <section aria-label={t("goTime.focusViews.best.title")} className="space-y-3 md:space-y-4">
                            <header className="max-md:hidden">
                                <h2 id="focus-best-heading" className="text-lg font-semibold text-primary">
                                    {t("goTime.focusViews.best.title")}
                                </h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    {t("goTime.focusViews.best.description", { scope: locationScopeLabel })}
                                </p>
                            </header>
                            {bestCandidates.length > 0 ? (
                                <FocusWindowSwiper
                                    key={`best-${locationFilterId}-${bestCandidates.map((w) => w.id).join("|")}`}
                                    windows={bestCandidates}
                                    navLabel={t("goTime.focusViews.best.navLabel")}
                                    cardSaveProps={cardSaveProps}
                                />
                            ) : (
                                <EmptyFocus
                                    title={t("goTime.focusViews.best.emptyTitle")}
                                    body={t("goTime.focusViews.best.emptyDefault")}
                                />
                            )}
                        </section>
                    </Tabs.Panel>
                    <Tabs.Panel id="saved" className="mt-3 outline-none focus:outline-none md:mt-8">
                        <section aria-label={t("goTime.focusViews.saved.title")} className="space-y-3 md:space-y-4">
                            <header className="max-md:hidden">
                                <h2 id="focus-saved-heading" className="text-lg font-semibold text-primary">
                                    {t("goTime.focusViews.saved.title")}
                                </h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    {t("goTime.focusViews.saved.description", { scope: locationScopeLabel })}
                                </p>
                            </header>
                            {savedFiltered.length === 0 ? (
                                <EmptyFocus
                                    title={t("goTime.focusViews.saved.emptyTitle")}
                                    body={
                                        savedItems.length === 0
                                            ? t("goTime.focusViews.saved.emptyDefault")
                                            : t("goTime.focusViews.saved.emptyFiltered")
                                    }
                                />
                            ) : (
                                <div className="space-y-8">
                                    {savedUpcoming.length > 0 ? (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-semibold text-secondary">
                                                {t("goTime.focusViews.saved.upcoming")}
                                            </h3>
                                            <div className="flex flex-col gap-3">
                                                {savedUpcoming.map((item) => (
                                                    <GoTimeWindowCard
                                                        key={item.key}
                                                        w={item.window}
                                                        isSaved
                                                        onToggleSave={cardSaveProps.onToggleSave}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {savedPassed.length > 0 ? (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-semibold text-secondary">
                                                {t("goTime.focusViews.saved.passed")}
                                            </h3>
                                            <div className="flex flex-col gap-3">
                                                {savedPassed.map((item) => (
                                                    <GoTimeWindowCard
                                                        key={item.key}
                                                        w={item.window}
                                                        isSaved
                                                        showPassedBadge
                                                        onToggleSave={cardSaveProps.onToggleSave}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </section>
                    </Tabs.Panel>
            </Tabs>
        </div>
    );
}

function FocusWindowSwiper({
    windows,
    navLabel,
    cardSaveProps,
}: {
    windows: GoTimeWindow[];
    navLabel: string;
    cardSaveProps: CardSaveProps;
}) {
    const t = useT();
    const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const total = windows.length;
    const atStart = activeIndex <= 0;
    const atEnd = activeIndex >= total - 1;

    const navButtonClass =
        "shrink-0 cursor-pointer text-fg-secondary transition hover:text-fg-primary disabled:cursor-default disabled:text-fg-disabled";

    return (
        <div
            className={cx(
                "go-time-swiper overflow-hidden px-0 sm:px-12 lg:px-16",
                "[&_.swiper-pagination]:hidden sm:[&_.swiper-pagination]:!flex",
                "[&_.swiper-pagination]:!-bottom-0 [&_.swiper-pagination]:!left-0 [&_.swiper-pagination]:!w-full [&_.swiper-pagination]:!justify-center [&_.swiper-pagination]:!items-center [&_.swiper-pagination]:!gap-1.5",
                "[&_.swiper-pagination-bullet]:!bg-quaternary [&_.swiper-pagination-bullet]:!opacity-100 [&_.swiper-pagination-bullet-active]:!bg-brand-solid",
                "[&_.swiper-slide]:opacity-100 sm:[&_.swiper-slide]:opacity-25 [&_.swiper-slide]:transition-opacity [&_.swiper-slide-active]:opacity-100",
            )}
            aria-label={navLabel}
        >
            <div className="relative">
                <Swiper
                    modules={[A11y, Keyboard, Navigation, Pagination]}
                    slidesPerView={1}
                    spaceBetween={0}
                    breakpoints={{
                        640: { spaceBetween: 16 },
                    }}
                    threshold={8}
                    keyboard={{ enabled: true }}
                    pagination={{ clickable: true }}
                    a11y={{
                        enabled: true,
                        prevSlideMessage: t("goTime.focusViews.swiper.prevSlide"),
                        nextSlideMessage: t("goTime.focusViews.swiper.nextSlide"),
                        paginationBulletMessage: t("goTime.focusViews.swiper.paginationBullet"),
                    }}
                    onSwiper={setSwiper}
                    onSlideChange={(s) => setActiveIndex(s.activeIndex)}
                    className="!overflow-hidden !pb-0 sm:!overflow-visible sm:!pb-12"
                >
                    {windows.map((w) => (
                        <SwiperSlide key={w.id} className="!h-auto !w-full">
                            <GoTimeWindowCard
                                w={w}
                                isSaved={cardSaveProps.isWindowSaved(w)}
                                onToggleSave={cardSaveProps.onToggleSave}
                            />
                        </SwiperSlide>
                    ))}
                </Swiper>

                {total > 1 ? (
                    <>
                        <button
                            type="button"
                            className={cx(
                                navButtonClass,
                                "absolute top-[calc(50%-1.5rem)] -left-7 z-10 hidden -translate-y-1/2 sm:block lg:-left-14",
                            )}
                            aria-label={t("goTime.focusViews.swiper.prevWindow")}
                            disabled={atStart}
                            onClick={() => swiper?.slidePrev()}
                        >
                            <ChevronLeft className="h-14 w-6 stroke-[1.75px] sm:h-16 sm:w-7" />
                        </button>
                        <button
                            type="button"
                            className={cx(
                                navButtonClass,
                                "absolute top-[calc(50%-1.5rem)] -right-7 z-10 hidden -translate-y-1/2 sm:block lg:-right-14",
                            )}
                            aria-label={t("goTime.focusViews.swiper.nextWindow")}
                            disabled={atEnd}
                            onClick={() => swiper?.slideNext()}
                        >
                            <ChevronRight className="h-14 w-6 stroke-[1.75px] sm:h-16 sm:w-7" />
                        </button>
                    </>
                ) : null}
            </div>

            {total > 1 ? (
                <>
                    <div className="relative mt-3 flex min-h-6 items-center justify-center sm:hidden">
                        <button
                            type="button"
                            className={cx(navButtonClass, "absolute left-0")}
                            aria-label={t("goTime.focusViews.swiper.prevWindow")}
                            disabled={atStart}
                            onClick={() => swiper?.slidePrev()}
                        >
                            <ChevronLeft className="size-6 stroke-[1.75px]" />
                        </button>
                        <div
                            className="flex items-center justify-center gap-1.5"
                            role="tablist"
                            aria-label={t("goTime.focusViews.swiper.pagesAria")}
                        >
                            {windows.map((w, index) => (
                                <button
                                    key={w.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={index === activeIndex}
                                    aria-label={t("goTime.focusViews.swiper.goToWindow", { index: index + 1 })}
                                    className={cx(
                                        "size-2 rounded-full transition",
                                        index === activeIndex ? "bg-brand-solid" : "bg-quaternary",
                                    )}
                                    onClick={() => swiper?.slideTo(index)}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            className={cx(navButtonClass, "absolute right-0")}
                            aria-label={t("goTime.focusViews.swiper.nextWindow")}
                            disabled={atEnd}
                            onClick={() => swiper?.slideNext()}
                        >
                            <ChevronRight className="size-6 stroke-[1.75px]" />
                        </button>
                    </div>
                    <div className="mt-2 hidden justify-center sm:flex">
                        <span className="text-sm tabular-nums text-tertiary">
                            {t("goTime.focusViews.swiper.counter", {
                                current: activeIndex + 1,
                                total,
                            })}
                        </span>
                    </div>
                </>
            ) : null}

            <div className="sr-only" aria-live="polite">
                {t("goTime.focusViews.swiper.showing", { current: activeIndex + 1, total })}
            </div>
        </div>
    );
}
function EmptyFocus({ title, body }: { title: string; body: string }) {
    return (
        <div
            className={cx(
                "rounded-xl border border-secondary bg-white px-5 py-8 text-center shadow-sm dark:bg-primary",
            )}
        >
            <p className="text-base font-semibold text-secondary">{title}</p>
            <p className="mt-2 text-sm text-tertiary">{body}</p>
        </div>
    );
}
