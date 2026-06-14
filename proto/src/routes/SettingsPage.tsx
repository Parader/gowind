import type { ChangeEvent, FC } from 'react'
import { useSettings } from '../state/useSettings'

const KTS_TO_KMH = 1.852
const ktsToKmh = (kts: number) => kts * KTS_TO_KMH
const kmhToKts = (kmh: number) => kmh / KTS_TO_KMH

export const SettingsPage: FC = () => {
  const { settings, setSettings } = useSettings()

  const onNumberChange =
    (key: keyof typeof settings) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value)
      if (Number.isNaN(value)) return
      setSettings({ ...settings, [key]: value })
    }

  const onBooleanChange =
    (key: keyof typeof settings) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setSettings({ ...settings, [key]: e.target.checked })
    }

  const onWindSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const kmh = Number(e.target.value)
    if (Number.isNaN(kmh)) return
    setSettings({ ...settings, maxWindKts: kmhToKts(kmh) })
  }

  const onGustSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const kmh = Number(e.target.value)
    if (Number.isNaN(kmh)) return
    setSettings({ ...settings, maxGustKts: kmhToKts(kmh) })
  }

  const onGustDeltaSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const kmh = Number(e.target.value)
    if (Number.isNaN(kmh)) return
    setSettings({ ...settings, maxGustDeltaKts: kmhToKts(kmh) })
  }

  const applyPreset = (preset: 'conservative' | 'normal' | 'aggressive') => {
    if (preset === 'conservative') {
      setSettings({
        ...settings,
        maxWindKts: kmhToKts(15),
        maxGustKts: kmhToKts(22),
        maxGustDeltaKts: kmhToKts(7),
        minTempC: -10,
        maxTempC: 26,
      })
    } else if (preset === 'normal') {
      setSettings({
        ...settings,
        maxWindKts: kmhToKts(20),
        maxGustKts: kmhToKts(28),
        maxGustDeltaKts: kmhToKts(9),
        minTempC: -15,
        maxTempC: 30,
      })
    } else {
      setSettings({
        ...settings,
        maxWindKts: kmhToKts(25),
        maxGustKts: kmhToKts(35),
        maxGustDeltaKts: kmhToKts(12),
        minTempC: -20,
        maxTempC: 32,
      })
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Set your personal limits for wind, gusts, temperature and horizon, and choose
          which data source to trust. Tempest will only recommend windows inside this
          envelope.
        </p>
      </header>

      <div className="page-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Data source</div>
          </div>
          <p className="muted">
            Tempest can use free Open-Meteo data (no key) or paid APIs like OpenWeather,
            Meteosource, or Visual Crossing if you have your own keys. Those may better
            match the apps you already use.
          </p>
          <div className="page-grid">
            <div className="field-group">
              <div className="field-row">
                <input
                  id="provider-openmeteo"
                  type="checkbox"
                  checked={settings.useOpenMeteo}
                  onChange={onBooleanChange('useOpenMeteo')}
                />
                <label className="field-label" htmlFor="provider-openmeteo">
                  Open-Meteo (no key required)
                </label>
              </div>
              <div className="field-row">
                <input
                  id="provider-weatherapi"
                  type="checkbox"
                  checked={settings.useWeatherApi}
                  onChange={onBooleanChange('useWeatherApi')}
                />
                <label className="field-label" htmlFor="provider-weatherapi">
                  OpenWeather (API key required)
                </label>
              </div>
              <div className="field-row">
                <input
                  id="provider-meteosource"
                  type="checkbox"
                  checked={settings.useMeteosource}
                  onChange={onBooleanChange('useMeteosource')}
                />
                <label className="field-label" htmlFor="provider-meteosource">
                  Meteosource (API key required)
                </label>
              </div>
              <div className="field-row">
                <input
                  id="provider-visualcrossing"
                  type="checkbox"
                  checked={settings.useVisualCrossing}
                  onChange={onBooleanChange('useVisualCrossing')}
                />
                <label className="field-label" htmlFor="provider-visualcrossing">
                  Visual Crossing (API key required)
                </label>
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="weather-api-key">
                  OpenWeather key
                </label>
                <span className="field-helper">
                  Stored only in this browser. Optional unless you select OpenWeather.
                </span>
              </div>
              <input
                id="openweather-api-key"
                className="field-input"
                type="password"
                placeholder="Paste your OpenWeather API key here"
                value={settings.weatherApiKey ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    weatherApiKey: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="meteosource-api-key">
                  Meteosource key
                </label>
                <span className="field-helper">
                  Stored only in this browser. Optional unless you select Meteosource.
                </span>
              </div>
              <input
                id="meteosource-api-key"
                className="field-input"
                type="password"
                placeholder="Paste your Meteosource key here"
                value={settings.meteosourceApiKey ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    meteosourceApiKey: e.target.value || null,
                  })
                }
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="visualcrossing-api-key">
                  Visual Crossing key
                </label>
                <span className="field-helper">
                  Stored only in this browser. Optional unless you select Visual Crossing.
                </span>
              </div>
              <input
                id="visualcrossing-api-key"
                className="field-input"
                type="password"
                placeholder="Paste your Visual Crossing key here"
                value={settings.visualCrossingApiKey ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    visualCrossingApiKey: e.target.value || null,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Presets</div>
          </div>
          <p className="muted">
            Start with a baseline that roughly matches your comfort level. You can fine
            tune the numbers below at any time.
          </p>
          <div className="page-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => applyPreset('conservative')}
            >
              Conservative
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => applyPreset('normal')}
            >
              Normal
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => applyPreset('aggressive')}
            >
              Aggressive
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Wind &amp; gusts</div>
          </div>

          <div className="page-grid">
            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="max-wind">
                  Max steady wind
                </label>
                <span className="field-helper">in km/h</span>
              </div>
              <div className="field-row">
                <input
                  id="max-wind"
                  type="range"
                  min={10}
                  max={40}
                  value={Math.round(ktsToKmh(settings.maxWindKts))}
                  className="field-slider"
                  onChange={onWindSliderChange}
                />
                <span className="field-value">
                  {Math.round(ktsToKmh(settings.maxWindKts))} km/h
                </span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="max-gust">
                  Max gusts
                </label>
                <span className="field-helper">in km/h</span>
              </div>
              <div className="field-row">
                <input
                  id="max-gust"
                  type="range"
                  min={15}
                  max={50}
                  value={Math.round(ktsToKmh(settings.maxGustKts))}
                  className="field-slider"
                  onChange={onGustSliderChange}
                />
                <span className="field-value">
                  {Math.round(ktsToKmh(settings.maxGustKts))} km/h
                </span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="gust-delta">
                  Max gust spread
                </label>
                <span className="field-helper">gust - steady, km/h</span>
              </div>
              <div className="field-row">
                <input
                  id="gust-delta"
                  type="range"
                  min={5}
                  max={25}
                  value={Math.round(ktsToKmh(settings.maxGustDeltaKts))}
                  className="field-slider"
                  onChange={onGustDeltaSliderChange}
                />
                <span className="field-value">
                  {Math.round(ktsToKmh(settings.maxGustDeltaKts))} km/h
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Temperature &amp; precipitation</div>
          </div>

          <div className="page-grid">
            <div className="field-group">
              <div className="field-label-row">
                <span className="field-label">Comfort range</span>
                <span className="field-helper">in °C</span>
              </div>
              <div className="field-row">
                <input
                  type="number"
                  className="field-input"
                  min={-30}
                  max={40}
                  value={settings.minTempC}
                  onChange={onNumberChange('minTempC')}
                />
                <span className="field-value">min</span>
              </div>
              <div className="field-row">
                <input
                  type="number"
                  className="field-input"
                  min={-30}
                  max={40}
                  value={settings.maxTempC}
                  onChange={onNumberChange('maxTempC')}
                />
                <span className="field-value">max</span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-row">
                <input
                  id="allow-precip"
                  type="checkbox"
                  checked={settings.allowPrecipitation}
                  onChange={onBooleanChange('allowPrecipitation')}
                />
                <label className="field-label" htmlFor="allow-precip">
                  Allow light precipitation
                </label>
              </div>
              {!settings.allowPrecipitation && (
                <div className="field-group">
                  <div className="field-label-row">
                    <label className="field-label" htmlFor="max-precip">
                      Max precipitation probability
                    </label>
                    <span className="field-helper">in %</span>
                  </div>
                  <div className="field-row">
                    <input
                      id="max-precip"
                      type="range"
                      min={0}
                      max={100}
                      value={settings.maxPrecipProbabilityPct}
                      className="field-slider"
                      onChange={onNumberChange('maxPrecipProbabilityPct')}
                    />
                    <span className="field-value">
                      {settings.maxPrecipProbabilityPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Search horizon</div>
          </div>

          <div className="page-grid">
            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="horizon-hours">
                  How far ahead to look
                </label>
                <span className="field-helper">in hours (up to 7 days)</span>
              </div>
              <div className="field-row">
                <input
                  id="horizon-hours"
                  type="range"
                  min={24}
                  max={168}
                  value={settings.horizonHours}
                  className="field-slider"
                  onChange={onNumberChange('horizonHours')}
                />
                <span className="field-value">{settings.horizonHours}h</span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="min-window">
                  Minimum window length
                </label>
                <span className="field-helper">in hours</span>
              </div>
              <div className="field-row">
                <input
                  id="min-window"
                  type="range"
                  min={1}
                  max={4}
                  value={settings.minWindowDurationHours}
                  className="field-slider"
                  onChange={onNumberChange('minWindowDurationHours')}
                />
                <span className="field-value">
                  {settings.minWindowDurationHours.toFixed(0)}h
                </span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-row">
                <input
                  id="prefer-morning"
                  type="checkbox"
                  checked={settings.preferMorningAndEvening}
                  onChange={onBooleanChange('preferMorningAndEvening')}
                />
                <label className="field-label" htmlFor="prefer-morning">
                  Prefer mornings and evenings over midday
                </label>
              </div>
              <p className="field-helper">
                This gives a small scoring bonus to early/late hours and a penalty to
                midday when conditions are more likely to be thermic.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Time of day</div>
          </div>

          <div className="page-grid">
            <div className="field-group">
              <div className="field-row">
                <input
                  id="restrict-hours"
                  type="checkbox"
                  checked={settings.restrictToTimeOfDay}
                  onChange={onBooleanChange('restrictToTimeOfDay')}
                />
                <label className="field-label" htmlFor="restrict-hours">
                  Only consider flights inside these windows
                </label>
              </div>
              <p className="field-helper">
                When enabled, Tempest will ignore hours outside your morning and evening
                windows when building flight options.
              </p>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <span className="field-label">Morning window</span>
                <span className="field-helper">local time, 24h clock</span>
              </div>
              <div className="field-row">
                <input
                  type="number"
                  className="field-input"
                  min={0}
                  max={23}
                  value={settings.morningStartHour}
                  onChange={onNumberChange('morningStartHour')}
                />
                <span className="field-value">start</span>
              </div>
              <div className="field-row">
                <input
                  type="number"
                  className="field-input"
                  min={0}
                  max={23}
                  value={settings.morningEndHour}
                  onChange={onNumberChange('morningEndHour')}
                />
                <span className="field-value">end</span>
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <span className="field-label">Evening window</span>
                <span className="field-helper">local time, 24h clock</span>
              </div>
              <div className="field-row">
                <input
                  type="number"
                  className="field-input"
                  min={0}
                  max={23}
                  value={settings.eveningStartHour}
                  onChange={onNumberChange('eveningStartHour')}
                />
                <span className="field-value">start</span>
              </div>
              <div className="field-row">
                <input
                  type="number"
                  className="field-input"
                  min={0}
                  max={23}
                  value={settings.eveningEndHour}
                  onChange={onNumberChange('eveningEndHour')}
                />
                <span className="field-value">end</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


