import type { ChangeEvent, FC, FormEvent } from 'react'
import { useState } from 'react'
import { useLocations } from '../state/useLocations'

export const LocationsPage: FC = () => {
  const { locations, addLocation, removeLocation } = useLocations()

  const [name, setName] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const lat = Number.parseFloat(latitude)
    const lon = Number.parseFloat(longitude)

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError('Latitude and longitude must be valid numbers.')
      return
    }

    addLocation({
      name: name.trim(),
      latitude: lat,
      longitude: lon,
      notes: notes.trim() || undefined,
    })

    setName('')
    setLatitude('')
    setLongitude('')
    setNotes('')
  }

  const onNumberChange =
    (setter: (value: string) => void) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value)
    }

  return (
    <section className="page">
      <header className="page-header">
        <h1 className="page-title">Locations</h1>
        <p className="page-subtitle">
          Save your launch sites here. Tempest will forecast each one and surface the
          best window across all of them.
        </p>
      </header>

      <div className="page-grid">
        <form className="card" onSubmit={handleSubmit}>
          <div className="card-header">
            <div className="card-title">Add a location</div>
          </div>

          <div className="page-grid">
            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="loc-name">
                  Name
                </label>
              </div>
              <input
                id="loc-name"
                className="field-input"
                placeholder="e.g. Home field, Coastal ridge"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <span className="field-label">Coordinates</span>
                <span className="field-helper">Decimal degrees</span>
              </div>
              <div className="field-row">
                <input
                  className="field-input"
                  placeholder="Latitude"
                  value={latitude}
                  onChange={onNumberChange(setLatitude)}
                />
                <input
                  className="field-input"
                  placeholder="Longitude"
                  value={longitude}
                  onChange={onNumberChange(setLongitude)}
                />
              </div>
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label" htmlFor="loc-notes">
                  Notes (optional)
                </label>
              </div>
              <input
                id="loc-notes"
                className="field-input"
                placeholder="Launch directions, obstacles, preferred wind"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && <p className="error-text">{error}</p>}

            <div className="page-actions">
              <button type="submit" className="primary-button">
                Save location
              </button>
            </div>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Saved locations</div>
          </div>

          {locations.length === 0 ? (
            <p className="muted">
              You haven&apos;t added any sites yet. Your first one will usually be your
              home field. You can add coastal, mountain or tow sites too.
            </p>
          ) : (
            <div className="list">
              {locations.map((loc) => (
                <div key={loc.id} className="list-row">
                  <div className="list-main">
                    <div className="list-title">{loc.name}</div>
                    <div className="list-subtitle">
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </div>
                    {loc.notes && <div className="list-subtitle">{loc.notes}</div>}
                  </div>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => removeLocation(loc.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}


