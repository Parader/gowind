import { useEffect, useState } from 'react'
import type { Location } from '../domain/types'

const STORAGE_KEY = 'tempest:locations:v1'

function loadInitialLocations(): Location[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Location[]
    return parsed
  } catch {
    return []
  }
}

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>(() => loadInitialLocations())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(locations))
    } catch {
      // ignore
    }
  }, [locations])

  const addLocation = (loc: Omit<Location, 'id'>) => {
    const id = crypto.randomUUID()
    const next: Location = { ...loc, id }
    setLocations((prev) => [...prev, next])
  }

  const updateLocation = (id: string, patch: Partial<Location>) => {
    setLocations((prev) => prev.map((loc) => (loc.id === id ? { ...loc, ...patch } : loc)))
  }

  const removeLocation = (id: string) => {
    setLocations((prev) => prev.filter((loc) => loc.id !== id))
  }

  return { locations, addLocation, updateLocation, removeLocation }
}

