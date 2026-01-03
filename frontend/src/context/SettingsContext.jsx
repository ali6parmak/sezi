import { createContext, useContext, useState, useEffect } from 'react'
import { API_BASE } from '../utils/api'

const SettingsContext = createContext(null)

const defaultSettings = {
  font_family: 'JetBrains Mono',
  font_size: 48,
  font_color: '#E2E8F0',
  background_color: '#0F172A',
  highlight_color: '#F97316',
  reading_speed: 250,
  theme: 'midnight'
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  // Apply theme and colors when they change
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.theme)
    
    // Apply custom colors as CSS variables
    root.style.setProperty('--reading-font', settings.font_family)
    root.style.setProperty('--reading-color', settings.font_color)
    root.style.setProperty('--reading-bg', settings.background_color)
    root.style.setProperty('--highlight-color', settings.highlight_color)
    root.style.setProperty('--accent-primary', settings.highlight_color)
  }, [settings.theme, settings.font_family, settings.font_color, settings.background_color, settings.highlight_color])

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`)
      const data = await res.json()
      if (data.settings) {
        setSettings({ ...defaultSettings, ...data.settings })
      }
    } catch (err) {
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    
    try {
      await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

