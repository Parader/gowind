import type { FC } from 'react'
import { useState } from 'react'
import { useLocations } from '../state/useLocations'
import { useSettings } from '../state/useSettings'
import { useForecastAndWindows } from '../state/useForecastAndWindows'
import { FlightRatingCategory, type FlightWindow } from '../domain/types'

const KTS_TO_KMH = 1.852

export const DashboardPage: FC = () => {
  const { locations } = useLocations()
  const { settings } = useSettings()
  const { loading, error, windows } = useForecastAndWindows({
    locations,
    settings,
  })

  const hasLocations = locations.length > 0
  const [sortBy, setSortBy] = useState<'time' | 'score' | 'location'>('time')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<
    'all' | 'open-meteo' | 'weatherapi' | 'meteosource' | 'visualcrossing'
  >('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'recommendation'>('list')

  const now = new Date()

  const futureWindows = windows.filter((w) => new Date(w.startTime).getTime() >= now.getTime())

  const providerFilteredWindows =
    providerFilter === 'all'
      ? futureWindows
      : futureWindows.filter((w) => w.providerId === providerFilter)

  const filteredWindows =
    locationFilter === 'all'
      ? providerFilteredWindows
      : providerFilteredWindows.filter((w) => w.locationId === locationFilter)

  const sortedWindows = [...filteredWindows].sort((a, b) => {
    if (sortBy === 'score') {
      return b.averageScore - a.averageScore
    }

    if (sortBy === 'location') {
      const locA = locations.find((loc) => loc.id === a.locationId)
      const locB = locations.find((loc) => loc.id === b.locationId)
      const nameA = locA?.name ?? ''
      const nameB = locB?.name ?? ''
      if (nameA === nameB) {
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      }
      return nameA.localeCompare(nameB)
    }

    // Default: chronological
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  const timeFrameGroups = groupWindowsByTimeFrame(sortedWindows)

  // For recommendations we ignore source filter so we can merge all providers,
  // but still respect location filter.
  const baseForRecommendations =
    locationFilter === 'all'
      ? futureWindows
      : futureWindows.filter((w) => w.locationId === locationFilter)
  const recommendationWindows = buildRecommendations(baseForRecommendations)

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Next best time to fly</h1>
        <p className="page-subtitle">
          Tempest scans your saved spots and thresholds to surface the next good window.
        </p>
      </header>

      <div className="page-grid">
        {!hasLocations && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Add a flying location to get started</div>
                <div className="card-meta">
                  <span className="pill">Locations · Settings</span>
                </div>
              </div>
              <span className="card-badge">Setup</span>
            </div>
            <p className="muted">
              Save at least one paramotor site with coordinates, then configure your wind
              and temperature limits. Tempest will use that to recommend when and where to
              go fly.
            </p>
          </div>
        )}
        {hasLocations && (
          <>
            {sortedWindows.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">All upcoming windows</div>
                    <div className="card-meta">
                      <span className="pill">
                        {locations.length} location{locations.length === 1 ? '' : 's'}
                      </span>
                      <span className="pill">
                        Horizon · next {settings.horizonHours}h · min{' '}
                        {settings.minWindowDurationHours}h
                      </span>
                    </div>
                  </div>
                  <div className="card-header-right">
                    <div className="view-toggle">
                      <button
                        type="button"
                        className={`view-toggle-button ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                      >
                        List
                      </button>
                      <button
                        type="button"
                        className={`view-toggle-button ${viewMode === 'calendar' ? 'active' : ''}`}
                        onClick={() => setViewMode('calendar')}
                      >
                        Calendar
                      </button>
                      <button
                        type="button"
                        className={`view-toggle-button ${viewMode === 'recommendation' ? 'active' : ''}`}
                        onClick={() => setViewMode('recommendation')}
                      >
                        Recommendations
                      </button>
                    </div>
                    <span className="card-badge">{sortedWindows.length}</span>
                  </div>
                </div>
                <div className="page-grid">
                  <div className="field-group">
                    <div className="field-label-row">
                      <span className="field-label">Sort by</span>
                    </div>
                    <select
                      className="field-input"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as 'time' | 'score' | 'location')
                      }
                    >
                      <option value="time">Start time</option>
                      <option value="score">Score</option>
                      <option value="location">Location</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <div className="field-label-row">
                      <span className="field-label">Location filter</span>
                    </div>
                    <select
                      className="field-input"
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                    >
                      <option value="all">All locations</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <div className="field-label-row">
                      <span className="field-label">Source filter</span>
                    </div>
                    <select
                      className="field-input"
                      value={providerFilter}
                      onChange={(e) =>
                        setProviderFilter(
                          e.target.value as
                            | 'all'
                            | 'open-meteo'
                            | 'weatherapi'
                            | 'meteosource'
                            | 'visualcrossing',
                        )
                      }
                    >
                      <option value="all">All sources</option>
                      <option value="open-meteo">Open-Meteo</option>
                      <option value="weatherapi">OpenWeather</option>
                      <option value="meteosource">Meteosource</option>
                      <option value="visualcrossing">Visual Crossing</option>
                    </select>
                  </div>
                </div>
                {viewMode === 'list' ? (
                  <div className="windows-by-timeframe">
                    {timeFrameGroups.map((group) => (
                      <div key={group.timeFrameKey} className="timeframe-block">
                        <div className="timeframe-header-row">
                          <h3 className="timeframe-title">{group.timeFrameLabel}</h3>
                          {group.bestCategory && (
                            <div className="timeline timeframe-day-timeline">
                              <div
                                className={`timeline-segment ${timelineClass(group.bestCategory)}`}
                                style={{ width: '100%' }}
                              />
                            </div>
                          )}
                        </div>
                        {group.locationGroups.map(({ locationId, windows: locationWindows }) => {
                          const location = locations.find((loc) => loc.id === locationId)
                          return (
                            <div key={locationId} className="timeframe-location">
                              <div className="timeframe-location-name">
                                {location?.name ?? 'Unknown location'}
                              </div>
                              <div className="comparison-table-wrap">
                                <table className="comparison-table">
                                  <thead>
                                    <tr>
                                      <th>Source</th>
                                      <th>Time</th>
                                      <th>Wind (km/h)</th>
                                      <th>Gusts</th>
                                      <th>Temp (°C)</th>
                                      <th>Precip</th>
                                      <th>Score</th>
                                      <th>Rating</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {locationWindows.map((w) => {
                                      const summary = summarizeWindowForDisplay(w)
                                      return (
                                        <tr key={w.id}>
                                          <td>{providerLabel(w.providerId)}</td>
                                          <td className="comparison-time">
                                            {formatWindowSummary(w.startTime, w.endTime)}
                                          </td>
                                          <td>
                                            {summary.minWindKmh}–{summary.maxWindKmh}
                                          </td>
                                          <td>
                                            {summary.hasGusts
                                              ? `up to ${summary.maxGustKmh}`
                                              : '—'}
                                          </td>
                                          <td>
                                            {summary.minTempC}–{summary.maxTempC}
                                          </td>
                                          <td>
                                            {summary.hasPrecip
                                              ? `${summary.minPrecipPct}–${summary.maxPrecipPct}%`
                                              : '—'}
                                          </td>
                                          <td>{Math.round(w.averageScore)}</td>
                                          <td>
                                            <span className={categoryClass(w.category)}>
                                              {w.category === FlightRatingCategory.GOOD
                                                ? 'Good'
                                                : w.category === FlightRatingCategory.MARGINAL
                                                  ? 'Marginal'
                                                  : 'No-go'}
                                            </span>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                ) : viewMode === 'calendar' ? (
                  <div className="calendar-view">
                    <div className="calendar-score-chart">
                      <div className="calendar-chart-title">Score by day & source</div>
                      <div className="calendar-chart-rows">
                        {timeFrameGroups.map((group) => {
                          const dayWindows = group.locationGroups.flatMap((g) => g.windows)
                          const byProvider = getDayScoresByProvider(dayWindows)
                          return (
                            <div key={group.timeFrameKey} className="calendar-chart-row">
                              <div className="calendar-chart-day">{group.timeFrameLabel}</div>
                              <div className="calendar-chart-bars">
                                {byProvider.map(({ providerId, score, category }) => (
                                  <div
                                    key={providerId}
                                    className="calendar-chart-bar-wrap"
                                    title={`${providerLabel(providerId)}: ${Math.round(score)}`}
                                  >
                                    <div
                                      className={`calendar-chart-bar ${timelineClass(category)}`}
                                      style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                                    />
                                    <span className="calendar-chart-bar-label">{Math.round(score)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div className="calendar-chart-legend">
                        {PROVIDER_ORDER.map((id) => (
                          <span key={id} className="calendar-legend-item">
                            {providerLabel(id)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="calendar-hourly-section">
                      <div className="calendar-chart-title">By hour (6:00–21:00)</div>
                      <div className="calendar-hourly-columns">
                        {timeFrameGroups.map((group) => {
                          const dayWindows = group.locationGroups.flatMap((g) => g.windows)
                          const hourly = getHourlyByProvider(dayWindows, group.timeFrameKey)
                          return (
                            <div key={group.timeFrameKey} className="calendar-hourly-day">
                              <div className="calendar-hourly-day-title">{group.timeFrameLabel}</div>
                              <div className="calendar-hourly-grid">
                                <div className="calendar-hourly-row calendar-hourly-header">
                                  <div className="calendar-hourly-cell calendar-hourly-hour">Hour</div>
                                  {PROVIDER_ORDER.map((id) => (
                                    <div key={id} className="calendar-hourly-cell calendar-hourly-provider">
                                      {providerLabel(id)}
                                    </div>
                                  ))}
                                </div>
                                {hourly.map(({ hour, providers }) => (
                                  <div key={hour} className="calendar-hourly-row">
                                    <div className="calendar-hourly-cell calendar-hourly-hour">
                                      {hour}
                                    </div>
                                    {PROVIDER_ORDER.map((providerId) => {
                                      const p = providers.find((x) => x.providerId === providerId)
                                      if (!p) {
                                        return (
                                          <div key={providerId} className="calendar-hourly-cell">—</div>
                                        )
                                      }
                                      return (
                                        <div
                                          key={providerId}
                                          className={`calendar-hourly-cell calendar-hourly-score ${timelineClass(p.category)}`}
                                          title={`${providerLabel(providerId)}: ${Math.round(p.score)}`}
                                        >
                                          <div
                                            className="calendar-hourly-bar"
                                            style={{ width: `${Math.max(0, Math.min(100, p.score))}%` }}
                                          />
                                          <span className="calendar-hourly-num">{Math.round(p.score)}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="recommendation-view">
                    {recommendationWindows.length === 0 ? (
                      <p className="muted">
                        No clear consensus windows found yet. Try widening your limits or checking
                        closer to the flying day.
                      </p>
                    ) : (
                      <div className="windows-by-timeframe">
                        {groupRecommendationsByDay(recommendationWindows).map((group) => (
                          <div key={group.dateKey} className="timeframe-block">
                            <h3 className="timeframe-title">{group.label}</h3>
                            <div className="list">
                              {group.items.map((rec) => {
                                const location = locations.find((loc) => loc.id === rec.locationId)
                                return (
                                  <div key={rec.id} className="list-row">
                                    <div className="list-main">
                                      <div className="list-title">
                                        {location?.name ?? 'Unknown location'}
                                      </div>
                                      <div className="list-subtitle">
                                        {formatTimeRange(rec.startTime, rec.endTime)} · Combined score{' '}
                                        {Math.round(rec.averageScore)} ·{' '}
                                        <span className={categoryClass(rec.category)}>
                                          {rec.category === FlightRatingCategory.GOOD
                                            ? 'Good'
                                            : rec.category === FlightRatingCategory.MARGINAL
                                              ? 'Marginal'
                                              : 'No-go'}
                                        </span>{' '}
                                        · Across {rec.providerCount} source
                                        {rec.providerCount === 1 ? '' : 's'}
                                      </div>
                                      <div className="chip-row">
                                        <span className="chip">
                                          Wind {rec.minWindKmh}–{rec.maxWindKmh} km/h
                                        </span>
                                        {rec.hasGusts && (
                                          <span className="chip">
                                            Gusts up to {rec.maxGustKmh} km/h
                                          </span>
                                        )}
                                        <span className="chip">
                                          Temp {rec.minTempC}–{rec.maxTempC}°C
                                        </span>
                                        {rec.hasPrecip && (
                                          <span className="chip">
                                            Precip {rec.minPrecipPct}–{rec.maxPrecipPct}%
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

interface TimeFrameGroup {
  timeFrameKey: string
  timeFrameLabel: string
  bestCategory: FlightRatingCategory | null
  locationGroups: Array<{ locationId: string; windows: FlightWindow[] }>
}

interface RecommendationWindow {
  id: string
  locationId: string
  startTime: string
  endTime: string
  category: FlightRatingCategory
  averageScore: number
  providerCount: number
  minWindKmh: number
  maxWindKmh: number
  hasGusts: boolean
  maxGustKmh: number
  minTempC: number
  maxTempC: number
  hasPrecip: boolean
  minPrecipPct: number
  maxPrecipPct: number
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PROVIDER_ORDER: FlightWindow['providerId'][] = [
  'open-meteo',
  'weatherapi',
  'meteosource',
  'visualcrossing',
]

interface HourlyProviderScore {
  providerId: FlightWindow['providerId']
  score: number
  category: FlightRatingCategory
}

/** Best score per provider for a given day (from window averages). */
function getDayScoresByProvider(windows: FlightWindow[]): HourlyProviderScore[] {
  const byProvider = new Map<FlightWindow['providerId'], { score: number; category: FlightRatingCategory }>()
  for (const w of windows) {
    const current = byProvider.get(w.providerId)
    if (!current || w.averageScore > current.score) {
      byProvider.set(w.providerId, { score: w.averageScore, category: w.category })
    }
  }
  return PROVIDER_ORDER.filter((id) => byProvider.has(id)).map((providerId) => {
    const { score, category } = byProvider.get(providerId)!
    return { providerId, score, category }
  })
}

/** Per-hour best score per provider for a day, from slice evaluations. Hours 6–21. */
function getHourlyByProvider(windows: FlightWindow[], dateKey: string): Array<{ hour: number; providers: HourlyProviderScore[] }> {
  const sliceEvals = windows.flatMap((w) => w.slices)
  const byHour = new Map<number, Map<FlightWindow['providerId'], { score: number; category: FlightRatingCategory }>>()
  for (const ev of sliceEvals) {
    const d = new Date(ev.slice.time)
    if (toLocalDateKey(d) !== dateKey) continue
    const hour = d.getHours()
    if (hour < 6 || hour > 21) continue
    let hourMap = byHour.get(hour)
    if (!hourMap) {
      hourMap = new Map()
      byHour.set(hour, hourMap)
    }
    const cur = hourMap.get(ev.providerId)
    if (!cur || ev.score > cur.score) {
      hourMap.set(ev.providerId, { score: ev.score, category: ev.category })
    }
  }
  const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
  return hours.map((hour) => {
    const hourMap = byHour.get(hour)
    const providers: HourlyProviderScore[] = hourMap
      ? PROVIDER_ORDER.filter((id) => hourMap.has(id)).map((providerId) => {
          const { score, category } = hourMap.get(providerId)!
          return { providerId, score, category }
        })
      : []
    return { hour, providers }
  })
}

function groupWindowsByTimeFrame(windows: FlightWindow[]): TimeFrameGroup[] {
  const today = new Date()
  const todayKey = toLocalDateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = toLocalDateKey(tomorrow)

  const byDate = new Map<string, FlightWindow[]>()
  for (const w of windows) {
    const start = new Date(w.startTime)
    const dateKey = toLocalDateKey(start)
    const list = byDate.get(dateKey) ?? []
    list.push(w)
    byDate.set(dateKey, list)
  }

  const dateKeys = [...byDate.keys()].sort()
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return dateKeys.map((dateKey) => {
    let timeFrameLabel: string
    if (dateKey === todayKey) {
      timeFrameLabel = 'Today'
    } else if (dateKey === tomorrowKey) {
      timeFrameLabel = 'Tomorrow'
    } else {
      const dayStart = new Date(dateKey + 'T12:00:00')
      timeFrameLabel = dateFormatter.format(dayStart)
    }

    const dayWindows = byDate.get(dateKey) ?? []
    const byLocation = new Map<string, FlightWindow[]>()
    for (const w of dayWindows) {
      const list = byLocation.get(w.locationId) ?? []
      list.push(w)
      byLocation.set(w.locationId, list)
    }
    const locationGroups = [...byLocation.entries()].map(([locationId, windows]) => ({
      locationId,
      windows,
    }))

    let bestCategory: FlightRatingCategory | null = null
    if (dayWindows.length > 0) {
      const bestWindow = [...dayWindows].sort(
        (a, b) => b.averageScore - a.averageScore,
      )[0]
      bestCategory = bestWindow.category
    }

    return {
      timeFrameKey: dateKey,
      timeFrameLabel,
      bestCategory,
      locationGroups,
    }
  })
}

/** Merge overlapping/provider-specific windows into simplified consensus recommendations. */
function buildRecommendations(windows: FlightWindow[]): RecommendationWindow[] {
  if (windows.length === 0) return []

  // Group by location + day + coarse start hour bucket.
  const groups = new Map<string, FlightWindow[]>()
  for (const w of windows) {
    const start = new Date(w.startTime)
    const dateKey = toLocalDateKey(start)
    const hourBucket = Math.floor(start.getHours() / 3) * 3 // 0–2,3–5,...,21–23
    const key = `${w.locationId}-${dateKey}-${hourBucket}`
    const list = groups.get(key) ?? []
    list.push(w)
    groups.set(key, list)
  }

  const recs: RecommendationWindow[] = []

  for (const [, group] of groups) {
    if (group.length === 0) continue

    const locationId = group[0].locationId
    const providerIds = new Set(group.map((w) => w.providerId))

    const minStart = group.reduce(
      (min, w) => (new Date(w.startTime) < new Date(min) ? w.startTime : min),
      group[0].startTime,
    )
    const maxEnd = group.reduce(
      (max, w) => (new Date(w.endTime) > new Date(max) ? w.endTime : max),
      group[0].endTime,
    )

    // Clamp each recommendation to a concise 2–3 hour block for easier scanning.
    const minStartMs = new Date(minStart).getTime()
    const maxEndMs = new Date(maxEnd).getTime()
    const threeHoursMs = 3 * 60 * 60 * 1000
    const twoHoursMs = 2 * 60 * 60 * 1000

    // Require that the underlying consensus window span is at least 2 hours.
    if (maxEndMs - minStartMs < twoHoursMs) {
      continue
    }

    // Clamp display window to at most 3 hours from the earliest start.
    const endMs = Math.min(maxEndMs, minStartMs + threeHoursMs)

    const startTime = new Date(minStartMs).toISOString()
    const endTime = new Date(endMs).toISOString()

    const allSlices = group.flatMap((w) => w.slices)

    if (allSlices.length === 0) continue

    const windsKts = allSlices.map((s) => s.slice.windSpeedKts)
    const gustsKts = allSlices
      .map((s) => s.slice.gustSpeedKts)
      .filter((g): g is number => g != null)
    const tempsC = allSlices.map((s) => s.slice.temperatureC)
    const precips = allSlices
      .map((s) => s.slice.precipProbabilityPct)
      .filter((p): p is number => p != null)

    const minWindKmh = Math.round(Math.min(...windsKts) * KTS_TO_KMH)
    const maxWindKmh = Math.round(Math.max(...windsKts) * KTS_TO_KMH)

    const hasGusts = gustsKts.length > 0
    const maxGustKmh = hasGusts ? Math.round(Math.max(...gustsKts) * KTS_TO_KMH) : 0

    const minTempC = Math.round(Math.min(...tempsC))
    const maxTempC = Math.round(Math.max(...tempsC))

    const hasPrecip = precips.length > 0
    const minPrecipPct = hasPrecip ? Math.round(Math.min(...precips)) : 0
    const maxPrecipPct = hasPrecip ? Math.round(Math.max(...precips)) : 0

    // Overall category: prefer GOOD over MARGINAL over NO_GO.
    let category: FlightRatingCategory = FlightRatingCategory.NO_GO
    if (group.some((w) => w.category === FlightRatingCategory.GOOD)) {
      category = FlightRatingCategory.GOOD
    } else if (group.some((w) => w.category === FlightRatingCategory.MARGINAL)) {
      category = FlightRatingCategory.MARGINAL
    }

    const averageScore =
      group.reduce((sum, w) => sum + w.averageScore, 0) / group.length || 0

    recs.push({
      id: `${locationId}-${startTime}-${endTime}-${providerIds.size}`,
      locationId,
      startTime,
      endTime,
      category,
      averageScore,
      providerCount: providerIds.size,
      minWindKmh,
      maxWindKmh,
      hasGusts,
      maxGustKmh,
      minTempC,
      maxTempC,
      hasPrecip,
      minPrecipPct,
      maxPrecipPct,
    })
  }

  // Sort: best category first (GOOD > MARGINAL > NO_GO), then score desc, then time.
  const categoryRank = (c: FlightRatingCategory) =>
    c === FlightRatingCategory.GOOD ? 0 : c === FlightRatingCategory.MARGINAL ? 1 : 2

  return recs
    .sort((a, b) => {
      const ta = new Date(a.startTime).getTime()
      const tb = new Date(b.startTime).getTime()
      if (ta !== tb) return ta - tb

      const ca = categoryRank(a.category)
      const cb = categoryRank(b.category)
      if (ca !== cb) return ca - cb

      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore
      return 0
    })
    .slice(0, 8)
}

function groupRecommendationsByDay(recs: RecommendationWindow[]): Array<{
  dateKey: string
  label: string
  items: RecommendationWindow[]
}> {
  const today = new Date()
  const todayKey = toLocalDateKey(today)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = toLocalDateKey(tomorrow)

  const byDate = new Map<string, RecommendationWindow[]>()
  for (const r of recs) {
    const dateKey = toLocalDateKey(new Date(r.startTime))
    const list = byDate.get(dateKey) ?? []
    list.push(r)
    byDate.set(dateKey, list)
  }

  const dateKeys = [...byDate.keys()].sort()
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return dateKeys.map((dateKey) => {
    let label: string
    if (dateKey === todayKey) {
      label = 'Today'
    } else if (dateKey === tomorrowKey) {
      label = 'Tomorrow'
    } else {
      const dayStart = new Date(dateKey + 'T12:00:00')
      label = dateFormatter.format(dayStart)
    }
    const items = byDate.get(dateKey) ?? []
    return { dateKey, label, items }
  })
}

function formatTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return `${timeFormatter.format(start)}–${timeFormatter.format(end)}`
}

function formatWindowSummary(startIso: string, endIso: string) {
  const start = new Date(startIso)
  const end = new Date(endIso)

  const sameDay = start.toDateString() === end.toDateString()
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  if (sameDay) {
    return `${dateFormatter.format(start)} · ${timeFormatter.format(start)}–${timeFormatter.format(end)}`
  }

  return `${dateFormatter.format(start)} ${timeFormatter.format(start)} → ${dateFormatter.format(end)} ${timeFormatter.format(end)}`
}

function timelineClass(category: FlightRatingCategory) {
  if (category === FlightRatingCategory.GOOD) return 'good'
  if (category === FlightRatingCategory.MARGINAL) return 'marginal'
  return 'nogo'
}

function categoryClass(category: FlightRatingCategory) {
  if (category === FlightRatingCategory.GOOD) return 'pill good'
  if (category === FlightRatingCategory.MARGINAL) return 'pill marginal'
  return 'pill nogo'
}

function providerLabel(providerId: FlightWindow['providerId']) {
  if (providerId === 'weatherapi') return 'OpenWeather'
  if (providerId === 'meteosource') return 'Meteosource'
  if (providerId === 'visualcrossing') return 'Visual Crossing'
  return 'Open-Meteo'
}

function summarizeWindowForDisplay(window: FlightWindow) {
  const winds = window.slices.map((s) => s.slice.windSpeedKts)
  const gusts = window.slices
    .map((s) => s.slice.gustSpeedKts)
    .filter((g): g is number => g != null)
  const temps = window.slices.map((s) => s.slice.temperatureC)
  const precips = window.slices
    .map((s) => s.slice.precipProbabilityPct)
    .filter((p): p is number => p != null)

  const minWindKts = Math.min(...winds)
  const maxWindKts = Math.max(...winds)
  const minWindKmh = Math.round(minWindKts * KTS_TO_KMH)
  const maxWindKmh = Math.round(maxWindKts * KTS_TO_KMH)

  const hasGusts = gusts.length > 0
  const maxGustKts = hasGusts ? Math.max(...gusts) : 0
  const maxGustKmh = hasGusts ? Math.round(maxGustKts * KTS_TO_KMH) : 0
  const maxGustDeltaKmh =
    hasGusts && winds.length > 0
      ? Math.round((maxGustKts - minWindKts) * KTS_TO_KMH)
      : 0

  const minTempC = Math.round(Math.min(...temps))
  const maxTempC = Math.round(Math.max(...temps))

  const hasPrecip = precips.length > 0
  const minPrecipPct = hasPrecip ? Math.round(Math.min(...precips)) : 0
  const maxPrecipPct = hasPrecip ? Math.round(Math.max(...precips)) : 0

  return {
    minWindKmh,
    maxWindKmh,
    hasGusts,
    maxGustKmh,
    maxGustDeltaKmh,
    minTempC,
    maxTempC,
    hasPrecip,
    minPrecipPct,
    maxPrecipPct,
  }
}


