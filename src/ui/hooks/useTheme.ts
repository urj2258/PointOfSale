import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'pos-theme-config'

export interface ThemeConfig {
  dark: boolean
  primary: string
  secondary: string
  gradient1: string
  gradient2: string
  gradient3: string
  gradient4: string
  gradient5: string
}

const DEFAULT_THEME: ThemeConfig = {
  dark: false,
  primary: '#D6F44A',
  secondary: '#8C6CF8',
  gradient1: '#D6F44A',
  gradient2: '#A286FF',
  gradient3: '#E8DFFF',
  gradient4: '#F8C8D8',
  gradient5: '#86DFFF',
}

const PRESETS: { name: string; config: ThemeConfig }[] = [
  { name: 'Default', config: { ...DEFAULT_THEME, dark: false } },
  { name: 'Dark', config: { ...DEFAULT_THEME, dark: true } },
  { name: 'Ocean', config: { dark: false, primary: '#4DD8E8', secondary: '#39C56B', gradient1: '#4DD8E8', gradient2: '#39C56B', gradient3: '#B8F0D0', gradient4: '#D4F0E8', gradient5: '#86E8FF' } },
  { name: 'Ocean Dark', config: { dark: true, primary: '#4DD8E8', secondary: '#39C56B', gradient1: '#4DD8E8', gradient2: '#39C56B', gradient3: '#1A5A48', gradient4: '#2D5A5A', gradient5: '#2D8A8A' } },
  { name: 'Sunset', config: { dark: false, primary: '#FFB547', secondary: '#F8C8D8', gradient1: '#FFB547', gradient2: '#F8C8D8', gradient3: '#FFE0B0', gradient4: '#FFD0D0', gradient5: '#FFD890' } },
  { name: 'Midnight', config: { dark: true, primary: '#A286FF', secondary: '#8C6CF8', gradient1: '#A286FF', gradient2: '#8C6CF8', gradient3: '#2B1F59', gradient4: '#1A1040', gradient5: '#3D2A6A' } },
]

export function loadConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_THEME }
}

function saveConfig(config: ThemeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function applyTheme(config: ThemeConfig) {
  const root = document.documentElement
  if (config.dark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  root.style.setProperty('--color-primary-400', hexToRgba(config.primary, 0.75) || '#D8F03E')
  root.style.setProperty('--color-primary-500', config.primary)
  root.style.setProperty('--color-primary-900', darken(config.primary, 0.75))
  root.style.setProperty('--color-secondary-400', hexToRgba(config.secondary, 0.65) || '#A286FF')
  root.style.setProperty('--color-secondary-500', config.secondary)
  root.style.setProperty('--color-secondary-900', darken(config.secondary, 0.75))

  const { gradient1, gradient2, gradient3, gradient4, gradient5, dark } = config
  const opacities = dark
    ? { g1: 0.12, g2: 0.15, g3: 0.25, g4: 0.1, g5: 0.06 }
    : { g1: 0.35, g2: 0.3, g3: 0.45, g4: 0.3, g5: 0.15 }

  root.style.setProperty('--gradient-1', hexToRgba(gradient1, opacities.g1))
  root.style.setProperty('--gradient-2', hexToRgba(gradient2, opacities.g2))
  root.style.setProperty('--gradient-3', hexToRgba(gradient3, opacities.g3))
  root.style.setProperty('--gradient-4', hexToRgba(gradient4, opacities.g4))
  root.style.setProperty('--gradient-5', hexToRgba(gradient5, opacities.g5))

  root.style.setProperty('--gradient-rgb-1', hexToRgb(gradient1))
  root.style.setProperty('--gradient-rgb-2', hexToRgb(gradient2))
  root.style.setProperty('--gradient-rgb-3', hexToRgb(gradient3))
  root.style.setProperty('--gradient-rgb-4', hexToRgb(gradient4))
  root.style.setProperty('--gradient-rgb-5', hexToRgb(gradient5))
}

function hexToRgba(hex: string, alpha: number): string | null {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!m) return null
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
}

function hexToRgb(hex: string): string {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!m) return '0, 0, 0'
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`
}

function darken(hex: string, factor: number): string {
  const m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i)
  if (!m) return hex
  const r = Math.round(parseInt(m[1], 16) * factor)
  const g = Math.round(parseInt(m[2], 16) * factor)
  const b = Math.round(parseInt(m[3], 16) * factor)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function useTheme() {
  const [config, setConfig] = useState<ThemeConfig>(loadConfig)

  useEffect(() => {
    applyTheme(config)
    saveConfig(config)
  }, [config])

  const update = useCallback((patch: Partial<ThemeConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }))
  }, [])

  const reset = useCallback(() => {
    setConfig({ ...DEFAULT_THEME, dark: false })
  }, [])

  return { config, update, reset, presets: PRESETS }
}
