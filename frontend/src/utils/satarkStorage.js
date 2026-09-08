const CACHE_KEY = 'satark_location_cache'
const CACHE_VERSION = 1

const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export function saveSatarkData(locationName, data) {
  if (!locationName || !data) return

  try {
    const existing = JSON.parse(
      localStorage.getItem(CACHE_KEY) || '{}'
    )

    existing[locationName.toLowerCase().trim()] = {
      version: CACHE_VERSION,
      savedAt: Date.now(),
      data
    }

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(existing)
    )
  } catch (error) {
    console.warn('SATARK cache save failed:', error)
  }
}

export function getSatarkData(locationName) {
  if (!locationName) return null

  try {
    const existing = JSON.parse(
      localStorage.getItem(CACHE_KEY) || '{}'
    )

    const cached =
      existing[locationName.toLowerCase().trim()]

    if (!cached) {
      return null
    }

    if (cached.version !== CACHE_VERSION) {
      return null
    }

    // Prevent using extremely old risk information
    if (Date.now() - cached.savedAt > CACHE_TTL) {
      delete existing[locationName.toLowerCase().trim()]

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(existing)
      )

      return null
    }

    return cached.data

  } catch (error) {
    console.warn('SATARK cache read failed:', error)
    return null
  }
}

export function clearSatarkCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.warn('SATARK cache clear failed:', error)
  }
}