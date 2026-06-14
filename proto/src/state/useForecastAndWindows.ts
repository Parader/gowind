import { useEffect, useMemo, useState } from 'react'
import type { FlightWindow, Location, WeatherProviderId } from '../domain/types'
import { FlightRatingCategory } from '../domain/types'
import { getHourlyForecast } from '../api/weatherClient'
import { evaluateSlice, groupSlicesIntoWindows, selectNextBestWindow } from '../domain/rules'
import type { UserSettings } from '../domain/types'

interface UseForecastAndWindowsArgs {
  locations: Location[]
  settings: UserSettings
}

export function useForecastAndWindows({ locations, settings }: UseForecastAndWindowsArgs) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [windows, setWindows] = useState<FlightWindow[]>([])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (locations.length === 0) {
        setWindows([])
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const allWindows: FlightWindow[] = []

        for (const loc of locations) {
          const providerIds: WeatherProviderId[] = []

          if (settings.useOpenMeteo) providerIds.push('open-meteo')
          if (settings.useWeatherApi) providerIds.push('weatherapi')
          if (settings.useMeteosource) providerIds.push('meteosource')
          if (settings.useVisualCrossing) providerIds.push('visualcrossing')

          // Fallback to Open-Meteo if user manages to disable all.
          if (providerIds.length === 0) {
            providerIds.push('open-meteo')
          }

          const providerPromises = providerIds.map(async (provider) => {
            if (provider === 'weatherapi' && !settings.weatherApiKey) {
              return null
            }
            if (provider === 'meteosource' && !settings.meteosourceApiKey) {
              return null
            }
            if (provider === 'visualcrossing' && !settings.visualCrossingApiKey) {
              return null
            }

            const slices = await getHourlyForecast(
              loc,
              settings.horizonHours,
              provider,
              settings.weatherApiKey,
              settings.meteosourceApiKey,
              settings.visualCrossingApiKey,
            )

            if (slices.length === 0) return null

            const evaluations = slices.map((slice) =>
              evaluateSlice(loc.id, slice, settings, provider),
            )

            const windowsForLocation = groupSlicesIntoWindows(
              evaluations,
              settings,
              FlightRatingCategory.MARGINAL,
            )

            return windowsForLocation
          })

          const results = await Promise.all(providerPromises)
          for (const windowsForProvider of results) {
            if (windowsForProvider && windowsForProvider.length > 0) {
              allWindows.push(...windowsForProvider)
            }
          }
        }

        if (!cancelled) {
          setWindows(allWindows)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unknown error')
          setWindows([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [locations, settings])

  const { best, alternatives } = useMemo(() => {
    const { best, alternatives } = selectNextBestWindow(windows, new Date())
    return { best, alternatives }
  }, [windows])

  return {
    loading,
    error,
    windows,
    nextBest: best,
    alternatives,
  }
}

