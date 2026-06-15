import { useEffect, useMemo, useState } from "react";
import { HelpCircle, MarkerPin01 } from "@untitledui/icons";
import {
    PROVIDER_DISPLAY_NAMES,
    type GoTimeDataMargins,
    type GoTimeWindow,
    type GoTimeWindowSeriesPoint,
} from "@/api/goTimes";
import { createGoTimeShare } from "@/api/go-time-shares";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

const SCORE_TOOLTIP_TITLE = "How score is calculated";

const SCORE_TOOLTIP_DESCRIPTION = (
    <>
        <span className="block">
            Score is the average preference fit (0–100) across every hour in this window: wind, gusts, temperature, and
            precipitation versus the limits you set.
        </span>
        <span className="mt-1.5 block">
            Forecasts are fused into one blended hour before scoring, so each hour reflects agreement across sources where
            possible.
        </span>
    </>
);

const METRIC = {
    wind: { stroke: "#0ea5e9", text: "text-sky-600 dark:text-sky-400", label: "Wind" },
    gust: { stroke: "#f97316", text: "text-orange-600 dark:text-orange-400", label: "Gusts" },
    temp: { stroke: "#d97706", text: "text-amber-700 dark:text-amber-400", label: "Temp" },
    precip: { stroke: "#2563eb", text: "text-blue-700 dark:text-blue-400", label: "Precip" },
    suitability: { stroke: "#10b981", text: "text-emerald-600 dark:text-emerald-400", label: "Score" },
    reliability: { stroke: "#64748b", text: "text-slate-600 dark:text-slate-400", label: "Reliability" },
} as const;

function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Calendar day for the window start (local), e.g. "Today", "Tomorrow", or "Sat, Apr 5". */
function formatWindowDayLabel(startIso: string): string {
    const start = new Date(startIso);
    const today = new Date();
    const sk = toLocalDateKey(start);
    const tk = toLocalDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmk = toLocalDateKey(tomorrow);
    if (sk === tk) return "Today";
    if (sk === tmk) return "Tomorrow";
    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(start);
}

function formatTimeRange(startIso: string, endIso: string): string {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const fmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
}

function formatHourClock(iso: string): string {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(d);
}

function displayStart(w: GoTimeWindow): string {
    return w.displayStartTime ?? w.startTime;
}

function displayEnd(w: GoTimeWindow): string {
    return w.displayEndTime ?? w.endTime;
}

/**
 * Windy uses UTC forecast steps 00,03,…,21; we snap window start to the nearest step.
 * Returns URL param `YYYY-MM-DD-HH` (UTC forecast step).
 * @see https://community.windy.com/topic/77/windy-com-url-parameters/1
 */
function windyUtcTimeStep(windowStartIso: string): string {
    const d = new Date(windowStartIso);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const utcH = d.getUTCHours();
    const slots = [0, 3, 6, 9, 12, 15, 18, 21];
    let bestH = slots[0]!;
    let bestDiff = 24;
    for (const s of slots) {
        const diff = Math.abs(utcH - s);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestH = s;
        }
    }
    const hh = String(bestH).padStart(2, "0");
    return `${y}-${mo}-${day}-${hh}`;
}

/** Vertical padding for sparkline + trend-arrow normalization (keep in sync). */
const NORM_PAD = 0.08;

function normMinMax(values: (number | null)[]): number[] {
    const nums = values.filter((v): v is number => v != null);
    if (nums.length === 0) return values.map(() => 0.5);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const pad = NORM_PAD;
    if (max === min) return values.map((v) => (v == null ? 0.5 : 0.5));
    return values.map((v) => {
        if (v == null) return 0.5;
        const t = (v - min) / (max - min);
        return pad + t * (1 - 2 * pad);
    });
}

function minMaxPair(values: (number | null)[]): { min: number; max: number } | null {
    const nums = values.filter((v): v is number => v != null);
    if (nums.length === 0) return null;
    return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** First and last numeric samples in series order (window start → window end). */
function firstLastInWindow(vals: (number | null)[]): { first: number; last: number } | null {
    let first: number | undefined;
    for (const v of vals) {
        if (v != null) {
            first = v;
            break;
        }
    }
    if (first === undefined) return null;
    let last: number | undefined;
    for (let i = vals.length - 1; i >= 0; i--) {
        const v = vals[i];
        if (v != null) {
            last = v;
            break;
        }
    }
    if (last === undefined) return null;
    return { first, last };
}

type SeriesKey = "windKmh" | "gustKmh" | "tempC" | "precipPct";

/**
 * First→last slope vs full-window range → rotation angle (deg) for a right-pointing arrow.
 * Steeper tilt = larger change relative to min–max spread in the window.
 */
function trendAngleDegFromSeries(vals: (number | null)[]): number | null {
    const mm = minMaxPair(vals);
    if (!mm) return null;
    const fl = firstLastInWindow(vals);
    if (!fl) return null;
    const range = mm.max - mm.min;
    if (range <= 0) return 0;
    const norm = (v: number) => NORM_PAD + ((v - mm.min) / range) * (1 - 2 * NORM_PAD);
    const y0 = norm(fl.first);
    const y1 = norm(fl.last);
    const ndy = y1 - y0;
    // Math.atan2: +y is up; SVG rotate: + is CW — negate so rising values tilt the arrow up.
    return (-Math.atan2(ndy, 1) * 180) / Math.PI;
}

/** First→last trend in the window: one SVG arrow rotated by change vs range (like the sparkline). */
function metricTrendInWindow(
    series: GoTimeWindowSeriesPoint[] | undefined,
    key: SeriesKey,
    threshold: number,
    unit: string,
    enabled: boolean
): { angleDeg: number; title: string } | null {
    if (!enabled || !series || series.length < 2) return null;
    const vals = series.map((p) => p[key]);
    const fl = firstLastInWindow(vals);
    if (!fl) return null;
    const angleDeg = trendAngleDegFromSeries(vals);
    if (angleDeg == null) return null;
    const d = fl.last - fl.first;
    const a = Math.round(fl.first * 10) / 10;
    const b = Math.round(fl.last * 10) / 10;
    let title: string;
    if (Math.abs(d) <= threshold) {
        title = `In this window: ${a} ${unit} at start \u2192 ${b} ${unit} at end (steady)`;
    } else if (d > threshold) {
        title = `In this window: rising from ${a} to ${b} ${unit} (first hour \u2192 last hour)`;
    } else {
        title = `In this window: falling from ${a} to ${b} ${unit} (first hour \u2192 last hour)`;
    }
    return { angleDeg, title };
}

function polylinePoints(ys: number[], w: number, h: number): string {
    if (ys.length === 0) return "";
    const n = ys.length;
    if (n === 1) {
        const yy = h - ys[0]! * h;
        return `M 0 ${yy.toFixed(2)} L ${w.toFixed(2)} ${yy.toFixed(2)}`;
    }
    const step = w / (n - 1);
    return ys
        .map((y, i) => {
            const x = i * step;
            const yy = h - y * h;
            return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${yy.toFixed(2)}`;
        })
        .join(" ");
}

type SparkSeriesKey = "wind" | "gust" | "temp" | "precip" | "suitability" | "reliability";

interface SparkSeriesRow {
    key: SparkSeriesKey;
    stroke: string;
    d: string;
    label: string;
    rangeText: string;
    /** First hour → last hour in window (same units as values). */
    startEndText: string;
}

function defaultVisibleSeries(rows: SparkSeriesRow[]): Set<SparkSeriesKey> {
    const s = new Set<SparkSeriesKey>();
    for (const r of rows) {
        if (r.key === "wind" || r.key === "gust") s.add(r.key);
    }
    if (s.size > 0) return s;
    for (const r of rows) s.add(r.key);
    return s;
}

function GoTimeSparkline({
    series,
    resetKey,
}: {
    series: GoTimeWindowSeriesPoint[];
    /** When this changes (e.g. new window), visibility resets to wind + gust only. */
    resetKey: string;
}) {
    const [visibleOverride, setVisibleOverride] = useState<Set<SparkSeriesKey> | null>(null);
    const [focusKey, setFocusKey] = useState<SparkSeriesKey | null>(null);

    const W = 100;
    const H = 36;

    const rows = useMemo(() => {
        const winds = series.map((p) => p.windKmh);
        const gusts = series.map((p) => p.gustKmh);
        const temps = series.map((p) => p.tempC);
        const precips = series.map((p) => p.precipPct);
        const suits = series.map((p) => p.suitability ?? p.confidence ?? 0);
        const rels = series.map((p) => p.reliability ?? p.confidence ?? 0);

        const built: SparkSeriesRow[] = [];

        const addRow = (
            key: SparkSeriesKey,
            metric: { stroke: string; label: string },
            vals: (number | null)[],
            rangeFmt: (min: number, max: number) => string,
            endpointsFmt: (first: number, last: number) => string
        ) => {
            const mm = minMaxPair(vals);
            if (!mm) return;
            const fl = firstLastInWindow(vals);
            built.push({
                key,
                stroke: metric.stroke,
                d: polylinePoints(normMinMax(vals), W, H),
                label: metric.label,
                rangeText: rangeFmt(mm.min, mm.max),
                startEndText: fl ? endpointsFmt(fl.first, fl.last) : "",
            });
        };

        if (winds.some((v) => v != null)) {
            addRow(
                "wind",
                METRIC.wind,
                winds,
                (a, b) => `${Math.round(a)}–${Math.round(b)} km/h`,
                (a, b) => `Start ${Math.round(a)} km/h → end ${Math.round(b)} km/h`
            );
        }
        if (gusts.some((v) => v != null)) {
            addRow(
                "gust",
                METRIC.gust,
                gusts,
                (a, b) => `${Math.round(a)}–${Math.round(b)} km/h`,
                (a, b) => `Start ${Math.round(a)} km/h → end ${Math.round(b)} km/h`
            );
        }
        if (temps.some((v) => v != null)) {
            addRow(
                "temp",
                METRIC.temp,
                temps,
                (a, b) => `${Math.round(a)}–${Math.round(b)} °C`,
                (a, b) => `Start ${Math.round(a)} °C → end ${Math.round(b)} °C`
            );
        }
        if (precips.some((v) => v != null)) {
            addRow(
                "precip",
                METRIC.precip,
                precips,
                (a, b) => `${Math.round(a)}–${Math.round(b)} %`,
                (a, b) => `Start ${Math.round(a)}% → end ${Math.round(b)}%`
            );
        }
        addRow(
            "suitability",
            METRIC.suitability,
            suits,
            (a, b) => `${Math.round(a * 100)}–${Math.round(b * 100)}%`,
            (a, b) => `Start ${Math.round(a * 100)}% → end ${Math.round(b * 100)}%`
        );
        addRow(
            "reliability",
            METRIC.reliability,
            rels,
            (a, b) => `${Math.round(a * 100)}–${Math.round(b * 100)}%`,
            (a, b) => `Start ${Math.round(a * 100)}% → end ${Math.round(b * 100)}%`
        );

        return built;
    }, [series]);

    useEffect(() => {
        setVisibleOverride(null);
        setFocusKey(null);
    }, [resetKey]);

    if (series.length === 0 || rows.length === 0) return null;

    const visible = visibleOverride ?? defaultVisibleSeries(rows);

    const onLegendClick = (key: SparkSeriesKey) => {
        const base = visibleOverride ?? defaultVisibleSeries(rows);
        const next = new Set(base);
        if (next.has(key)) {
            if (next.size <= 1) return;
            next.delete(key);
            setFocusKey((fk) => (fk === key ? null : fk));
        } else {
            next.add(key);
            setFocusKey(key);
        }
        setVisibleOverride(next);
    };

    const visibleRows = rows.filter((r) => visible.has(r.key));
    /** When several lines are on, prefer wind → gust for the start/end summary unless user focused a series. */
    const focusEffective =
        focusKey && visible.has(focusKey)
            ? focusKey
            : visibleRows.length === 1
              ? visibleRows[0].key
              : visibleRows.find((r) => r.key === "wind")?.key ??
                visibleRows.find((r) => r.key === "gust")?.key ??
                visibleRows[0]?.key ??
                null;

    /** Draw focused series so it stacks above the others. */
    const drawOrder =
        focusEffective != null
            ? [
                  ...visibleRows.filter((r) => r.key !== focusEffective),
                  ...visibleRows.filter((r) => r.key === focusEffective),
              ]
            : visibleRows;

    const detailRow =
        focusEffective != null ? rows.find((r) => r.key === focusEffective && visible.has(r.key)) : undefined;

    return (
        <div className="mt-3 border-t border-secondary pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                Trends (this window)
            </p>
            <div className="rounded-md bg-secondary_alt/40 px-1 py-1 dark:bg-secondary_alt/25">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="block h-14 w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Trend lines for this window"
                >
                    {drawOrder.map((r) => (
                        <path
                            key={r.key}
                            d={r.d}
                            fill="none"
                            stroke={r.stroke}
                            strokeWidth={2.25}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            className="transition-[opacity] duration-200"
                        />
                    ))}
                </svg>
            </div>
            {detailRow?.startEndText ? (
                <p className="mt-2 rounded-md border border-secondary/60 bg-secondary_alt/30 px-2 py-1.5 text-[10px] leading-snug text-secondary dark:bg-secondary_alt/20">
                    <span className="font-semibold text-primary">{detailRow.label}</span>
                    <span className="text-tertiary"> — first vs last hour in window: </span>
                    <span className="tabular-nums text-primary">{detailRow.startEndText}</span>
                </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1.5 text-[10px] leading-tight">
                {rows.map((r) => {
                    const on = visible.has(r.key);
                    return (
                        <button
                            key={r.key}
                            type="button"
                            onClick={() => onLegendClick(r.key)}
                            className={cx(
                                "inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-left transition",
                                on && "bg-secondary_alt ring-1 ring-brand-400/60 dark:ring-brand-500/50",
                                !on && "opacity-45 hover:bg-secondary_alt/50 hover:opacity-90"
                            )}
                            aria-pressed={on}
                            title={on ? "Click to hide this series" : "Show this series"}
                        >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.stroke }} />
                            <span className={cx("font-medium", on ? "text-secondary" : "text-tertiary")}>{r.label}</span>
                            <span className="tabular-nums text-tertiary">{r.rangeText}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

/** Short note when raw model spread is wide vs fused headline (no provider names). */
function marginAnnotations(m: GoTimeDataMargins | undefined): {
    wind: string | null;
    gust: string | null;
    temp: string | null;
    precip: string | null;
} {
    if (!m) {
        return { wind: null, gust: null, temp: null, precip: null };
    }
    const r = (n: number) => Math.round(n);
    const windSpread = m.wind.sourceMax - m.wind.sourceMin;
    const wind =
        windSpread >= 3
            ? `Across models ${r(m.wind.sourceMin)}–${r(m.wind.sourceMax)} km/h`
            : null;
    const gust =
        m.gust != null && m.gust.sourceMax - m.gust.sourceMin >= 3
            ? `Across models ${r(m.gust.sourceMin)}–${r(m.gust.sourceMax)} km/h`
            : null;
    const tSpread = m.tempC.sourceMax - m.tempC.sourceMin;
    const temp =
        tSpread >= 1.5
            ? `Across models ${r(m.tempC.sourceMin)}–${r(m.tempC.sourceMax)} °C`
            : null;
    const pSpread = m.precipPct ? m.precipPct.sourceMax - m.precipPct.sourceMin : 0;
    const precip =
        m.precipPct != null && pSpread >= 15
            ? `Across models ${r(m.precipPct.sourceMin)}–${r(m.precipPct.sourceMax)}%`
            : null;
    return { wind, gust, temp, precip };
}

function categoryLabel(cat: GoTimeWindow["category"]): string {
    if (cat === "GOOD") return "Good";
    if (cat === "MARGINAL") return "Marginal";
    return "Not ideal";
}

/** Reliability text for the collapsible details block (excludes disagreement-only lines shown under stats). */
function reliabilityExplanationForDetails(ex: string | undefined): string | null {
    const t = ex?.trim();
    if (!t) return null;
    if (/disagreement/i.test(t)) return null;
    return t;
}

/** Footer line when sources disagree (shown below stats + altitude winds). */
function disagreementFooterText(w: GoTimeWindow): string | null {
    const ex = w.reliabilityExplanation?.trim();
    const fromApi = ex && /disagreement/i.test(ex) ? ex : null;
    if (fromApi) return fromApi;
    if (w.dataMargins?.hasSpread || (w.reliabilityScore != null && w.reliabilityScore < 0.52)) {
        return "Some disagreement between sources";
    }
    return null;
}

/**
 * Trend line beside Charts. Suitability (0–1) encodes wind, gust, temp, precip, and **time-of-day** prefs,
 * so it can move opposite to wind/gust (e.g. later hours outside a preferred block). When suitability
 * says “worsening” but **both** wind and gust ease through the window, we headline the physical trend
 * instead — avoids calling “worsening” when the chart clearly shows wind and gusts settling down.
 */
function chartsTrendMessage(w: GoTimeWindow): string | null {
    const series = w.windowSeries;
    if (!series || series.length < 2) return null;

    const suits = series.map((p) => p.suitability ?? p.confidence ?? null);
    const winds = series.map((p) => p.windKmh);
    const gusts = series.map((p) => p.gustKmh);
    const flS = firstLastInWindow(suits);
    const flw = firstLastInWindow(winds);
    const flg = firstLastInWindow(gusts);

    /** First→last drop large enough to treat as easing (km/h). */
    const EASE = 1;

    const windEases = flw != null && flw.last < flw.first - EASE;
    const gustEases =
        !w.hasGusts || flg == null ? true : flg.last < flg.first - EASE;

    if (flS) {
        const d = flS.last - flS.first;
        if (d < -0.05 && windEases && gustEases) {
            return "Wind and gusts easing through the window";
        }
        if (d > 0.05) return "Conditions improving through the window";
        if (d < -0.05) return "Conditions worsening through the window";
        return "Conditions steady through the window";
    }

    const parts: string[] = [];
    if (flw) {
        const dw = flw.last - flw.first;
        if (dw > 2) parts.push("Wind picking up through the window");
        else if (dw < -2) parts.push("Wind easing through the window");
    }
    if (flg) {
        const dg = flg.last - flg.first;
        if (dg > 3) parts.push("Gusts rising through the window");
        else if (dg < -3) parts.push("Gusts easing through the window");
    }

    if (parts.length > 0) return parts.slice(0, 2).join(" · ");
    return null;
}

/** Model-by-model tables (used inside the Details disclosure). */
function GoTimeCardModelBreakdown({ w }: { w: GoTimeWindow }) {
    const showModel =
        (w.byProvider?.length ?? 0) > 0 || (w.hourlyBySource?.length ?? 0) > 0;
    if (!showModel) return null;

    return (
        <div className="space-y-4 text-xs">
            {w.byProvider && w.byProvider.length > 0 && (
                <div className="overflow-x-auto">
                    <p className="mb-1.5 font-semibold text-secondary">Summary by source (this window)</p>
                    <table className="w-full min-w-[520px] border-collapse text-left text-tertiary">
                        <thead>
                            <tr className="border-b border-secondary text-secondary">
                                <th className="py-1 pr-2 font-medium">Source</th>
                                <th className="py-1 pr-2 font-medium">Hours</th>
                                <th className="py-1 pr-2 font-medium">Wind km/h</th>
                                <th className="py-1 pr-2 font-medium">Gust km/h</th>
                                <th className="py-1 pr-2 font-medium">Temp °C</th>
                                <th className="py-1 pr-2 font-medium">Precip %</th>
                                <th className="py-1 font-medium">Avg score</th>
                            </tr>
                        </thead>
                        <tbody>
                            {w.byProvider.map((p) => (
                                <tr key={p.providerId} className="border-b border-secondary/40">
                                    <td className="py-1.5 pr-2 text-primary">
                                        {PROVIDER_DISPLAY_NAMES[p.providerId] ?? p.providerId}
                                    </td>
                                    <td className="py-1.5 pr-2">{p.hourCount}</td>
                                    <td className="py-1.5 pr-2">
                                        {p.minWindKmh}–{p.maxWindKmh}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                        {p.minGustKmh != null && p.maxGustKmh != null
                                            ? `${p.minGustKmh}–${p.maxGustKmh}`
                                            : "—"}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                        {p.minTempC}–{p.maxTempC}
                                    </td>
                                    <td className="py-1.5 pr-2">
                                        {p.minPrecipPct != null && p.maxPrecipPct != null
                                            ? `${p.minPrecipPct}–${p.maxPrecipPct}`
                                            : "—"}
                                    </td>
                                    <td className="py-1.5">{p.avgScore}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {w.hourlyBySource && w.hourlyBySource.length > 0 && (
                <div className="overflow-x-auto">
                    <p className="mb-1.5 font-semibold text-secondary">Each hour by source</p>
                    <div className="space-y-3">
                        {w.hourlyBySource.map((row) => (
                            <div key={row.time}>
                                <p className="mb-1 font-medium text-primary">{formatHourClock(row.time)}</p>
                                {row.outlierHints && row.outlierHints.length > 0 && (
                                    <p className="mb-2 text-xs leading-snug text-amber-800 dark:text-amber-200/95">
                                        <span className="font-semibold">Away from blend:</span>{" "}
                                        {row.outlierHints.join(" · ")}
                                    </p>
                                )}
                                <table className="w-full min-w-[480px] border-collapse text-left text-tertiary">
                                    <thead>
                                        <tr className="border-b border-secondary text-secondary">
                                            <th className="py-1 pr-2 font-medium">Source</th>
                                            <th className="py-1 pr-2 font-medium">Wind</th>
                                            <th className="py-1 pr-2 font-medium">Gust</th>
                                            <th className="py-1 pr-2 font-medium">Temp</th>
                                            <th className="py-1 pr-2 font-medium">Precip</th>
                                            <th className="py-1 pr-2 font-medium">Cat</th>
                                            <th className="py-1 font-medium">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {row.providers.map((pr) => (
                                            <tr
                                                key={`${row.time}-${pr.providerId}`}
                                                className="border-b border-secondary/40"
                                            >
                                                <td className="py-1 pr-2 text-primary">
                                                    {PROVIDER_DISPLAY_NAMES[pr.providerId] ?? pr.providerId}
                                                </td>
                                                <td className="py-1 pr-2">{pr.windKmh}</td>
                                                <td className="py-1 pr-2">{pr.gustKmh ?? "—"}</td>
                                                <td className="py-1 pr-2">{pr.tempC}</td>
                                                <td className="py-1 pr-2">{pr.precipPct ?? "—"}</td>
                                                <td className="py-1 pr-2">
                                                    <span
                                                        className={cx(
                                                            pr.category === "GOOD" &&
                                                                "text-emerald-600 dark:text-emerald-400",
                                                            pr.category === "MARGINAL" &&
                                                                "text-amber-600 dark:text-amber-400",
                                                            pr.category === "NO_GO" && "text-quaternary",
                                                        )}
                                                    >
                                                        {pr.category === "GOOD"
                                                            ? "Good"
                                                            : pr.category === "MARGINAL"
                                                              ? "Marginal"
                                                              : "No-go"}
                                                    </span>
                                                </td>
                                                <td className="py-1.5">{pr.score}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function GoTimeCardDetailsPanelContent({
    w,
    reliabilityDetails,
}: {
    w: GoTimeWindow;
    reliabilityDetails: string | null;
}) {
    return (
        <>
            <GoTimeCardModelBreakdown w={w} />
            {reliabilityDetails ? (
                <p className="text-xs leading-snug text-tertiary">{reliabilityDetails}</p>
            ) : null}
            {w.evaluationNotes && w.evaluationNotes.length > 0 ? (
                <ul className="list-inside list-disc space-y-0.5 text-xs text-tertiary">
                    {w.evaluationNotes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            ) : null}
        </>
    );
}

function GoTimeCardWindyLink({ windyHref }: { windyHref: string }) {
    return (
        <a
            href={windyHref}
            target="_blank"
            rel="noopener noreferrer"
            title="Opens Windy at your saved spot with a pin; forecast time matches this window start (UTC step)."
            className="inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-brand-600 underline-offset-2 hover:underline sm:text-sm dark:text-brand-400"
        >
            <MarkerPin01 className="size-4 shrink-0" aria-hidden />
            <span>
                Inspect on{"\u00A0"}
                Windy.com
            </span>
        </a>
    );
}

function TrendArrowSvg({ angleDeg }: { angleDeg: number }) {
    return (
        <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" aria-hidden>
            <g transform={`translate(12,12) rotate(${angleDeg})`}>
                <path
                    d="M -7 0 L 8 0 M 4 -4 L 8 0 L 4 4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>
        </svg>
    );
}

function TrendArrowButton({ trend }: { trend: { angleDeg: number; title: string } }) {
    return (
        <Tooltip title="Trend in this window" description={trend.title} placement="top">
            <TooltipTrigger
                className="inline-flex shrink-0 cursor-default rounded p-0.5 text-tertiary outline-hidden hover:bg-secondary_alt/60 focus-visible:ring-2 focus-visible:ring-brand"
                aria-label={trend.title}
            >
                <TrendArrowSvg angleDeg={trend.angleDeg} />
            </TooltipTrigger>
        </Tooltip>
    );
}

function ShareIcon(props: { className?: string }) {
    return (
        <svg
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            className={props.className}
        >
            <path
                d="M7.5 11.2 12.6 14M12.5 6 7.5 8.8M15 5.8a2.3 2.3 0 1 0-2.3-2.3A2.3 2.3 0 0 0 15 5.8ZM5 12.3A2.3 2.3 0 1 0 2.7 10 2.3 2.3 0 0 0 5 12.3ZM15 17.3a2.3 2.3 0 1 0-2.3-2.3 2.3 2.3 0 0 0 2.3 2.3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function GoTimeWindowCard({
    w,
    /** When the list already shows location (e.g. grouped by place), hide the location line. */
    showLocation = true,
    /** When the list already shows the calendar day (e.g. grouped by date), hide the day line. */
    showDay = true,
    allowShare = true,
    compact = false,
}: {
    w: GoTimeWindow;
    showLocation?: boolean;
    showDay?: boolean;
    allowShare?: boolean;
    compact?: boolean;
}) {
    const [shareState, setShareState] = useState<"idle" | "sharing" | "shared" | "copied" | "error">("idle");
    const qualityClass =
        w.category === "GOOD"
            ? "text-emerald-600 dark:text-emerald-400"
            : w.category === "MARGINAL"
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400";

    const margins = marginAnnotations(w.dataMargins);
    const locationLine = (w.locationName ?? "").trim();
    const hasLocationOrDay = (showLocation && locationLine.length > 0) || showDay;

    const scoreDisplay = Math.round(w.averageScore);
    const reliabilityDetails = reliabilityExplanationForDetails(w.reliabilityExplanation);
    const disagreementFooter = disagreementFooterText(w);
    const chartsTrend = chartsTrendMessage(w);
    const hasWindByHeight = w.windByHeight && Object.keys(w.windByHeight).length > 0;

    const windyUrlParam =
        w.locationLat != null && w.locationLng != null ? windyUtcTimeStep(w.startTime) : null;
    const windyHref =
        windyUrlParam != null
            ? `https://www.windy.com/?${windyUrlParam},${w.locationLat},${w.locationLng},11,d:picker`
            : null;

    const ws = w.windowSeries;
    const windTrendArrow = metricTrendInWindow(ws, "windKmh", 0.5, "km/h", true);
    const gustTrendArrow = metricTrendInWindow(ws, "gustKmh", 1, "km/h", w.hasGusts);
    const tempTrendArrow = metricTrendInWindow(ws, "tempC", 0.5, "°C", true);
    const precipTrendArrow = metricTrendInWindow(ws, "precipPct", 2, "%", w.hasPrecip);

    const hasDetailsPanel =
        Boolean(reliabilityDetails) ||
        (w.evaluationNotes && w.evaluationNotes.length > 0) ||
        (w.byProvider?.length ?? 0) > 0 ||
        (w.hourlyBySource?.length ?? 0) > 0;

    const buildShareText = () => {
        const where = (w.locationName ?? "").trim();
        const when = `${formatWindowDayLabel(displayStart(w))} ${formatTimeRange(displayStart(w), displayEnd(w))}`;
        return `GoWind flying window${where ? ` at ${where}` : ""}: ${when}`;
    };

    const handleShare = async () => {
        if (shareState === "sharing") return;
        setShareState("sharing");
        try {
            const share = await createGoTimeShare({
                window: w,
                sharedAt: new Date().toISOString(),
            });
            const url = `${window.location.origin}/go-time/share?id=${encodeURIComponent(share.shareId)}`;
            const nativeShare = (navigator as { share?: (data: ShareData) => Promise<void> }).share;
            if (typeof nativeShare === "function") {
                await nativeShare.call(navigator, {
                    title: "Shared GoWind window",
                    text: buildShareText(),
                    url,
                });
                setShareState("shared");
            } else {
                await navigator.clipboard.writeText(url);
                setShareState("copied");
            }
            window.setTimeout(() => setShareState("idle"), 1800);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                setShareState("idle");
                return;
            }
            console.error("Go-time share failed:", err);
            setShareState("error");
            window.setTimeout(() => setShareState("idle"), 2200);
        }
    };

    return (
        <div className="flex w-full flex-col gap-2.5 rounded-xl border border-secondary bg-white px-4 py-3.5 shadow-sm dark:bg-primary">
            {/* Row 1: location/date + category (left), score (right); row 2: time range */}
            <div className={cx("flex flex-col", hasLocationOrDay ? "gap-1.5" : "gap-1")}>
                <div
                    className={cx(
                        "flex flex-row justify-between gap-3",
                        hasLocationOrDay ? "items-start" : "items-center",
                    )}
                >
                    <div className={cx("min-w-0", hasLocationOrDay && "flex-1")}>
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            {showLocation && locationLine ? (
                                <p className="text-sm font-semibold text-secondary">{locationLine}</p>
                            ) : showDay ? (
                                <p className="text-sm font-semibold text-secondary">
                                    {formatWindowDayLabel(displayStart(w))}
                                </p>
                            ) : null}
                            <p className={cx("text-sm font-semibold sm:text-base", qualityClass)}>
                                {categoryLabel(w.category)}
                            </p>
                        </div>
                        {showLocation && locationLine && showDay ? (
                            <p className="mt-0.5 text-xs font-medium text-tertiary">
                                {formatWindowDayLabel(displayStart(w))}
                            </p>
                        ) : null}
                    </div>
                    {/* Single-line score so a short left column (e.g. only “Good”) isn’t followed by a tall empty band before the time row */}
                    <div className="flex shrink-0 items-center gap-1.5">
                        {allowShare ? (
                            <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-fg-quaternary outline-hidden transition duration-200 hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60"
                                aria-label="Share this go-time window"
                                disabled={shareState === "sharing"}
                                onClick={handleShare}
                            >
                                <ShareIcon className="size-4 shrink-0" />
                                <span>Share</span>
                            </button>
                        ) : null}
                        {shareState === "shared" || shareState === "copied" ? (
                            <span className="text-[10px] font-semibold text-success-primary">
                                {shareState === "shared" ? "Shared" : "Copied"}
                            </span>
                        ) : shareState === "error" ? (
                            <span className="text-[10px] font-semibold text-error-primary">Failed</span>
                        ) : null}
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-tertiary">Score</span>
                        <span className="text-xl font-bold tabular-nums text-primary sm:text-2xl">{scoreDisplay}</span>
                        <Tooltip title={SCORE_TOOLTIP_TITLE} description={SCORE_TOOLTIP_DESCRIPTION} placement="left">
                            <TooltipTrigger
                                className="rounded-md p-0.5 text-fg-quaternary outline-hidden transition duration-200 hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:ring-2 focus-visible:ring-brand"
                                aria-label={SCORE_TOOLTIP_TITLE}
                            >
                                <HelpCircle className="size-4 shrink-0" />
                            </TooltipTrigger>
                        </Tooltip>
                    </div>
                </div>
                <p className="text-xl font-bold tabular-nums tracking-tight text-primary sm:text-2xl">
                    {formatTimeRange(displayStart(w), displayEnd(w))}
                </p>
            </div>

            {/* Main stats */}
            <div className={cx("grid grid-cols-2 gap-3", !compact && "sm:grid-cols-4")}>
                <div>
                    <p className={cx("text-[10px] font-semibold uppercase tracking-wide", METRIC.wind.text)}>
                        {METRIC.wind.label}
                    </p>
                    <p className={cx("mt-0.5 flex flex-row flex-wrap items-baseline gap-1.5 text-lg font-bold tabular-nums sm:text-xl", METRIC.wind.text)}>
                        <span>
                            <span className="whitespace-nowrap">{w.minWindKmh}–{w.maxWindKmh}{" "}
                            <span className="text-xs font-semibold opacity-85">km/h</span>
                            </span>
                        </span>
                        {windTrendArrow ? <TrendArrowButton trend={windTrendArrow} /> : null}
                    </p>
                    {margins.wind ? (
                        <p className="mt-1 text-[10px] leading-snug text-amber-800/95 dark:text-amber-200/90">
                            {margins.wind}
                        </p>
                    ) : null}
                </div>
                <div>
                    <p className={cx("text-[10px] font-semibold uppercase tracking-wide", METRIC.gust.text)}>
                        {METRIC.gust.label}
                    </p>
                    <p className={cx("mt-0.5 flex flex-row flex-wrap items-baseline gap-1.5 text-lg font-bold tabular-nums sm:text-xl", METRIC.gust.text)}>
                        <span>
                            <span className="whitespace-nowrap">
                                {w.hasGusts ? `${w.maxGustKmh}` : "—"}{" "}
                                {w.hasGusts ? <span className="text-xs font-semibold opacity-85">km/h</span> : null}
                            </span>
                        </span>
                        {gustTrendArrow ? <TrendArrowButton trend={gustTrendArrow} /> : null}
                    </p>
                    {margins.gust ? (
                        <p className="mt-1 text-[10px] leading-snug text-amber-800/95 dark:text-amber-200/90">
                            {margins.gust}
                        </p>
                    ) : null}
                </div>
                <div>
                    <p className={cx("text-[10px] font-semibold uppercase tracking-wide", METRIC.temp.text)}>
                        {METRIC.temp.label}
                    </p>
                    <p className={cx("mt-0.5 flex flex-row flex-wrap items-baseline gap-1.5 text-lg font-bold tabular-nums sm:text-xl", METRIC.temp.text)}>
                        <span>
                            <span className="whitespace-nowrap">
                                {w.minTempC}–{w.maxTempC}{" "}
                                <span className="text-xs font-semibold opacity-85">°C</span>
                            </span>
                        </span>
                        {tempTrendArrow ? <TrendArrowButton trend={tempTrendArrow} /> : null}
                    </p>
                    {margins.temp ? (
                        <p className="mt-1 text-[10px] leading-snug text-amber-800/95 dark:text-amber-200/90">
                            {margins.temp}
                        </p>
                    ) : null}
                </div>
                <div>
                    <p className={cx("text-[10px] font-semibold uppercase tracking-wide", METRIC.precip.text)}>
                        {METRIC.precip.label}
                    </p>
                    <p className={cx("mt-0.5 flex flex-row flex-wrap items-baseline gap-1.5 text-lg font-bold tabular-nums sm:text-xl", METRIC.precip.text)}>
                        <span>
                            <span className="whitespace-nowrap">
                                {w.hasPrecip ? `${w.minPrecipPct}–${w.maxPrecipPct}` : "—"}{" "}
                                {w.hasPrecip ? <span className="text-xs font-semibold opacity-85">%</span> : null}
                            </span>
                        </span>
                        {precipTrendArrow ? <TrendArrowButton trend={precipTrendArrow} /> : null}
                    </p>
                    {margins.precip ? (
                        <p className="mt-1 text-[10px] leading-snug text-amber-800/95 dark:text-amber-200/90">
                            {margins.precip}
                        </p>
                    ) : null}
                </div>
            </div>

            {(hasWindByHeight || windyHref || disagreementFooter) && (
                <div className="space-y-2 border-t border-secondary/60 pt-2">
                    {(hasWindByHeight && w.windByHeight) || windyHref ? (
                        <div className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
                            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5 text-xs">
                                {hasWindByHeight && w.windByHeight
                                    ? Object.entries(w.windByHeight).map(([key, v]) => (
                                          <span
                                              key={key}
                                              className="rounded-md bg-secondary_alt px-2 py-0.5 font-medium text-secondary"
                                          >
                                              {v.label}: {v.minWindKmh}–{v.maxWindKmh} km/h
                                          </span>
                                      ))
                                    : null}
                            </div>
                            {windyHref ? <GoTimeCardWindyLink windyHref={windyHref} /> : null}
                        </div>
                    ) : null}
                    {disagreementFooter ? (
                        <p className="text-[11px] leading-snug text-amber-800/95 dark:text-amber-200/90">
                            {disagreementFooter}
                        </p>
                    ) : null}
                </div>
            )}

            {w.windowSeries && w.windowSeries.length > 0 ? (
                <details className="rounded-lg border border-secondary/70 bg-secondary_alt/25 dark:bg-secondary_alt/15">
                    <summary className="flex cursor-pointer list-none flex-row flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 text-xs font-medium text-secondary marker:hidden [&::-webkit-details-marker]:hidden">
                        <span className="text-tertiary">▸</span>
                        <span>Charts</span>
                        {chartsTrend ? (
                            <span className="text-[11px] font-normal leading-snug text-tertiary">
                                {chartsTrend}
                            </span>
                        ) : null}
                    </summary>
                    <div className="border-t border-secondary/60 px-3 pb-3 pt-2">
                        <GoTimeSparkline series={w.windowSeries} resetKey={`${w.startTime}-${w.endTime}`} />
                        {hasDetailsPanel && (
                            <details className="mt-3 rounded-md border border-secondary/60 bg-white dark:bg-primary/25">
                                <summary className="cursor-pointer list-none px-2.5 py-1.5 text-xs font-medium text-secondary marker:hidden [&::-webkit-details-marker]:hidden">
                                    <span className="text-tertiary">▸</span> Details
                                </summary>
                                <div className="space-y-3 border-t border-secondary/50 px-2.5 pb-2.5 pt-2">
                                    <GoTimeCardDetailsPanelContent w={w} reliabilityDetails={reliabilityDetails} />
                                </div>
                            </details>
                        )}
                    </div>
                </details>
            ) : (
                hasDetailsPanel && (
                    <details className="rounded-lg border border-secondary/70 bg-secondary_alt/25 dark:bg-secondary_alt/15">
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-secondary marker:hidden [&::-webkit-details-marker]:hidden">
                            <span className="text-tertiary">▸</span> Details
                        </summary>
                        <div className="space-y-3 border-t border-secondary/60 px-3 pb-3 pt-2">
                            <GoTimeCardDetailsPanelContent w={w} reliabilityDetails={reliabilityDetails} />
                        </div>
                    </details>
                )
            )}
        </div>
    );
}
