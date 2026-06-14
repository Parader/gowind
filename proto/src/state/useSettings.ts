import { useEffect, useState } from 'react'
import { defaultUserSettings, type UserSettings } from '../domain/types'

const STORAGE_KEY = 'tempest:user-settings:v1'

function loadInitialSettings(): UserSettings {
  if (typeof window === 'undefined') return defaultUserSettings

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultUserSettings
    const parsed = JSON.parse(raw) as Partial<UserSettings>
    return { ...defaultUserSettings, ...parsed }
  } catch {
    return defaultUserSettings
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(() => loadInitialSettings())

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore storage errors
    }
  }, [settings])

  return { settings, setSettings }
}

