# Go Times Window — GSD Approach

**Objective:** Replace the placeholder "Wind Windows" on Go Time with a real feature that:
1. Saves go-time windows in the database
2. Invalidates when date is too old
3. Shows next windows for locations with as much data as possible per window

**Inspiration:** `/proto` DashboardPage (List/Calendar/**Recommendation** tab) + proto domain rules (evaluateSlice, groupSlicesIntoWindows, buildRecommendations).

---

## Current State

| Component | State |
|-----------|--------|
| **gowind/go-time.tsx** | Placeholder: "Wind Windows — Coming soon" |
| **gowind/data.tsx** | Fetches weather per location/provider, parses hourly slices, no window evaluation |
| **proto/DashboardPage** | Full implementation: `useForecastAndWindows` → `evaluateSlice` → `groupSlicesIntoWindows` → `buildRecommendations` |
| **proto/rules.ts** | `evaluateSlice`, `groupSlicesIntoWindows`, `selectNextBestWindow` |
| **api** | MongoDB, `WeatherCache` (TTL), `UserData` (setup), `/weather` endpoint |
| **.planning** | None — project has no GSD roadmap yet |

---

## GSD Workflow

### Step 0: Bootstrap (if starting fresh)

```
$gsd-new-project
```

This creates `PROJECT.md`, `ROADMAP.md`, and `.planning/` structure. Then add a milestone:

```
$gsd-new-milestone
```

Or, if you prefer a single milestone first:

```
$gsd-add-phase Go Times: persist windows in DB, invalidate by date, show next windows per location with full data
```

### Step 1: Discuss & Context

```
$gsd-discuss-phase 1
```

**Gray areas to lock in:**
- **Window schema:** What fields per stored window? (locationId, startTime, endTime, category, scores, providerCount, min/max wind/temp/precip)
- **Invalidation rule:** How old is "too old"? (e.g. windows starting before "now" or before start-of-today)
- **Data richness:** "As much data as possible" — prioritize multi-provider consensus? Prefer locations with more forecast coverage?
- **Refresh trigger:** When to recompute? On preferences/location change? On page load with TTL? Background job?

### Step 2: Plan Phase

```
$gsd-plan-phase 1 --research
```

---

## Suggested Phases (High-Level)

### Phase 1: API — Compute & Store Go-Time Windows

**Goal:** API endpoint that computes windows for a user (locations + preferences), stores them, and returns them. No invalidation logic yet.

**Deliverables:**
- `POST /go-times/compute` or `GET /go-times` (compute on demand)
- New model: `GoTimeWindow` (or `UserData` type `go-times`) with: `userId`, `locationId`, `startTime`, `endTime`, `category`, `averageScore`, `providerCount`, `minWindKmh`, `maxWindKmh`, `maxGustKmh`, `minTempC`, `maxTempC`, `minPrecipPct`, `maxPrecipPct`, `computedAt`
- Reuse proto logic: adapt `evaluateSlice`, `groupSlicesIntoWindows`, `buildRecommendations` to gowind Preferences + weather API response format
- Map gowind Preferences (km/h, °C, %) to evaluation inputs; fetch weather per location/provider from existing `/weather` + cache

### Phase 2: Invalidation & Freshness

**Goal:** Stored windows are invalid when date is too old. API returns fresh compute when stale.

**Deliverables:**
- Invalidation rule: e.g. `computedAt` older than 6h, or any window `startTime` < now → recompute
- `GET /go-times` returns cached only if valid; otherwise computes, stores, returns
- Optional: TTL index on `computedAt` or periodic cleanup of expired rows

### Phase 3: Gowind UI — Show Go-Time Windows

**Goal:** Go Time page displays next windows, grouped by day (like proto Recommendation tab).

**Deliverables:**
- Replace "Coming soon" with real content
- `GET /go-times` from frontend; show loading/error states
- Layout inspired by proto: List/Calendar/Recommendation toggle; group by day (Today, Tomorrow, Mon 24 Mar); per-window: location name, time range, category (Good/Marginal), wind/temp/precip chips, provider count
- "As much data as possible": sort/prioritize windows with higher `providerCount`; surface provider count in UI ("Across 3 sources")

### Phase 4 (Optional): Background Refresh & Richness

**Goal:** Proactively refresh windows when preferences change; maximize data richness per window.

**Deliverables:**
- On `PUT /setup` (preferences/locations change): trigger async recompute of go-times for that user
- Prefer locations with multi-provider data; in `buildRecommendations`, require minimum provider overlap before including a window

---

## Technical Notes

### Mapping Proto → Gowind

| Proto | Gowind |
|-------|--------|
| `UserSettings` (kts, etc.) | `Preferences` (km/h, °C, preferredTimeBlocks) |
| `getHourlyForecast` (proto api) | `GET /weather` (gowind api) |
| `ForecastSlice` (time, windSpeedKts, …) | Parse `hourly.time`, `wind_speed_10m`, etc. |
| `evaluateSlice` | Adapt thresholds: km/h→kts for evaluation or keep km/h in rules |
| `groupSlicesIntoWindows` | Same algorithm; `minWindowDurationHours` from `minSessionLengthMinutes` |
| `buildRecommendations` | Merge by location+day+hourBucket; clamp 2–3h blocks |
| `groupRecommendationsByDay` | `toLocalDateKey`, Today/Tomorrow/date labels |

### Storage Option A: Dedicated Model

```ts
// api/src/models/GoTimeWindow.ts
interface IGoTimeWindow {
  userId: ObjectId
  locationId: string
  startTime: Date
  endTime: Date
  category: 'GOOD' | 'MARGINAL'
  averageScore: number
  providerCount: number
  minWindKmh: number
  maxWindKmh: number
  // ...
  computedAt: Date
}
```

### Storage Option B: UserData type

```ts
// UserData { type: 'go-times', data: { computedAt, windows: [...] } }
```

Dedicated model allows per-window TTL, indexing by `userId`+`startTime`; UserData is simpler, one doc per user.

---

## Next Steps

1. **If no GSD yet:** Run `$gsd-new-project`, then add this as first milestone/phase.
2. **If you have a roadmap:** Run `$gsd-add-phase` with a phase description, then `$gsd-discuss-phase` and `$gsd-plan-phase`.
3. **To execute:** After plans are ready, `$gsd-execute-phase 1`.

---

*Created for tempest/gowind Go Times feature, inspired by proto DashboardPage Recommendation tab.*
