import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sun, Moon, Palette, Type, Zap, RotateCcw, Search, ChevronDown } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import '../styles/SettingsModal.css'

// Common system fonts as fallback
const COMMON_FONTS = [
  'Arial', 'Arial Black', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact',
  'Times New Roman', 'Georgia', 'Palatino Linotype', 'Book Antiqua',
  'Courier New', 'Lucida Console', 'Monaco', 'Consolas',
  'Comic Sans MS', 'Brush Script MT',
  'Segoe UI', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Oswald',
  'Source Sans Pro', 'Raleway', 'PT Sans', 'Merriweather', 'Noto Sans',
  'Ubuntu', 'Fira Sans', 'Fira Code', 'JetBrains Mono', 'SF Pro', 'SF Mono',
  'Helvetica', 'Helvetica Neue', 'system-ui'
]

const THEMES = [
  { 
    id: 'midnight', 
    name: 'Midnight', 
    color: '#0a0e17', 
    accent: '#f97316',
    defaults: {
      font_color: '#f1f5f9',
      background_color: '#0f172a',
      highlight_color: '#f97316'
    }
  },
  { 
    id: 'ocean', 
    name: 'Ocean', 
    color: '#0c1222', 
    accent: '#06b6d4',
    defaults: {
      font_color: '#e0f2fe',
      background_color: '#0c1222',
      highlight_color: '#06b6d4'
    }
  },
  { 
    id: 'forest', 
    name: 'Forest', 
    color: '#0a1510', 
    accent: '#22c55e',
    defaults: {
      font_color: '#ecfdf5',
      background_color: '#0a1510',
      highlight_color: '#22c55e'
    }
  },
  { 
    id: 'sunset', 
    name: 'Sunset', 
    color: '#1a0a0a', 
    accent: '#f43f5e',
    defaults: {
      font_color: '#fef2f2',
      background_color: '#1a0a0a',
      highlight_color: '#f43f5e'
    }
  },
  { 
    id: 'paper', 
    name: 'Paper', 
    color: '#faf8f5', 
    accent: '#c2410c',
    defaults: {
      font_color: '#1c1917',
      background_color: '#faf8f5',
      highlight_color: '#c2410c'
    }
  }
]

const FONT_SIZES = [24, 32, 40, 48, 56, 64, 72, 80]

export default function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings } = useSettings()
  const [localSettings, setLocalSettings] = useState(settings)
  const [systemFonts, setSystemFonts] = useState([])
  const [fontSearch, setFontSearch] = useState('')
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [fontsLoaded, setFontsLoaded] = useState(false)
  const fontDropdownRef = useRef(null)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings, isOpen])

  // Load system fonts
  useEffect(() => {
    const loadFonts = async () => {
      // Start with common fonts
      let fonts = [...COMMON_FONTS]
      
      try {
        // Try Local Font Access API (available in Electron/Chrome with permissions)
        if ('queryLocalFonts' in window) {
          const systemFontList = await window.queryLocalFonts()
          const systemFamilies = [...new Set(systemFontList.map(f => f.family))]
          // Merge with common fonts, removing duplicates
          fonts = [...new Set([...fonts, ...systemFamilies])]
        }
      } catch (err) {
        console.log('Local Font Access API not available or permission denied')
      }
      
      setSystemFonts(fonts.sort())
      setFontsLoaded(true)
    }
    loadFonts()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target)) {
        setShowFontDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredFonts = systemFonts.filter(font => 
    font.toLowerCase().includes(fontSearch.toLowerCase())
  )

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
    updateSettings({ [key]: value })
  }

  const handleThemeChange = (themeId) => {
    const theme = THEMES.find(t => t.id === themeId)
    if (theme) {
      // Update all theme-related settings at once to avoid mixed state
      const newSettings = {
        theme: themeId,
        font_color: theme.defaults.font_color,
        background_color: theme.defaults.background_color,
        highlight_color: theme.defaults.highlight_color
      }
      setLocalSettings(prev => ({ ...prev, ...newSettings }))
      updateSettings(newSettings)
    }
  }

  const handleResetTheme = () => {
    const theme = THEMES.find(t => t.id === localSettings.theme)
    if (theme && theme.defaults) {
      // Reset to theme defaults
      handleChange('font_color', theme.defaults.font_color)
      handleChange('background_color', theme.defaults.background_color)
      handleChange('highlight_color', theme.defaults.highlight_color)
      handleChange('font_family', 'JetBrains Mono')
      handleChange('font_size', 48)
      handleChange('reading_speed', 250)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div
          className="modal-content"
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="modal-header">
            <h2>Settings</h2>
            <button className="btn btn-ghost btn-icon" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="modal-body">
            {/* Theme Selection */}
            <section className="settings-section">
              <div className="section-header-row">
                <h3>
                  <Palette size={18} />
                  Theme
                </h3>
                <button 
                  className="reset-btn"
                  onClick={handleResetTheme}
                  title="Reset to theme defaults"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>
              <div className="theme-grid">
                {THEMES.map(theme => (
                  <button
                    key={theme.id}
                    className={`theme-btn ${localSettings.theme === theme.id ? 'active' : ''}`}
                    onClick={() => handleThemeChange(theme.id)}
                    style={{ '--theme-color': theme.color, '--theme-accent': theme.accent }}
                  >
                    <div className="theme-preview">
                      <div className="theme-bg" />
                      <div className="theme-accent" />
                    </div>
                    <span>{theme.name}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Font Selection */}
            <section className="settings-section">
              <h3>
                <Type size={18} />
                Font Family
              </h3>
              <div className="font-selector" ref={fontDropdownRef}>
                <button 
                  className="font-selector-btn"
                  onClick={() => setShowFontDropdown(!showFontDropdown)}
                >
                  <span 
                    className="font-selector-preview" 
                    style={{ fontFamily: localSettings.font_family }}
                  >
                    Aa
                  </span>
                  <span className="font-selector-name">{localSettings.font_family}</span>
                  <ChevronDown size={16} className={showFontDropdown ? 'rotated' : ''} />
                </button>
                
                {showFontDropdown && (
                  <div className="font-dropdown">
                    <div className="font-search">
                      <Search size={16} />
                      <input
                        type="text"
                        placeholder="Search fonts..."
                        value={fontSearch}
                        onChange={(e) => setFontSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="font-list">
                      {filteredFonts.length > 0 ? (
                        filteredFonts.map(font => (
                          <button
                            key={font}
                            className={`font-option ${localSettings.font_family === font ? 'active' : ''}`}
                            onClick={() => {
                              handleChange('font_family', font)
                              setShowFontDropdown(false)
                              setFontSearch('')
                            }}
                            style={{ fontFamily: font }}
                          >
                            <span className="font-option-preview">Aa</span>
                            <span className="font-option-name">{font}</span>
                          </button>
                        ))
                      ) : (
                        <div className="font-no-results">No fonts found</div>
                      )}
                    </div>
                    <div className="font-custom">
                      <input
                        type="text"
                        placeholder="Or type custom font name..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value) {
                            handleChange('font_family', e.target.value)
                            setShowFontDropdown(false)
                            e.target.value = ''
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Font Size */}
            <section className="settings-section">
              <h3>
                <Type size={18} />
                Font Size
              </h3>
              <div className="size-slider">
                <span className="size-label">Small</span>
                <input
                  type="range"
                  min="24"
                  max="80"
                  step="8"
                  value={localSettings.font_size}
                  onChange={e => handleChange('font_size', parseInt(e.target.value))}
                />
                <span className="size-label">Large</span>
              </div>
              <div className="size-preview" style={{ fontSize: `${localSettings.font_size * 0.5}px` }}>
                {localSettings.font_size}px
              </div>
            </section>

            {/* Reading Speed */}
            <section className="settings-section">
              <h3>
                <Zap size={18} />
                Default Reading Speed
              </h3>
              <div className="speed-slider">
                <span className="speed-value">{localSettings.reading_speed} WPM</span>
                <input
                  type="range"
                  min="50"
                  max="800"
                  step="25"
                  value={localSettings.reading_speed}
                  onChange={e => handleChange('reading_speed', parseInt(e.target.value))}
                />
                <div className="speed-labels">
                  <span>Slow</span>
                  <span>Normal</span>
                  <span>Fast</span>
                </div>
              </div>
            </section>

            {/* Color Customization */}
            <section className="settings-section">
              <h3>
                <Palette size={18} />
                Custom Colors
              </h3>
              <div className="color-grid">
                <div className="color-input">
                  <label>Text Color</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      value={localSettings.font_color}
                      onChange={e => handleChange('font_color', e.target.value)}
                    />
                    <span>{localSettings.font_color}</span>
                  </div>
                </div>
                <div className="color-input">
                  <label>Highlight Color</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      value={localSettings.highlight_color}
                      onChange={e => handleChange('highlight_color', e.target.value)}
                    />
                    <span>{localSettings.highlight_color}</span>
                  </div>
                </div>
                <div className="color-input">
                  <label>Background Color</label>
                  <div className="color-picker-wrapper">
                    <input
                      type="color"
                      value={localSettings.background_color}
                      onChange={e => handleChange('background_color', e.target.value)}
                    />
                    <span>{localSettings.background_color}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Preview */}
            <section className="settings-section preview-section">
              <h3>Preview</h3>
              <div 
                className="reading-preview"
                style={{
                  fontFamily: localSettings.font_family,
                  fontSize: `${localSettings.font_size * 0.6}px`,
                  color: localSettings.font_color,
                  backgroundColor: localSettings.background_color
                }}
              >
                <span style={{ fontWeight: 700, color: localSettings.highlight_color }}>Fast</span>
                <span>Read</span>
                <span> </span>
                <span style={{ fontWeight: 700, color: localSettings.highlight_color }}>spe</span>
                <span>ed</span>
                <span> </span>
                <span style={{ fontWeight: 700, color: localSettings.highlight_color }}>rea</span>
                <span>ding</span>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <p className="settings-hint">
              Tip: Use arrow keys ↑↓ to adjust speed during reading
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

