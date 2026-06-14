import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "@untitledui/icons";
import { A11y, Keyboard, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper/types";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { NativeSelect } from "@/components/base/select/select-native";
import { Toggle } from "@/components/base/toggle/toggle";
import { Tabs } from "@/components/application/tabs/tabs";
import { GoTimeWindowCard } from "@/components/go-time/go-time-window-card";
import type { GoTimeWindow } from "@/api/goTimes";
import { cx } from "@/utils/cx";

export type GoTimeFocusView = "next" | "best" | "all";

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

function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function qualityScore(w: GoTimeWindow): number {
    if (w.suitabilityScore != null) return w.suitabilityScore;
    return w.averageScore / 100;
}

function applyGoodOnly(windows: GoTimeWindow[], goodOnly: boolean): GoTimeWindow[] {
    if (!goodOnly) return windows;
    return windows.filter((w) => w.category === "GOOD");
}

function applyLocationFilter(windows: GoTimeWindow[], locationId: string): GoTimeWindow[] {
    if (locationId === GO_TIME_ALL_LOCATIONS) return windows;
    return windows.filter((w) => w.locationId === locationId);
}

function isWindowInNextSevenDays(w: GoTimeWindow, now: Date): boolean {
    const start = startOfLocalDay(now);
    const end = addDaysLocal(start, 7);
    const ws = new Date(w.startTime);
    return ws >= start && ws < end;
}

function compareByQualityThenTime(a: GoTimeWindow, b: GoTimeWindow): number {
    const q = qualityScore(b) - qualityScore(a);
    if (Math.abs(q) > 1e-9) return q;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
}

/** Clock order for the same calendar day and location (not suitability). */
function compareByStartTime(a: GoTimeWindow, b: GoTimeWindow): number {
    const ta = new Date(a.startTime).getTime();
    const tb = new Date(b.startTime).getTime();
    if (ta !== tb) return ta - tb;
    const ea = new Date(a.endTime).getTime();
    const eb = new Date(b.endTime).getTime();
    if (ea !== eb) return ea - eb;
    return a.id.localeCompare(b.id);
}

/**
 * All “next” candidates in the first non-empty tier (good → marginal → no-go), each tier in time order.
 */
function buildNextCandidates(futureSortedAsc: GoTimeWindow[]): GoTimeWindow[] {
    if (futureSortedAsc.length === 0) return [];
    const good = futureSortedAsc.filter((w) => w.category === "GOOD");
    if (good.length > 0) return good;
    const marginal = futureSortedAsc.filter((w) => w.category === "MARGINAL");
    if (marginal.length > 0) return marginal;
    const noGo = futureSortedAsc.filter((w) => w.category === "NO_GO");
    return noGo.length > 0 ? noGo : [...futureSortedAsc];
}

function getTimeFrameLabel(dateKey: string, now: Date): string {
    const todayKey = toLocalDateKey(now);
    const tomorrow = addDaysLocal(startOfLocalDay(now), 1);
    const tomorrowKey = toLocalDateKey(tomorrow);

    if (dateKey === todayKey) return "Today";
    if (dateKey === tomorrowKey) return "Tomorrow";
    const dayStart = new Date(dateKey + "T12:00:00");
    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(dayStart);
}

/** Day → Location → Windows for the full “All” view (chronological). */
function groupByDayThenLocation(
    windows: GoTimeWindow[],
    now: Date
): Array<{
    dateKey: string;
    label: string;
    locations: Array<{ locationId: string; locationName: string; windows: GoTimeWindow[] }>;
}> {
    const byDate = new Map<string, Map<string, GoTimeWindow[]>>();
    for (const w of windows) {
        const dateKey = toLocalDateKey(new Date(w.startTime));
        let byLoc = byDate.get(dateKey);
        if (!byLoc) {
            byLoc = new Map();
            byDate.set(dateKey, byLoc);
        }
        const list = byLoc.get(w.locationId) ?? [];
        list.push(w);
        byLoc.set(w.locationId, list);
    }
    const dateKeys = [...byDate.keys()].sort();
    return dateKeys.map((dateKey) => {
        const byLoc = byDate.get(dateKey)!;
        const locations = [...byLoc.entries()].map(([locationId, locWindows]) => ({
            locationId,
            locationName: locWindows[0]?.locationName ?? "Location",
            windows: [...locWindows].sort(compareByStartTime),
        }));
        locations.sort((a, b) =>
            a.locationName.localeCompare(b.locationName, undefined, { sensitivity: "base" }),
        );
        return {
            dateKey,
            label: getTimeFrameLabel(dateKey, now),
            locations,
        };
    });
}

interface GoTimeFocusViewsProps {
    windows: GoTimeWindow[];
    view: GoTimeFocusView;
    onViewChange: (v: GoTimeFocusView) => void;
    goodOnly: boolean;
    onGoodOnlyChange: (v: boolean) => void;
}

export function GoTimeFocusViews({ windows, view, onViewChange, goodOnly, onGoodOnlyChange }: GoTimeFocusViewsProps) {
    const now = useMemo(() => new Date(), []);

    const locationOptions = useMemo(() => {
        const map = new Map<string, string>();
        for (const w of windows) {
            if (!map.has(w.locationId)) {
                map.set(w.locationId, (w.locationName ?? "").trim() || "Location");
            }
        }
        return [...map.entries()]
            .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }))
            .map(([id, name]) => ({ value: id, label: name }));
    }, [windows]);

    const [locationFilterId, setLocationFilterId] = useState<string>(GO_TIME_ALL_LOCATIONS);

    useEffect(() => {
        if (
            locationFilterId !== GO_TIME_ALL_LOCATIONS &&
            !locationOptions.some((o) => o.value === locationFilterId)
        ) {
            setLocationFilterId(GO_TIME_ALL_LOCATIONS);
        }
    }, [locationFilterId, locationOptions]);

    /** API may send suitability-sorted windows; normalize to time-of-day order before any view logic. */
    const windowsChronological = useMemo(
        () => [...windows].sort(compareByStartTime),
        [windows],
    );

    const filtered = useMemo(() => {
        const g = applyGoodOnly(windowsChronological, goodOnly);
        return applyLocationFilter(g, locationFilterId);
    }, [windowsChronological, goodOnly, locationFilterId]);

    const locationScopeLabel =
        locationFilterId === GO_TIME_ALL_LOCATIONS
            ? "all locations"
            : locationOptions.find((o) => o.value === locationFilterId)?.label ?? "this location";

    const { nextCandidates, nextWindowNote } = useMemo(() => {
        const future = [...filtered]
            .filter((w) => new Date(w.startTime) >= now)
            .sort(compareByStartTime);
        const candidates = buildNextCandidates(future);
        if (candidates.length === 0) {
            return { nextCandidates: [] as GoTimeWindow[], nextWindowNote: null as string | null };
        }
        const hasGood = future.some((w) => w.category === "GOOD");
        if (hasGood) {
            return { nextCandidates: candidates, nextWindowNote: null as string | null };
        }
        const hasMarginal = future.some((w) => w.category === "MARGINAL");
        if (hasMarginal) {
            return {
                nextCandidates: candidates,
                nextWindowNote:
                    "No “good” slot yet—these are upcoming windows that still fit your limits (marginal).",
            };
        }
        return {
            nextCandidates: candidates,
            nextWindowNote:
                "No good or marginal slot yet—these are the windows we could form from the forecast.",
        };
    }, [filtered, now]);

    const bestCandidates = useMemo(() => {
        const pool = filtered.filter((w) => isWindowInNextSevenDays(w, now));
        if (pool.length === 0) return [];
        return [...pool].sort(compareByQualityThenTime);
    }, [filtered, now]);

    const allByDayAndLocation = useMemo(
        () => groupByDayThenLocation(filtered, now),
        [filtered, now],
    );

    return (
        <div className="space-y-6">
            <Tabs
                selectedKey={view}
                onSelectionChange={(k) => onViewChange(String(k) as GoTimeFocusView)}
            >
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4 lg:gap-y-2">
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 lg:min-w-0 lg:flex-1">
                        <Tabs.List
                            type="button-minimal"
                            size="sm"
                            fullWidth
                            className="min-w-0 opacity-95 sm:min-w-0 sm:max-w-[min(100%,42rem)] sm:flex-1"
                        >
                            <Tabs.Item id="next" label="Next" />
                            <Tabs.Item id="best" label="Best" />
                            <Tabs.Item id="all" label="All" />
                        </Tabs.List>
                        <Toggle
                            size="sm"
                            slim
                            label="Good only"
                            isSelected={goodOnly}
                            onChange={onGoodOnlyChange}
                            className="shrink-0 [&_p]:text-xs [&_p]:font-normal [&_p]:text-tertiary"
                        />
                    </div>
                    <div className="w-full min-w-0 sm:w-auto">
                        <NativeSelect
                            aria-label="Location filter"
                            value={locationFilterId}
                            onChange={(e) => setLocationFilterId(e.target.value)}
                            options={[
                                { value: GO_TIME_ALL_LOCATIONS, label: "All locations" },
                                ...locationOptions.map((o) => ({ value: o.value, label: o.label })),
                            ]}
                            className="w-full min-w-[10rem] sm:w-48"
                            selectClassName="pr-9 py-2 text-sm font-normal shadow-none ring-secondary/60"
                        />
                    </div>
                </div>
                <Tabs.Panel id="next" className="mt-8 outline-none focus:outline-none">
                        <section aria-labelledby="focus-next-heading" className="space-y-4">
                            <header>
                                <h2 id="focus-next-heading" className="text-lg font-semibold text-primary">
                                    When can you go next?
                                </h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    Earliest <span className="font-medium text-secondary">good</span> window first; if none,
                                    earliest marginal, then other—never a weaker slot ahead of a stronger one.{" "}
                                    <span className="text-tertiary">
                                        Scope: <span className="font-medium text-secondary">{locationScopeLabel}</span>.
                                    </span>
                                </p>
                            </header>
                            {nextWindowNote ? (
                                <p className="rounded-lg border border-amber-500/30 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-100/95">
                                    {nextWindowNote}
                                </p>
                            ) : null}
                            {nextCandidates.length > 0 ? (
                                <FocusWindowSwiper
                                    key={`next-${locationFilterId}-${goodOnly}-${nextCandidates.map((w) => w.id).join("|")}`}
                                    windows={nextCandidates}
                                    navLabel="Browse next windows"
                                />
                            ) : (
                                <EmptyFocus
                                    title="No upcoming window"
                                    body={
                                        goodOnly
                                            ? "No good-rated windows are scheduled ahead. Turn off “Good only” or adjust your setup."
                                            : "No forecast windows ahead match your preferences. Try widening limits or adding locations."
                                    }
                                />
                            )}
                        </section>
                    </Tabs.Panel>
                    <Tabs.Panel id="best" className="mt-8 outline-none focus:outline-none">
                        <section aria-labelledby="focus-best-heading" className="space-y-4">
                            <header>
                                <h2 id="focus-best-heading" className="text-lg font-semibold text-primary">
                                    What’s the best slot this week?
                                </h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    Highest suitability in the next seven days ({locationScopeLabel}).
                                </p>
                            </header>
                            {bestCandidates.length > 0 ? (
                                <FocusWindowSwiper
                                    key={`best-${locationFilterId}-${goodOnly}-${bestCandidates.map((w) => w.id).join("|")}`}
                                    windows={bestCandidates}
                                    navLabel="Browse best windows this week"
                                />
                            ) : (
                                <EmptyFocus
                                    title="No window in the next 7 days"
                                    body={
                                        goodOnly
                                            ? "No good-rated windows in range. Try turning off “Good only” or check your limits."
                                            : "Nothing in the next week matches your preferences."
                                    }
                                />
                            )}
                        </section>
                    </Tabs.Panel>
                    <Tabs.Panel id="all" className="mt-8 outline-none focus:outline-none">
                        <section aria-labelledby="focus-all-heading" className="space-y-4">
                            <header>
                                <h2 id="focus-all-heading" className="text-lg font-semibold text-primary">
                                    All windows
                                </h2>
                                <p className="mt-1 text-sm text-tertiary">
                                    Full forecast window list for {locationScopeLabel}, grouped by day and place—same horizon
                                    as Next and Best, with every slot visible.
                                </p>
                            </header>
                            {allByDayAndLocation.length === 0 ? (
                                <EmptyFocus
                                    title="No windows match"
                                    body={
                                        goodOnly
                                            ? "Nothing in this scope with “Good only” on. Turn it off or widen your setup."
                                            : "No forecast windows match your current filters."
                                    }
                                />
                            ) : (
                                <div className="space-y-10">
                                    {allByDayAndLocation.map((group) => (
                                        <section key={group.dateKey}>
                                            <h3 className="mb-4 text-base font-semibold text-primary">{group.label}</h3>
                                            <div className="space-y-6">
                                                {group.locations.map((loc) => (
                                                    <div
                                                        key={`${group.dateKey}-${loc.locationId}`}
                                                        className="rounded-lg border border-secondary/60 bg-secondary_alt/20 p-4"
                                                    >
                                                        <h4 className="mb-3 text-sm font-semibold text-secondary">
                                                            {loc.locationName}
                                                        </h4>
                                                        <div className="flex flex-col gap-3">
                                                            {loc.windows.map((w) => (
                                                                <GoTimeWindowCard
                                                                    key={w.id}
                                                                    w={w}
                                                                    showLocation={false}
                                                                    showDay={false}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </section>
                    </Tabs.Panel>
            </Tabs>
        </div>
    );
}

function FocusWindowSwiper({ windows, navLabel }: { windows: GoTimeWindow[]; navLabel: string }) {
    const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const total = windows.length;
    const atStart = activeIndex <= 0;
    const atEnd = activeIndex >= total - 1;

    return (
        <div
            className="go-time-swiper overflow-hidden px-8 sm:px-12 lg:px-16 [&_.swiper-pagination]:!-bottom-0 [&_.swiper-pagination-bullet]:!bg-quaternary [&_.swiper-pagination-bullet]:!opacity-100 [&_.swiper-pagination-bullet-active]:!bg-brand-solid [&_.swiper-slide]:opacity-25 [&_.swiper-slide]:transition-opacity [&_.swiper-slide-active]:opacity-100"
            aria-label={navLabel}
        >
            <div className="relative">
                <Swiper
                    modules={[A11y, Keyboard, Navigation, Pagination]}
                    slidesPerView={1}
                    spaceBetween={16}
                    threshold={8}
                    keyboard={{ enabled: true }}
                    pagination={{ clickable: true }}
                    a11y={{
                        enabled: true,
                        prevSlideMessage: "Previous wind window",
                        nextSlideMessage: "Next wind window",
                        paginationBulletMessage: "Go to wind window {{index}}",
                    }}
                    onSwiper={setSwiper}
                    onSlideChange={(s) => setActiveIndex(s.activeIndex)}
                    className="!overflow-visible !pb-12"
                >
                    {windows.map((w) => (
                        <SwiperSlide key={w.id} className="!h-auto">
                            <GoTimeWindowCard w={w} />
                        </SwiperSlide>
                    ))}
                </Swiper>

                {total > 1 ? (
                    <>
                        <button
                            type="button"
                            className="absolute top-[calc(50%-1.5rem)] -left-7 z-10 shrink-0 -translate-y-1/2 cursor-pointer text-fg-secondary transition hover:text-fg-primary disabled:cursor-default disabled:text-fg-disabled sm:-left-10 lg:-left-14"
                            aria-label="Previous window"
                            disabled={atStart}
                            onClick={() => swiper?.slidePrev()}
                        >
                            <ChevronLeft className="h-14 w-6 stroke-[1.75px] sm:h-16 sm:w-7" />
                        </button>
                        <button
                            type="button"
                            className="absolute top-[calc(50%-1.5rem)] -right-7 z-10 shrink-0 -translate-y-1/2 cursor-pointer text-fg-secondary transition hover:text-fg-primary disabled:cursor-default disabled:text-fg-disabled sm:-right-10 lg:-right-14"
                            aria-label="Next window"
                            disabled={atEnd}
                            onClick={() => swiper?.slideNext()}
                        >
                            <ChevronRight className="h-14 w-6 stroke-[1.75px] sm:h-16 sm:w-7" />
                        </button>
                    </>
                ) : null}
            </div>

            {total > 1 ? (
                <div className="mt-2 flex justify-center">
                    <span className="text-sm tabular-nums text-tertiary">
                        {activeIndex + 1}/{total}
                    </span>
                </div>
            ) : null}

            <div className="sr-only" aria-live="polite">
                Showing wind window {activeIndex + 1} of {total}.
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
