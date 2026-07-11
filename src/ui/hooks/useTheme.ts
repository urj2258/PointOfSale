import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'dark_mode'

export function applyTheme(isDark: boolean) {
  const root = document.documentElement
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function loadDarkMode(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null) return JSON.parse(raw)
  } catch {}
  return false
}

function saveDarkMode(isDark: boolean) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(isDark))
}

export function useTheme() {
  const [isDarkMode, setIsDarkMode] = useState(loadDarkMode)

  useEffect(() => {
    applyTheme(isDarkMode)
    saveDarkMode(isDarkMode)
  }, [isDarkMode])

  const toggle = useCallback(() => {
    setIsDarkMode(prev => !prev)
  }, [])

  const setDark = useCallback((dark: boolean) => {
    setIsDarkMode(dark)
  }, [])

  return { isDarkMode, toggle, setDark }
}
