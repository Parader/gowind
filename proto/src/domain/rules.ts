import { FlightRatingCategory } from './types'
import type {
  FlightWindow,
  ForecastSlice,
  LocationId,
  SliceEvaluation,
  UserSettings,
  WeatherProviderId,
} from './types'

/**
 * Evaluate a single forecast slice against the user's settings.
 * Returns a categorical rating plus a numeric score for ranking.
 */
export function evaluateSlice(
  locationId: LocationId,
  slice: ForecastSlice,
  settings: UserSettings,
  providerId: WeatherProviderId,
): SliceEvaluation {
  const reasons: string[] = []

  // Start from a perfect score and subtract penalties.
  let score = 100
  let category: FlightRatingCategory = FlightRatingCategory.GOOD

  const hourLocal = new Date(slice.time).getHours()

  // --- Hard time-of-day filter (optional) ---
  if (settings.restrictToTimeOfDay) {
    const inMorning =
      hourLocal >= settings.morningStartHour && hourLocal < settings.morningEndHour
    const inEvening =
      hourLocal >= settings.eveningStartHour && hourLocal < settings.eveningEndHour

    if (!inMorning && !inEvening) {
      reasons.push('Outside your allowed flying hours')
      return {
        locationId,
        providerId,
        slice,
        category: FlightRatingCategory.NO_GO,
        score: 0,
        reasons,
      }
    }
  }

  // --- Hard filters (NO_GO) ---
  const { maxWindKts, maxGustKts, maxGustDeltaKts, minTempC, maxTempC } = settings

  if (slice.windSpeedKts > maxWindKts) {
    reasons.push(`Wind ${slice.windSpeedKts.toFixed(0)} kt > max ${maxWindKts} kt`)
    category = FlightRatingCategory.NO_GO
  }

  if (slice.gustSpeedKts != null) {
    if (slice.gustSpeedKts > maxGustKts) {
      reasons.push(`Gusts ${slice.gustSpeedKts.toFixed(0)} kt > max ${maxGustKts} kt`)
      category = FlightRatingCategory.NO_GO
    }

    const gustDelta = slice.gustSpeedKts - slice.windSpeedKts
    if (gustDelta > maxGustDeltaKts) {
      reasons.push(`Gust spread ${gustDelta.toFixed(0)} kt > max ${maxGustDeltaKts} kt`)
      category = FlightRatingCategory.NO_GO
    }
  }

  if (slice.temperatureC < minTempC) {
    reasons.push(`Temperature ${slice.temperatureC.toFixed(0)}°C < min ${minTempC}°C`)
    category = FlightRatingCategory.NO_GO
  } else if (slice.temperatureC > maxTempC) {
    reasons.push(`Temperature ${slice.temperatureC.toFixed(0)}°C > max ${maxTempC}°C`)
    category = FlightRatingCategory.NO_GO
  }

  if (!settings.allowPrecipitation && slice.precipProbabilityPct != null) {
    if (slice.precipProbabilityPct > settings.maxPrecipProbabilityPct) {
      reasons.push(
        `Precipitation chance ${slice.precipProbabilityPct.toFixed(0)}% > max ${settings.maxPrecipProbabilityPct}%`,
      )
      category = FlightRatingCategory.NO_GO
    }
  }

  if (category === FlightRatingCategory.NO_GO) {
    return {
      locationId,
      providerId,
      slice,
      category,
      score: 0,
      reasons,
    }
  }

  // --- Soft scoring within acceptable bounds ---

  // Wind closer to the limit reduces score.
  const windRatio = slice.windSpeedKts / maxWindKts
  if (windRatio > 0.7) {
    const penalty = (windRatio - 0.7) * 80 // up to ~24 points
    score -= penalty
    reasons.push(`Wind is on the higher side (${slice.windSpeedKts.toFixed(0)} kt)`)
  } else if (slice.windSpeedKts <= 4) {
    // Gentle bonus for very light winds.
    score += 5
    reasons.push(`Nice light winds (${slice.windSpeedKts.toFixed(0)} kt)`)
  }

  // Gust spread penalties, if gusts data exists.
  if (slice.gustSpeedKts != null) {
    const gustDelta = slice.gustSpeedKts - slice.windSpeedKts
    const deltaRatio = gustDelta / settings.maxGustDeltaKts
    if (deltaRatio > 0.6) {
      const penalty = (deltaRatio - 0.6) * 60 // up to ~24 points
      score -= penalty
      reasons.push(`Gusts are noticeably higher than steady wind`)
    }
  }

  // Temperature comfort band. Prefer mid-range between min and max.
  const tempMid = (minTempC + maxTempC) / 2
  const tempDiff = Math.abs(slice.temperatureC - tempMid)
  if (tempDiff > 8) {
    score -= 10
    reasons.push(`Temperature is a bit away from your comfort band`)
  } else if (tempDiff <= 4) {
    score += 5
    reasons.push(`Comfortable temperature near your preferred range`)
  }

  // Time-of-day preference (optional).
  if (settings.preferMorningAndEvening) {
    const isMorning = hourLocal >= 6 && hourLocal <= 10
    const isEvening = hourLocal >= 17 && hourLocal <= 21
    const isMidday = hourLocal >= 12 && hourLocal <= 16

    if (isMorning || isEvening) {
      score += 8
      reasons.push(`Preferred time of day (morning/evening)`)
    } else if (isMidday) {
      score -= 8
      reasons.push(`Midday conditions may be more thermic`)
    }
  }

  // Clamp score into 0-100.
  score = Math.max(0, Math.min(100, score))

  // Derive final category from score.
  if (score >= 75) {
    category = FlightRatingCategory.GOOD
  } else if (score >= 45) {
    category = FlightRatingCategory.MARGINAL
  } else {
    category = FlightRatingCategory.NO_GO
  }

  return {
    locationId,
    providerId,
    slice,
    category,
    score,
    reasons,
  }
}

/**
 * Group sequential, acceptable slices into continuous windows for a
 * single location.
 *
 * Assumes all evaluations belong to the same location.
 */
export function groupSlicesIntoWindows(
  evaluations: SliceEvaluation[],
  settings: UserSettings,
  minimumCategory: FlightRatingCategory = FlightRatingCategory.MARGINAL,
): FlightWindow[] {
  if (evaluations.length === 0) return []

  const sorted = [...evaluations].sort(
    (a, b) => new Date(a.slice.time).getTime() - new Date(b.slice.time).getTime(),
  )

  const windows: FlightWindow[] = []

  let current: SliceEvaluation[] = []

  const isAcceptable = (cat: FlightRatingCategory) => {
    if (minimumCategory === FlightRatingCategory.GOOD) {
      return cat === FlightRatingCategory.GOOD
    }
    if (minimumCategory === FlightRatingCategory.MARGINAL) {
      return cat === FlightRatingCategory.GOOD || cat === FlightRatingCategory.MARGINAL
    }
    return cat !== FlightRatingCategory.NO_GO
  }

  const flushWindow = () => {
    if (current.length === 0) return

    const start = current[0].slice.time
    const end = current[current.length - 1].slice.time
    const totalScore = current.reduce((acc, ev) => acc + ev.score, 0)
    const avgScore = totalScore / current.length

    // Window category: if any slice is MARGINAL then MARGINAL, otherwise GOOD.
    let windowCategory: FlightRatingCategory = FlightRatingCategory.GOOD
    if (current.some((ev) => ev.category === FlightRatingCategory.MARGINAL)) {
      windowCategory = FlightRatingCategory.MARGINAL
    }

    const durationHours =
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60) + 1

    if (durationHours >= settings.minWindowDurationHours) {
      const locationId = current[0].locationId
      const providerId = current[0].providerId
      windows.push({
        id: `${locationId}-${start}`,
        locationId,
        providerId,
        startTime: start,
        endTime: end,
        category: windowCategory,
        averageScore: avgScore,
        slices: [...current],
      })
    }

    current = []
  }

  const MAX_GAP_MINUTES = 90

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]

    if (!isAcceptable(ev.category)) {
      // Break any existing window if current slice is not acceptable.
      flushWindow()
      continue
    }

    if (current.length === 0) {
      current.push(ev)
      continue
    }

    const prev = current[current.length - 1]
    const diffMinutes =
      (new Date(ev.slice.time).getTime() - new Date(prev.slice.time).getTime()) /
      (1000 * 60)

    if (diffMinutes <= MAX_GAP_MINUTES) {
      current.push(ev)
    } else {
      flushWindow()
      current.push(ev)
    }
  }

  flushWindow()

  return windows
}

/**
 * Given a list of windows across locations, return the \"next best\" one
 * after the provided time, plus a sorted list of alternatives.
 */
export function selectNextBestWindow(
  windows: FlightWindow[],
  now: Date,
): { best: FlightWindow | null; alternatives: FlightWindow[] } {
  if (windows.length === 0) {
    return { best: null, alternatives: [] }
  }

  const nowMs = now.getTime()

  const futureWindows = windows.filter((w) => new Date(w.startTime).getTime() >= nowMs)

  if (futureWindows.length === 0) {
    return { best: null, alternatives: [] }
  }

  const sorted = [...futureWindows].sort((a, b) => {
    const aStart = new Date(a.startTime).getTime()
    const bStart = new Date(b.startTime).getTime()

    if (aStart !== bStart) {
      return aStart - bStart // earliest first
    }

    // If same start time, prefer higher average score.
    return b.averageScore - a.averageScore
  })

  const [best, ...alternatives] = sorted
  return { best, alternatives }
}

