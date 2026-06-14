import { describe, expect, it } from 'vitest'
import {
  FlightRatingCategory,
  type ForecastSlice,
  type UserSettings,
  defaultUserSettings,
} from './types'
import { evaluateSlice, groupSlicesIntoWindows, selectNextBestWindow } from './rules'

const baseSettings: UserSettings = {
  ...defaultUserSettings,
  maxWindKts: 10,
  maxGustKts: 15,
  maxGustDeltaKts: 5,
  minTempC: 5,
  maxTempC: 30,
  allowPrecipitation: false,
  maxPrecipProbabilityPct: 20,
  minWindowDurationHours: 1,
  horizonHours: 72,
  preferMorningAndEvening: false,
}

const baseSlice: ForecastSlice = {
  time: new Date().toISOString(),
  windSpeedKts: 8,
  gustSpeedKts: 12,
  temperatureC: 18,
  precipProbabilityPct: 0,
}

describe('evaluateSlice', () => {
  it('marks slice as NO_GO when wind exceeds maxWind', () => {
    const slice = { ...baseSlice, windSpeedKts: baseSettings.maxWindKts + 1 }
    const result = evaluateSlice('loc', slice, baseSettings, 'open-meteo')
    expect(result.category).toBe(FlightRatingCategory.NO_GO)
  })

  it('marks slice as NO_GO when gusts exceed maxGust', () => {
    const slice = { ...baseSlice, gustSpeedKts: baseSettings.maxGustKts + 1 }
    const result = evaluateSlice('loc', slice, baseSettings, 'open-meteo')
    expect(result.category).toBe(FlightRatingCategory.NO_GO)
  })

  it('marks slice as NO_GO when gust spread exceeds maxGustDelta', () => {
    const slice = {
      ...baseSlice,
      windSpeedKts: 5,
      gustSpeedKts: 12,
    }
    const result = evaluateSlice('loc', slice, baseSettings, 'open-meteo')
    expect(result.category).toBe(FlightRatingCategory.NO_GO)
  })

  it('marks slice as NO_GO when temperature is outside range', () => {
    const coldSlice = { ...baseSlice, temperatureC: baseSettings.minTempC - 1 }
    const hotSlice = { ...baseSlice, temperatureC: baseSettings.maxTempC + 1 }
    expect(evaluateSlice('loc', coldSlice, baseSettings, 'open-meteo').category).toBe(
      FlightRatingCategory.NO_GO,
    )
    expect(evaluateSlice('loc', hotSlice, baseSettings, 'open-meteo').category).toBe(
      FlightRatingCategory.NO_GO,
    )
  })

  it('penalizes slices that are close to limits but keeps them GOOD or MARGINAL', () => {
    const windy = { ...baseSlice, windSpeedKts: 9.5 }
    const result = evaluateSlice('loc', windy, baseSettings, 'open-meteo')
    expect(result.category === FlightRatingCategory.GOOD || result.category === FlightRatingCategory.MARGINAL).toBe(
      true,
    )
    expect(result.score).toBeGreaterThan(0)
  })
})

describe('groupSlicesIntoWindows', () => {
  it('groups contiguous acceptable slices into a single window', () => {
    const now = Date.now()
    const hourMs = 60 * 60 * 1000

    const slices: ForecastSlice[] = [
      { ...baseSlice, time: new Date(now).toISOString() },
      { ...baseSlice, time: new Date(now + hourMs).toISOString() },
      { ...baseSlice, time: new Date(now + 2 * hourMs).toISOString() },
    ]

    const evaluations = slices.map((s) =>
      evaluateSlice('loc', s, baseSettings, 'open-meteo'),
    )
    const windows = groupSlicesIntoWindows(evaluations, baseSettings)

    expect(windows).toHaveLength(1)
    const [window] = windows
    expect(window.slices).toHaveLength(3)
    expect(window.category === FlightRatingCategory.GOOD || window.category === FlightRatingCategory.MARGINAL).toBe(
      true,
    )
  })

  it('drops short windows under the minimum duration', () => {
    const settings: UserSettings = { ...baseSettings, minWindowDurationHours: 4 }
    const now = Date.now()
    const hourMs = 60 * 60 * 1000

    const slices: ForecastSlice[] = [
      { ...baseSlice, time: new Date(now).toISOString() },
      { ...baseSlice, time: new Date(now + hourMs).toISOString() },
    ]

    const evaluations = slices.map((s) =>
      evaluateSlice('loc', s, settings, 'open-meteo'),
    )
    const windows = groupSlicesIntoWindows(evaluations, settings)
    expect(windows).toHaveLength(0)
  })
})

describe('selectNextBestWindow', () => {
  it('returns the earliest window with highest score when there are multiple', () => {
    const now = new Date()
    const hourMs = 60 * 60 * 1000

    const windowA = {
      id: 'a',
      locationId: 'loc1',
      providerId: 'open-meteo',
      startTime: new Date(now.getTime() + hourMs).toISOString(),
      endTime: new Date(now.getTime() + 2 * hourMs).toISOString(),
      category: FlightRatingCategory.GOOD,
      averageScore: 80,
      slices: [],
    }

    const windowB = {
      id: 'b',
      locationId: 'loc2',
      providerId: 'open-meteo',
      startTime: new Date(now.getTime() + 2 * hourMs).toISOString(),
      endTime: new Date(now.getTime() + 3 * hourMs).toISOString(),
      category: FlightRatingCategory.GOOD,
      averageScore: 90,
      slices: [],
    }

    const { best, alternatives } = selectNextBestWindow([windowB, windowA], now)
    expect(best?.id).toBe('a')
    expect(alternatives.map((w) => w.id)).toEqual(['b'])
  })
})

