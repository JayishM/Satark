import { useEffect } from 'react'
import { HAZARDS } from '@/themes/hazards'

export function useHazardTheme(hazardId = 'landslide') {
  const theme = HAZARDS[hazardId] || HAZARDS.landslide

  useEffect(() => {
    document.documentElement.style.setProperty('--hazard-accent', theme.accent)
    document.documentElement.style.setProperty('--hazard-secondary', theme.secondary)
    document.documentElement.style.setProperty('--hazard-glow', theme.glow)
    document.documentElement.style.setProperty('--hazard-background', theme.background)
  }, [theme])

  return theme
}
