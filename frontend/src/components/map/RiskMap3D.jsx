import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  AlertTriangle,
  Flame,
  Hospital,
  LocateFixed,
  MapPinned,
  Maximize2,
  Minimize2,
  Mountain,
  Navigation,
  ShieldCheck,
  Siren,
} from 'lucide-react'

/*
=========================================================
 SATARK — STABLE 3D GEO-INTELLIGENCE MAP
=========================================================

 IMPORTANT ARCHITECTURE:

 1. Base map loads FIRST.
 2. Terrain loads AFTER map.load.
 3. Terrain failure NEVER prevents map rendering.
 4. DEM uses AWS Terrarium tiles.
 5. OSM is the primary basemap.
 6. Esri is optional satellite imagery.
 7. Safety APIs are completely independent from map loading.
=========================================================
*/


/* ========================================================
   MAP DATA SOURCES
======================================================== */

const OSM_TILES =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

/*
 * IMPORTANT:
 * This is NOT placed in the initial style.
 * It is added only after the map has loaded.
 */
const TERRAIN_TILES =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

const OVERPASS_URL =
  'https://overpass-api.de/api/interpreter'

const NOMINATIM_URL =
  'https://nominatim.openstreetmap.org/search'

const OSRM_URL =
  'https://router.project-osrm.org/route/v1/driving'


/* ========================================================
   STORAGE
======================================================== */

const LOCATION_CACHE_KEY =
  'satark_location_cache'

const SAFETY_CACHE_PREFIX =
  'satark_safety_cache_'

const SAFETY_CACHE_TTL =
  30 * 60 * 1000


/* ========================================================
   BASIC HELPERS
======================================================== */

function clamp(value, min, max) {
  return Math.max(
    min,
    Math.min(max, value)
  )
}


function getRiskColor(score) {
  const value =
    Number(score) || 0

  if (value >= 80) return '#ef4444'
  if (value >= 60) return '#f97316'
  if (value >= 40) return '#facc15'
  if (value >= 20) return '#84cc16'

  return '#22c55e'
}


function getRiskLabel(score) {
  const value =
    Number(score) || 0

  if (value >= 80) return 'SEVERE'
  if (value >= 60) return 'HIGH'
  if (value >= 40) return 'MODERATE'
  if (value >= 20) return 'LOW'

  return 'VERY LOW'
}


function normalizeHazard(value) {
  const text =
    String(value || '').toLowerCase()

  if (
    text.includes('landslide') ||
    text.includes('avalanche')
  ) {
    return 'Landslide'
  }

  if (text.includes('flood')) {
    return 'Flood'
  }

  if (
    text.includes('wildfire') ||
    text.includes('forest fire')
  ) {
    return 'Wildfire'
  }

  if (text.includes('heat')) {
    return 'Extreme Heat'
  }

  if (
    text.includes('storm') ||
    text.includes('cyclone') ||
    text.includes('thunder')
  ) {
    return 'Storm'
  }

  return 'General Risk'
}


function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}


function distanceKm(a, b) {
  const R = 6371

  const dLat =
    ((b.latitude - a.latitude) *
      Math.PI) /
    180

  const dLon =
    ((b.longitude - a.longitude) *
      Math.PI) /
    180

  const lat1 =
    (a.latitude * Math.PI) /
    180

  const lat2 =
    (b.latitude * Math.PI) /
    180

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(1 - h)
    )
  )
}


function directionFromTo(from, to) {
  const lat1 =
    (from.latitude * Math.PI) /
    180

  const lat2 =
    (to.latitude * Math.PI) /
    180

  const dLon =
    ((to.longitude - from.longitude) *
      Math.PI) /
    180

  const y =
    Math.sin(dLon) *
    Math.cos(lat2)

  const x =
    Math.cos(lat1) *
      Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLon)

  const bearing =
    ((Math.atan2(y, x) * 180) /
      Math.PI +
      360) %
    360

  const directions = [
    'N',
    'NE',
    'E',
    'SE',
    'S',
    'SW',
    'W',
    'NW',
  ]

  return (
    directions[
      Math.round(bearing / 45) % 8
    ] || 'N'
  )
}


/* ========================================================
   DESTINATION CACHE
======================================================== */

function readLocations() {
  try {
    const raw =
      localStorage.getItem(
        LOCATION_CACHE_KEY
      )

    if (!raw) {
      return []
    }

    const cache =
      JSON.parse(raw)

    return Object.entries(cache)
      .map(([key, entry]) => {
        const location =
          entry?.data?.location

        if (!location) {
          return null
        }

        const coordinates =
          location.coordinates || []

        const latitude =
          Number(coordinates[0])

        const longitude =
          Number(coordinates[1])

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null
        }

        const data =
          entry?.data || {}

        const risk =
          data?.risk || {}

        const factors =
          risk?.factors || {}

        const candidates = [
          {
            name: 'Flood',
            score:
              Number(
                factors?.rain?.score || 0
              ),
          },
          {
            name: 'Landslide',
            score:
              Number(
                factors
                  ?.landslide_trigger
                  ?.score || 0
              ),
          },
          {
            name: 'Storm',
            score:
              Number(
                factors?.wind?.score || 0
              ),
          },
          {
            name: 'Extreme Heat',
            score:
              Number(
                factors
                  ?.temperature
                  ?.score || 0
              ),
          },
        ]

        candidates.sort(
          (a, b) =>
            b.score - a.score
        )

        const dominant =
          candidates[0]?.score > 0
            ? candidates[0].name
            : location?.dominantHazard ||
              location?.hazard ||
              data?.hazard ||
              'General Risk'

        return {
          ...location,

          id:
            location.id ||
            key,

          name:
            location.name ||
            key,

          latitude,
          longitude,

          riskScore:
            Number(
              location.riskScore ??
                risk.score ??
                0
            ),

          hazardIndex:
            Number(
              location.hazardIndex ??
                risk.hazardIndex ??
                0
            ),

          elevation:
            Number(
              location.elevation || 0
            ),

          dominantHazard:
            normalizeHazard(
              dominant
            ),

          factors,
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.warn(
      'SATARK location cache error:',
      error
    )

    return []
  }
}


/* ========================================================
   HAZARD STRATEGY
======================================================== */

function getStrategy(hazard) {
  if (hazard === 'Landslide') {
    return {
      title:
        'MOVE AWAY FROM STEEP SLOPES',

      description:
        'Stable terrain and accessible emergency infrastructure are prioritized.',

      avoid:
        'Steep slopes • unstable faces • exposed road cuts',

      priorities: [
        'shelter',
        'assembly',
        'hospital',
        'police',
        'fire',
      ],
    }
  }

  if (hazard === 'Flood') {
    return {
      title:
        'PRIORITIZE ELEVATED RESPONSE AREAS',

      description:
        'Response points away from low-lying corridors are preferred.',

      avoid:
        'River corridors • bridges • low-lying roads',

      priorities: [
        'shelter',
        'assembly',
        'hospital',
        'police',
        'fire',
      ],
    }
  }

  if (hazard === 'Wildfire') {
    return {
      title:
        'MOVE AWAY FROM FIRE CORRIDORS',

      description:
        'Shelters and fire-response infrastructure are prioritized.',

      avoid:
        'Forest edges • smoke corridors • isolated roads',

      priorities: [
        'shelter',
        'assembly',
        'fire',
        'police',
        'hospital',
      ],
    }
  }

  if (hazard === 'Extreme Heat') {
    return {
      title:
        'PRIORITIZE MEDICAL ACCESS',

      description:
        'Medical facilities and sheltered areas are prioritized.',

      avoid:
        'Exposed areas • prolonged outdoor travel',

      priorities: [
        'hospital',
        'shelter',
        'assembly',
        'police',
        'fire',
      ],
    }
  }

  if (hazard === 'Storm') {
    return {
      title:
        'PRIORITIZE PROTECTED FACILITIES',

      description:
        'Protected emergency infrastructure is prioritized.',

      avoid:
        'Open areas • ridgelines • trees • poles',

      priorities: [
        'shelter',
        'assembly',
        'hospital',
        'police',
        'fire',
      ],
    }
  }

  return {
    title:
      'PREFER EMERGENCY RESPONSE FACILITIES',

    description:
      'Nearby emergency infrastructure is ranked automatically.',

    avoid:
      'Prefer established emergency infrastructure.',

    priorities: [
      'shelter',
      'assembly',
      'hospital',
      'police',
      'fire',
    ],
  }
}


/* ========================================================
   SAFETY CACHE
======================================================== */

function getSafetyCacheKey(location) {
  return (
    SAFETY_CACHE_PREFIX +
    location.latitude.toFixed(4) +
    '_' +
    location.longitude.toFixed(4)
  )
}


function readSafetyCache(location) {
  try {
    const raw =
      sessionStorage.getItem(
        getSafetyCacheKey(location)
      )

    if (!raw) {
      return null
    }

    const parsed =
      JSON.parse(raw)

    if (
      !parsed?.timestamp ||
      !Array.isArray(parsed?.points)
    ) {
      return null
    }

    if (
      Date.now() -
        parsed.timestamp >
      SAFETY_CACHE_TTL
    ) {
      return null
    }

    return parsed.points
  } catch {
    return null
  }
}


function writeSafetyCache(
  location,
  points
) {
  try {
    sessionStorage.setItem(
      getSafetyCacheKey(location),
      JSON.stringify({
        timestamp: Date.now(),
        points,
      })
    )
  } catch {}
}


/* ========================================================
   OVERPASS
======================================================== */

async function fetchOverpassPoints(
  location
) {
  const query = `
[out:json][timeout:10];

(
  node(around:7000,${location.latitude},${location.longitude})["amenity"="shelter"];
  node(around:7000,${location.latitude},${location.longitude})["emergency"="assembly_point"];
  node(around:7000,${location.latitude},${location.longitude})["amenity"="hospital"];
  node(around:7000,${location.latitude},${location.longitude})["amenity"="police"];
  node(around:7000,${location.latitude},${location.longitude})["amenity"="fire_station"];

  way(around:7000,${location.latitude},${location.longitude})["amenity"="hospital"];
  way(around:7000,${location.latitude},${location.longitude})["amenity"="police"];
  way(around:7000,${location.latitude},${location.longitude})["amenity"="fire_station"];
);

out center tags;
`

  const controller =
    new AbortController()

  const timer =
    setTimeout(
      () => controller.abort(),
      12000
    )

  try {
    const response =
      await fetch(
        OVERPASS_URL,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'text/plain;charset=UTF-8',

            Accept:
              'application/json',
          },

          body: query,

          signal:
            controller.signal,
        }
      )

    if (
      !response.ok
    ) {
      throw new Error(
        `OVERPASS_${response.status}`
      )
    }

    const json =
      await response.json()

    const elements =
      Array.isArray(
        json?.elements
      )
        ? json.elements
        : []

    return elements
      .map(element => {
        const tags =
          element.tags || {}

        const latitude =
          Number(
            element.lat ??
              element.center?.lat
          )

        const longitude =
          Number(
            element.lon ??
              element.center?.lon
          )

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null
        }

        let type =
          'response'

        if (
          tags.amenity ===
          'shelter'
        ) {
          type = 'shelter'
        } else if (
          tags.emergency ===
          'assembly_point'
        ) {
          type = 'assembly'
        } else if (
          tags.amenity ===
          'hospital'
        ) {
          type = 'hospital'
        } else if (
          tags.amenity ===
          'police'
        ) {
          type = 'police'
        } else if (
          tags.amenity ===
          'fire_station'
        ) {
          type = 'fire'
        }

        const metadata = {
          shelter: {
            label:
              'DESIGNATED SHELTER',
            color:
              '#22c55e',
          },

          assembly: {
            label:
              'ASSEMBLY POINT',
            color:
              '#22c55e',
          },

          hospital: {
            label:
              'HOSPITAL',
            color:
              '#60a5fa',
          },

          police: {
            label:
              'POLICE STATION',
            color:
              '#818cf8',
          },

          fire: {
            label:
              'FIRE STATION',
            color:
              '#fb923c',
          },

          response: {
            label:
              'RESPONSE POINT',
            color:
              '#94a3b8',
          },
        }[type]

        return {
          id:
            `${element.type}-${element.id}`,

          name:
            tags.name ||
            tags['name:en'] ||
            metadata.label,

          type,

          label:
            metadata.label,

          color:
            metadata.color,

          latitude,
          longitude,
        }
      })
      .filter(Boolean)
  } finally {
    clearTimeout(timer)
  }
}


/* ========================================================
   NOMINATIM FALLBACK
======================================================== */

async function fetchNominatimPoints(
  location
) {
  const categories = [
    {
      type: 'hospital',
      query: 'hospital',
    },
    {
      type: 'police',
      query: 'police station',
    },
    {
      type: 'fire',
      query: 'fire station',
    },
  ]

  const result = []

  for (
    const item of categories
  ) {
    try {
      const params =
        new URLSearchParams({
          q:
            `${item.query} near ${location.latitude},${location.longitude}`,

          format: 'jsonv2',

          limit: '3',
        })

      const response =
        await fetch(
          `${NOMINATIM_URL}?${params.toString()}`,
          {
            headers: {
              Accept:
                'application/json',
            },
          }
        )

      if (
        !response.ok
      ) {
        continue
      }

      const data =
        await response.json()

      if (
        !Array.isArray(data)
      ) {
        continue
      }

      const metadata = {
        hospital: {
          label: 'HOSPITAL',
          color: '#60a5fa',
        },

        police: {
          label: 'POLICE STATION',
          color: '#818cf8',
        },

        fire: {
          label: 'FIRE STATION',
          color: '#fb923c',
        },
      }[item.type]

      data.forEach(entry => {
        const latitude =
          Number(entry.lat)

        const longitude =
          Number(entry.lon)

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return
        }

        result.push({
          id:
            `${item.type}-${latitude}-${longitude}`,

          name:
            entry.display_name
              ?.split(',')
              ?.slice(0, 2)
              ?.join(', ') ||
            item.query,

          type:
            item.type,

          label:
            metadata.label,

          color:
            metadata.color,

          latitude,
          longitude,
        })
      })
    } catch {
      // continue
    }
  }

  return result
}


/* ========================================================
   SAFETY LOADER
======================================================== */

async function loadSafetyPoints(
  location
) {
  const cached =
    readSafetyCache(location)

  if (cached) {
    console.log(
      'SATARK: using cached safety data'
    )

    return {
      points: cached,
      source: 'CACHED',
    }
  }

  try {
    const points =
      await fetchOverpassPoints(
        location
      )

    if (points.length) {
      writeSafetyCache(
        location,
        points
      )

      return {
        points,
        source:
          'OPENSTREETMAP',
      }
    }
  } catch (error) {
    console.warn(
      'SATARK Overpass unavailable:',
      error?.message || error
    )
  }

  try {
    const points =
      await fetchNominatimPoints(
        location
      )

    if (points.length) {
      writeSafetyCache(
        location,
        points
      )

      return {
        points,
        source: 'NOMINATIM',
      }
    }
  } catch {}

  return {
    points: [],
    source: 'UNAVAILABLE',
  }
}


/* ========================================================
   SAFETY RANKING
======================================================== */

function rankSafetyPoints(
  points,
  location,
  strategy,
  hazard
) {
  return points
    .map(point => {
      const distance =
        distanceKm(
          location,
          point
        )

      const priority =
        strategy.priorities.indexOf(
          point.type
        )

      let score =
        priority === -1
          ? 45
          : 100 -
            priority * 13

      if (
        hazard === 'Flood' ||
        hazard === 'Landslide'
      ) {
        if (
          point.type ===
          'shelter'
        ) {
          score += 24
        }

        if (
          point.type ===
          'assembly'
        ) {
          score += 21
        }
      }

      if (
        hazard === 'Wildfire'
      ) {
        if (
          point.type ===
          'shelter'
        ) {
          score += 24
        }

        if (
          point.type ===
          'fire'
        ) {
          score += 18
        }
      }

      if (
        hazard ===
        'Extreme Heat'
      ) {
        if (
          point.type ===
          'hospital'
        ) {
          score += 26
        }
      }

      if (
        hazard === 'Storm'
      ) {
        if (
          point.type ===
          'shelter'
        ) {
          score += 24
        }

        if (
          point.type ===
          'assembly'
        ) {
          score += 21
        }
      }

      score -= Math.min(
        distance * 5,
        35
      )

      return {
        ...point,

        distanceKm:
          distance,

        direction:
          directionFromTo(
            location,
            point
          ),

        aiScore:
          Math.round(
            clamp(
              score,
              1,
              100
            )
          ),
      }
    })
    .sort(
      (a, b) =>
        b.aiScore -
        a.aiScore
    )
}


/* ========================================================
   ROUTING
======================================================== */

async function getRoute(
  origin,
  destination
) {
  const coordinates =
    `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`

  const url =
    `${OSRM_URL}/${coordinates}?overview=full&geometries=geojson`

  try {
    const response =
      await fetch(url)

    if (
      !response.ok
    ) {
      return null
    }

    const data =
      await response.json()

    if (
      data?.code !== 'Ok' ||
      !data?.routes?.length
    ) {
      return null
    }

    return data.routes[0]
  } catch {
    return null
  }
}


/* ========================================================
   HAZARD CIRCLE
======================================================== */

function createCircle(
  longitude,
  latitude,
  radiusMeters
) {
  const earth =
    6371008.8

  const angular =
    radiusMeters / earth

  const centerLat =
    (latitude * Math.PI) /
    180

  const centerLon =
    (longitude * Math.PI) /
    180

  const coordinates = []

  const segments = 96

  for (
    let i = 0;
    i <= segments;
    i++
  ) {
    const angle =
      (i / segments) *
      Math.PI *
      2

    const lat =
      Math.asin(
        Math.sin(centerLat) *
          Math.cos(angular) +
          Math.cos(centerLat) *
            Math.sin(angular) *
            Math.cos(angle)
      )

    const lon =
      centerLon +
      Math.atan2(
        Math.sin(angle) *
          Math.sin(angular) *
          Math.cos(centerLat),

        Math.cos(angular) -
          Math.sin(centerLat) *
            Math.sin(lat)
      )

    coordinates.push([
      (lon * 180) /
        Math.PI,

      (lat * 180) /
        Math.PI,
    ])
  }

  return {
    type: 'Feature',

    properties: {},

    geometry: {
      type: 'Polygon',

      coordinates: [
        coordinates,
      ],
    },
  }
}


/* ========================================================
   METRIC
======================================================== */

function Metric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/75 px-3 py-2">
      <div className="text-[7px] font-bold uppercase tracking-[.15em] text-white/25">
        {label}
      </div>

      <div className="mt-1 text-[11px] font-black text-white">
        {value}
      </div>
    </div>
  )
}


/* ========================================================
   MAIN COMPONENT
======================================================== */

export default function RiskMap3D() {
  const mapContainerRef =
    useRef(null)

  const mapRef =
    useRef(null)

  const initializedRef =
    useRef(false)

  const destinationMarkerRef =
    useRef(null)

  const safetyMarkersRef =
    useRef([])

  const resizeObserverRef =
    useRef(null)


  const [
    locations,
    setLocations,
  ] = useState([])

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState(null)

  const [
    safetyPoints,
    setSafetyPoints,
  ] = useState([])

  const [
    selectedPoint,
    setSelectedPoint,
  ] = useState(null)

  const [
    routes,
    setRoutes,
  ] = useState([])

  const [
    mapReady,
    setMapReady,
  ] = useState(false)

  const [
    terrainReady,
    setTerrainReady,
  ] = useState(false)

  const [
    terrainEnabled,
    setTerrainEnabled,
  ] = useState(true)

  const [
    satelliteEnabled,
    setSatelliteEnabled,
  ] = useState(false)

  const [
    showHazard,
    setShowHazard,
  ] = useState(true)

  const [
    showSafety,
    setShowSafety,
  ] = useState(true)

  const [
    showRoutes,
    setShowRoutes,
  ] = useState(true)

  const [
    safetyLoading,
    setSafetyLoading,
  ] = useState(false)

  const [
    safetySource,
    setSafetySource,
  ] = useState('')

  const [
    fullscreen,
    setFullscreen,
  ] = useState(false)


  /* ======================================================
     DESTINATIONS
  ====================================================== */

  useEffect(() => {
    const refresh = () => {
      const saved =
        readLocations()

      setLocations(saved)

      setSelectedLocation(
        current => {
          if (
            !current &&
            saved.length
          ) {
            return saved[0]
          }

          if (current) {
            return (
              saved.find(
                location =>
                  location.id ===
                  current.id
              ) ||
              saved[0] ||
              null
            )
          }

          return null
        }
      )
    }

    refresh()

    const interval =
      window.setInterval(
        refresh,
        15000
      )

    return () =>
      window.clearInterval(
        interval
      )
  }, [])


  /* ======================================================
     DERIVED
  ====================================================== */

  const riskScore =
    Number(
      selectedLocation?.riskScore ||
        0
    )

  const hazardIndex =
    Number(
      selectedLocation?.hazardIndex ??
        riskScore
    )

  const hazard =
    normalizeHazard(
      selectedLocation?.dominantHazard
    )

  const riskColor =
    getRiskColor(
      riskScore
    )

  const riskLabel =
    getRiskLabel(
      riskScore
    )

  const strategy =
    useMemo(
      () =>
        getStrategy(hazard),
      [hazard]
    )

  const recommendedPoint =
    selectedPoint ||
    safetyPoints[0] ||
    null


  /* ======================================================
     MAP INITIALIZATION

     THIS IS THE CRITICAL FIX.

     The initial style contains ONLY:
       - OSM
       - Satellite

     TERRAIN IS NOT PART OF INITIAL STYLE.

     This means DEM failure cannot kill the map.
  ====================================================== */

  useEffect(() => {
    if (
      initializedRef.current
    ) {
      return
    }

    if (
      !mapContainerRef.current
    ) {
      return
    }

    if (
      !selectedLocation
    ) {
      return
    }

    initializedRef.current =
      true

    let map = null

    try {
      map =
        new maplibregl.Map({
          container:
            mapContainerRef.current,

          center: [
            selectedLocation.longitude,
            selectedLocation.latitude,
          ],

          zoom: 12,

          pitch: 62,

          bearing: -18,

          maxPitch: 85,

          minZoom: 2,

          maxZoom: 19,

          antialias: true,

          renderWorldCopies:
            false,

          cooperativeGestures:
            false,

          /*
           * NO TERRAIN HERE.
           */
          style: {
            version: 8,

            sources: {
              satarkOSM: {
                type: 'raster',

                tiles: [
                  OSM_TILES,
                ],

                tileSize: 256,

                minzoom: 0,

                maxzoom: 19,

                attribution:
                  '© OpenStreetMap contributors',
              },

              satarkSatellite: {
                type: 'raster',

                tiles: [
                  SATELLITE_TILES,
                ],

                tileSize: 256,

                minzoom: 0,

                maxzoom: 19,

                attribution:
                  '© Esri',
              },
            },

            layers: [
              {
                id:
                  'satarkOSM',

                type: 'raster',

                source:
                  'satarkOSM',

                paint: {
                  'raster-opacity':
                    1,

                  'raster-saturation':
                    -0.1,

                  'raster-contrast':
                    0.05,

                  'raster-brightness-min':
                    0.02,
                },
              },

              {
                id:
                  'satarkSatellite',

                type: 'raster',

                source:
                  'satarkSatellite',

                paint: {
                  'raster-opacity':
                    0,
                },
              },
            ],
          },
        })

      mapRef.current =
        map


      /* ====================================================
         CONTROLS
      ==================================================== */

      map.addControl(
        new maplibregl.NavigationControl(
          {
            showZoom: true,
            showCompass: true,
            visualizePitch: true,
          }
        ),
        'top-left'
      )

      map.addControl(
        new maplibregl.ScaleControl(
          {
            unit: 'metric',
            maxWidth: 120,
          }
        ),
        'bottom-left'
      )


      /* ====================================================
         MAP ERROR MONITOR

         NEVER THROW FROM HERE.
      ==================================================== */

      map.on(
        'error',
        event => {
          const message =
            event?.error?.message ||
            String(event?.error || '')

          /*
           * DEM failures are allowed.
           * The basemap must continue.
           */
          console.warn(
            'SATARK map resource:',
            message
          )
        }
      )


      /* ====================================================
         MAP LOAD

         THE BASE MAP IS NOW ALIVE.

         ONLY AFTER THIS DO WE TOUCH TERRAIN.
      ==================================================== */

      map.once(
        'load',
        async () => {
          setMapReady(true)

          /*
           * Force resize immediately.
           */
          try {
            map.resize()
          } catch {}


          /* =================================================
             3D TERRAIN

             AWS TERRARIUM
          ================================================= */

          try {
            if (
              !map.getSource(
                'satarkTerrain'
              )
            ) {
              map.addSource(
                'satarkTerrain',
                {
                  type: 'raster-dem',

                  tiles: [
                    TERRAIN_TILES,
                  ],

                  tileSize: 256,

                  minzoom: 0,

                  maxzoom: 15,

                  encoding:
                    'terrarium',

                  attribution:
                    'Elevation © AWS Open Data',
                }
              )
            }

            /*
             * Terrain is now optional.
             */
            map.setTerrain({
              source:
                'satarkTerrain',

              exaggeration:
                1.8,
            })

            setTerrainReady(true)

            console.log(
              'SATARK: 3D terrain enabled'
            )
          } catch (error) {
            /*
             * VERY IMPORTANT:
             *
             * Terrain failure must NEVER
             * destroy the map.
             */
            console.warn(
              'SATARK: terrain unavailable — keeping normal map',
              error
            )

            setTerrainReady(false)
          }


          /* =================================================
             HILLSHADE

             ALSO OPTIONAL.
          ================================================= */

          try {
            if (
              !map.getLayer(
                'satarkHillshade'
              )
            ) {
              map.addLayer({
                id:
                  'satarkHillshade',

                type:
                  'hillshade',

                source:
                  'satarkTerrain',

                paint: {
                  'hillshade-illumination-direction':
                    315,

                  'hillshade-exaggeration':
                    0.35,

                  'hillshade-shadow-color':
                    '#17221c',

                  'hillshade-highlight-color':
                    '#ffffff',
                },
              })
            }
          } catch (error) {
            console.warn(
              'SATARK hillshade unavailable:',
              error
            )
          }


          /* =================================================
             CAMERA
          ================================================= */

          try {
            const mountain =
              Number(
                selectedLocation.elevation ||
                  0
              ) >= 1200

            map.easeTo({
              pitch:
                mountain
                  ? 72
                  : 58,

              bearing:
                mountain
                  ? -30
                  : -12,

              duration:
                900,

              essential:
                true,
            })
          } catch {}


          /*
           * Multiple resize passes.
           */
          requestAnimationFrame(
            () => {
              try {
                map.resize()
              } catch {}
            }
          )

          setTimeout(
            () => {
              try {
                map.resize()
              } catch {}
            },
            250
          )

          setTimeout(
            () => {
              try {
                map.resize()
              } catch {}
            },
            800
          )
        }
      )
    } catch (error) {
      console.error(
        'SATARK MAP INITIALIZATION FAILED:',
        error
      )

      initializedRef.current =
        false
    }


    /* ======================================================
       RESIZE OBSERVER

       Fixes blank/grey map when:
       - fullscreen opens
       - browser resizes
       - responsive layout changes
       - DevTools changes width
    ====================================================== */

    if (
      typeof ResizeObserver !==
      'undefined' &&
      mapContainerRef.current
    ) {
      resizeObserverRef.current =
        new ResizeObserver(() => {
          try {
            map?.resize()
          } catch {}
        })

      resizeObserverRef.current.observe(
        mapContainerRef.current
      )
    }


    return () => {
      resizeObserverRef.current?.disconnect()

      resizeObserverRef.current =
        null

      destinationMarkerRef.current?.remove()

      safetyMarkersRef.current.forEach(
        marker =>
          marker.remove()
      )

      try {
        map?.remove()
      } catch {}

      mapRef.current =
        null

      initializedRef.current =
        false
    }
  }, [selectedLocation])


  /* ======================================================
     RESIZE WHEN FULLSCREEN CHANGES
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    const resize =
      () => {
        try {
          map.resize()
        } catch {}
      }

    requestAnimationFrame(
      resize
    )

    const timers = [
      setTimeout(resize, 100),
      setTimeout(resize, 400),
      setTimeout(resize, 900),
    ]

    window.addEventListener(
      'resize',
      resize
    )

    return () => {
      timers.forEach(
        clearTimeout
      )

      window.removeEventListener(
        'resize',
        resize
      )
    }
  }, [fullscreen])


  /* ======================================================
     DESTINATION CAMERA
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      !selectedLocation
    ) {
      return
    }

    try {
      map.flyTo({
        center: [
          selectedLocation.longitude,
          selectedLocation.latitude,
        ],

        zoom:
          Number(
            selectedLocation.elevation ||
              0
          ) >= 1200
            ? 12
            : 12.5,

        pitch:
          terrainEnabled &&
          terrainReady
            ? 64
            : 28,

        bearing:
          Number(
            selectedLocation.elevation ||
              0
          ) >= 1200
            ? -30
            : -10,

        duration: 1000,

        essential: true,
      })
    } catch {}
  }, [
    selectedLocation?.id,
    mapReady,
    terrainEnabled,
    terrainReady,
  ])


  /* ======================================================
     TERRAIN TOGGLE
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !terrainReady
    ) {
      return
    }

    try {
      map.setTerrain(
        terrainEnabled
          ? {
              source:
                'satarkTerrain',

              exaggeration:
                1.8,
            }
          : null
      )
    } catch (error) {
      console.warn(
        'SATARK terrain toggle failed:',
        error
      )
    }
  }, [
    terrainEnabled,
    terrainReady,
  ])


  /* ======================================================
     SATELLITE TOGGLE
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    try {
      if (
        map.getLayer(
          'satarkOSM'
        )
      ) {
        map.setPaintProperty(
          'satarkOSM',
          'raster-opacity',
          satelliteEnabled
            ? 0.08
            : 1
        )
      }

      if (
        map.getLayer(
          'satarkSatellite'
        )
      ) {
        map.setPaintProperty(
          'satarkSatellite',
          'raster-opacity',
          satelliteEnabled
            ? 1
            : 0
        )
      }
    } catch {}
  }, [
    satelliteEnabled,
  ])


  /* ======================================================
     HAZARD ZONE
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      !selectedLocation
    ) {
      return
    }

    try {
      const hazardData =
        createCircle(
          selectedLocation.longitude,
          selectedLocation.latitude,

          500 +
            hazardIndex * 32
        )

      const source =
        map.getSource(
          'satarkHazard'
        )

      if (source) {
        source.setData(
          hazardData
        )
      } else {
        map.addSource(
          'satarkHazard',
          {
            type: 'geojson',
            data: hazardData,
          }
        )
      }

      if (
        !map.getLayer(
          'satarkHazardFill'
        )
      ) {
        map.addLayer({
          id:
            'satarkHazardFill',

          type: 'fill',

          source:
            'satarkHazard',

          paint: {
            'fill-color':
              riskColor,

            'fill-opacity':
              0.17,
          },
        })
      }

      if (
        !map.getLayer(
          'satarkHazardOutline'
        )
      ) {
        map.addLayer({
          id:
            'satarkHazardOutline',

          type: 'line',

          source:
            'satarkHazard',

          paint: {
            'line-color':
              riskColor,

            'line-width':
              3,

            'line-opacity':
              0.85,

            'line-dasharray': [
              2,
              2,
            ],
          },
        })
      }
    } catch (error) {
      console.warn(
        'SATARK hazard layer failed:',
        error
      )
    }
  }, [
    mapReady,
    selectedLocation?.id,
    hazardIndex,
    riskColor,
  ])


  /* ======================================================
     HAZARD VISIBILITY
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    try {
      [
        'satarkHazardFill',
        'satarkHazardOutline',
      ].forEach(id => {
        if (
          map.getLayer(id)
        ) {
          map.setLayoutProperty(
            id,
            'visibility',
            showHazard
              ? 'visible'
              : 'none'
          )
        }
      })
    } catch {}
  }, [
    showHazard,
  ])


  /* ======================================================
     DESTINATION MARKER
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      !selectedLocation
    ) {
      return
    }

    destinationMarkerRef.current?.remove()

    const element =
      document.createElement(
        'div'
      )

    element.className =
      'satark-destination-marker'

    element.innerHTML = `
      <div
        class="satark-destination-pulse"
        style="--marker-color:${riskColor}"
      ></div>

      <div
        class="satark-destination-core"
        style="
          --marker-color:${riskColor};
          background:${riskColor};
        "
      >
        <span></span>
      </div>

      <div class="satark-destination-label">
        <small>SATARK DESTINATION</small>

        <strong>
          ${escapeHtml(
            selectedLocation.name
          )}
        </strong>

        <span>
          ${
            selectedLocation.elevation ||
            '--'
          } m
        </span>
      </div>
    `

    const marker =
      new maplibregl.Marker({
        element,

        anchor: 'center',

        pitchAlignment: 'map',

        rotationAlignment:
          'map',
      })
        .setLngLat([
          selectedLocation.longitude,
          selectedLocation.latitude,
        ])
        .addTo(map)

    destinationMarkerRef.current =
      marker

    return () => {
      marker.remove()
    }
  }, [
    mapReady,
    selectedLocation,
    riskColor,
  ])


  /* ======================================================
     SAFETY POINTS
  ====================================================== */

  useEffect(() => {
    if (
      !selectedLocation
    ) {
      return
    }

    let cancelled = false

    setSafetyLoading(true)

    setSafetyPoints([])

    setSelectedPoint(null)

    setSafetySource('')

    async function load() {
      const result =
        await loadSafetyPoints(
          selectedLocation
        )

      if (cancelled) {
        return
      }

      const ranked =
        rankSafetyPoints(
          result.points,
          selectedLocation,
          strategy,
          hazard
        )

      setSafetyPoints(
        ranked.slice(0, 6)
      )

      setSelectedPoint(
        ranked[0] || null
      )

      setSafetySource(
        result.source
      )

      setSafetyLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [
    selectedLocation?.id,
    selectedLocation?.latitude,
    selectedLocation?.longitude,
    hazard,
  ])


  /* ======================================================
     SAFETY MARKERS
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady
    ) {
      return
    }

    safetyMarkersRef.current.forEach(
      marker =>
        marker.remove()
    )

    safetyMarkersRef.current =
      []

    if (!showSafety) {
      return
    }

    safetyPoints
      .slice(0, 3)
      .forEach(
        (point, index) => {
          const element =
            document.createElement(
              'button'
            )

          element.type =
            'button'

          element.className =
            'satark-safety-marker'

          element.style.setProperty(
            '--point-color',
            point.color
          )

          const selected =
            recommendedPoint?.id ===
            point.id

          element.innerHTML = `
            <div class="satark-safe-pin">
              ${index + 1}
            </div>

            ${
              selected
                ? `
                  <div class="satark-safe-label">
                    <div class="satark-safe-kicker">
                      AI SAFE POINT
                    </div>

                    <strong>
                      ${escapeHtml(
                        point.name
                      )}
                    </strong>

                    <span>
                      ${point.distanceKm.toFixed(
                        1
                      )} km · ${
                        point.direction
                      }
                    </span>

                    <em>
                      AI ${point.aiScore}/100
                    </em>
                  </div>
                `
                : ''
            }
          `

          element.addEventListener(
            'click',
            event => {
              event.stopPropagation()

              setSelectedPoint(
                point
              )

              try {
                map.flyTo({
                  center: [
                    point.longitude,
                    point.latitude,
                  ],

                  zoom: 15,

                  pitch:
                    terrainEnabled &&
                    terrainReady
                      ? 70
                      : 35,

                  duration: 900,

                  essential: true,
                })
              } catch {}
            }
          )

          const marker =
            new maplibregl.Marker({
              element,

              anchor: 'center',

              pitchAlignment:
                'map',

              rotationAlignment:
                'map',
            })
              .setLngLat([
                point.longitude,
                point.latitude,
              ])
              .addTo(map)

          safetyMarkersRef.current.push(
            marker
          )
        }
      )

    return () => {
      safetyMarkersRef.current.forEach(
        marker =>
          marker.remove()
      )

      safetyMarkersRef.current =
        []
    }
  }, [
    mapReady,
    showSafety,
    safetyPoints,
    recommendedPoint?.id,
    terrainEnabled,
    terrainReady,
  ])


  /* ======================================================
     ROUTES
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (
      !map ||
      !mapReady ||
      !selectedLocation ||
      !safetyPoints.length
    ) {
      return
    }

    let cancelled = false

    async function buildRoutes() {
      const results = []

      for (
        const point of safetyPoints.slice(
          0,
          3
        )
      ) {
        if (cancelled) {
          return
        }

        const route =
          await getRoute(
            selectedLocation,
            point
          )

        if (route) {
          results.push({
            point,
            route,
          })
        }
      }

      if (cancelled) {
        return
      }

      setRoutes(results)

      try {
        const geojson = {
          type:
            'FeatureCollection',

          features:
            results.map(
              (
                item,
                index
              ) => ({
                type:
                  'Feature',

                properties: {
                  rank:
                    index + 1,
                },

                geometry:
                  item.route.geometry,
              })
            ),
        }

        const source =
          map.getSource(
            'satarkRoutes'
          )

        if (source) {
          source.setData(
            geojson
          )
        } else {
          map.addSource(
            'satarkRoutes',
            {
              type: 'geojson',
              data: geojson,
            }
          )
        }

        if (
          !map.getLayer(
            'satarkRoutesGlow'
          )
        ) {
          map.addLayer({
            id:
              'satarkRoutesGlow',

            type: 'line',

            source:
              'satarkRoutes',

            layout: {
              'line-cap':
                'round',

              'line-join':
                'round',
            },

            paint: {
              'line-color': [
                'match',
                [
                  'get',
                  'rank',
                ],

                1,
                '#34d399',

                2,
                '#facc15',

                '#c084fc',
              ],

              'line-width': [
                'match',
                [
                  'get',
                  'rank',
                ],

                1,
                10,

                2,
                7,

                5,
              ],

              'line-opacity':
                0.2,

              'line-blur':
                3,
            },
          })
        }

        if (
          !map.getLayer(
            'satarkRoutesMain'
          )
        ) {
          map.addLayer({
            id:
              'satarkRoutesMain',

            type: 'line',

            source:
              'satarkRoutes',

            layout: {
              'line-cap':
                'round',

              'line-join':
                'round',
            },

            paint: {
              'line-color': [
                'match',
                [
                  'get',
                  'rank',
                ],

                1,
                '#34d399',

                2,
                '#facc15',

                '#c084fc',
              ],

              'line-width': [
                'match',
                [
                  'get',
                  'rank',
                ],

                1,
                4,

                2,
                3,

                2.5,
              ],

              'line-opacity':
                0.95,
            },
          })
        }
      } catch (error) {
        console.warn(
          'SATARK routes unavailable:',
          error
        )
      }
    }

    buildRoutes()

    return () => {
      cancelled = true
    }
  }, [
    mapReady,
    selectedLocation?.id,
    safetyPoints,
  ])


  /* ======================================================
     ROUTE VISIBILITY
  ====================================================== */

  useEffect(() => {
    const map =
      mapRef.current

    if (!map) {
      return
    }

    try {
      [
        'satarkRoutesGlow',
        'satarkRoutesMain',
      ].forEach(id => {
        if (
          map.getLayer(id)
        ) {
          map.setLayoutProperty(
            id,
            'visibility',
            showRoutes
              ? 'visible'
              : 'none'
          )
        }
      })
    } catch {}
  }, [
    showRoutes,
    routes,
  ])


  /* ======================================================
     LOCATION SWITCH
  ====================================================== */

  function switchLocation(
    location
  ) {
    setSelectedLocation(
      location
    )

    setSafetyPoints([])

    setSelectedPoint(null)

    setRoutes([])

    setSafetySource('')

    /*
     * Keep 3D enabled by default.
     */
    setTerrainEnabled(true)
  }


  /* ======================================================
     NAVIGATION
  ====================================================== */

  function navigateToSafePoint() {
    if (!recommendedPoint) {
      return
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${recommendedPoint.latitude},${recommendedPoint.longitude}`,
      '_blank',
      'noopener,noreferrer'
    )
  }


  /* ======================================================
     EMPTY STATE
  ====================================================== */

  if (!locations.length) {
    return (
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#040709]">
        <div className="flex min-h-[700px] flex-col items-center justify-center">
          <MapPinned
            size={40}
            className="text-white/20"
          />

          <div className="mt-4 text-sm font-black text-white/60">
            No SATARK destination available
          </div>

          <div className="mt-2 text-xs text-white/25">
            Analyze a destination first.
          </div>
        </div>
      </section>
    )
  }


  /* ======================================================
     MAIN UI
  ====================================================== */

  return (
    <section
      className={
        fullscreen
          ? 'fixed inset-0 z-[100] bg-[#040709]'
          : 'overflow-hidden rounded-2xl border border-white/10 bg-[#040709]'
      }
    >

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="flex flex-col gap-4 border-b border-white/10 bg-[#05080b]/95 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">

        <div>
          <div className="flex items-center gap-2">

            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <Mountain
                size={14}
                className="text-emerald-400"
              />
            </div>

            <span className="text-[10px] font-black uppercase tracking-[.22em] text-white/40">
              SATARK 3D GEO-INTELLIGENCE
            </span>

          </div>

          <div className="mt-2 text-xl font-black text-white">
            {selectedLocation.name}
          </div>

          <div className="mt-1 text-[9px] uppercase tracking-[.15em] text-white/25">
            {selectedLocation.latitude.toFixed(
              5
            )}

            {' • '}

            {selectedLocation.longitude.toFixed(
              5
            )}

            {' • REAL COORDINATES'}
          </div>
        </div>


        <div className="flex flex-wrap items-center gap-2">

          <Metric
            label="Risk Index"
            value={`${riskScore}/100`}
          />

          <Metric
            label="Elevation"
            value={`${selectedLocation.elevation || '--'} m`}
          />

          <Metric
            label="Hazard"
            value={hazard}
          />

          <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 px-3 py-2">

            <div className="text-[7px] font-bold uppercase tracking-[.14em] text-white/25">
              MAP MODE
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-[11px] font-black text-blue-300">

              <Mountain
                size={12}
              />

              {terrainReady &&
              terrainEnabled
                ? '3D TERRAIN'
                : 'REAL MAP'}

            </div>
          </div>


          <button
            type="button"
            onClick={() =>
              setFullscreen(
                value =>
                  !value
              )
            }
            className="rounded-xl border border-white/10 bg-white/5 p-3 text-white/50 hover:bg-white/10 hover:text-white"
          >
            {fullscreen ? (
              <Minimize2
                size={15}
              />
            ) : (
              <Maximize2
                size={15}
              />
            )}
          </button>

        </div>
      </div>


      {/* ==================================================
          MAP
      ================================================== */}

      <div
        className={
          fullscreen
            ? 'relative h-[calc(100vh-88px)] w-full overflow-hidden'
            : 'relative h-[720px] w-full overflow-hidden'
        }
      >

        {/* ACTUAL MAP */}

        <div
          ref={
            mapContainerRef
          }
          className="absolute inset-0"
          style={{
            width: '100%',
            height: '100%',
            background:
              '#aebeb7',
          }}
        />


        {/* MAP GRADING */}

        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/5 via-transparent to-black/35" />

        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,.20)_100%)]" />


        {/* =================================================
            HAZARD PANEL
        ================================================= */}

        <div className="absolute left-4 top-4 z-50 w-[290px] rounded-2xl border border-white/10 bg-[#050807]/96 p-4 shadow-2xl backdrop-blur-xl">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <AlertTriangle
                size={14}
                className="text-amber-400"
              />

              <span className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">
                ACTIVE HAZARD
              </span>

            </div>

            <span
              className="text-sm font-black"
              style={{
                color:
                  riskColor,
              }}
            >
              {hazardIndex}/100
            </span>

          </div>


          <div className="mt-3 text-xl font-black text-white">
            {hazard}
          </div>


          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">

            <div
              className="h-full rounded-full"
              style={{
                width:
                  `${clamp(
                    hazardIndex,
                    0,
                    100
                  )}%`,

                background:
                  riskColor,
              }}
            />

          </div>


          <div className="mt-4 grid grid-cols-2 gap-2">

            <Metric
              label="Risk"
              value={`${riskScore}/100`}
            />

            <Metric
              label="Elevation"
              value={`${selectedLocation.elevation || '--'} m`}
            />

          </div>


          <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/5 p-3">

            <div className="text-[7px] font-black uppercase tracking-[.16em] text-amber-300/70">
              AI RESPONSE STRATEGY
            </div>

            <div className="mt-1 text-[9px] font-black leading-4 text-white/80">
              {strategy.title}
            </div>

            <div className="mt-1 text-[8px] leading-4 text-white/30">
              {strategy.description}
            </div>

            <div className="mt-2 text-[7px] leading-3 text-white/20">
              {strategy.avoid}
            </div>

          </div>

        </div>


        {/* =================================================
            SAFE NAVIGATION
        ================================================= */}

        <div className="absolute right-4 top-4 z-50 w-[340px] rounded-2xl border border-emerald-400/15 bg-[#06100b]/96 p-4 shadow-2xl backdrop-blur-xl">

          <div className="flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/10">

              <ShieldCheck
                size={16}
                className="text-emerald-400"
              />

            </div>

            <div>

              <div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">
                SATARK SAFE NAVIGATION
              </div>

              <div className="text-[7px] text-white/25">
                AI-ranked geographic safety points
              </div>

            </div>

          </div>


          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 bg-white/[.025] px-3 py-2.5">

            <div>

              <div className="text-[8px] font-black text-white/70">
                Show AI Safety Points
              </div>

              <div className="mt-0.5 text-[7px] text-white/25">
                Anchored to real coordinates
              </div>

            </div>


            <button
              type="button"
              onClick={() =>
                setShowSafety(
                  value =>
                    !value
                )
              }
              className={`relative h-5 w-9 rounded-full ${
                showSafety
                  ? 'bg-emerald-400'
                  : 'bg-white/10'
              }`}
            >

              <span
                className={`absolute top-1 h-3 w-3 rounded-full bg-white ${
                  showSafety
                    ? 'left-5'
                    : 'left-1'
                }`}
              />

            </button>

          </div>


          <div className="mt-4 flex items-center justify-between">

            <div className="text-[7px] font-black uppercase tracking-[.16em] text-white/25">
              AI SAFETY RECOMMENDATIONS
            </div>

            <div className="rounded-full bg-emerald-400/10 px-2 py-1 text-[6px] font-black uppercase tracking-widest text-emerald-300">
              {safetyPoints.length}{' '}
              FOUND
            </div>

          </div>


          {safetyLoading ? (

            <div className="mt-3 rounded-xl border border-white/5 bg-white/[.025] p-4">

              <div className="flex items-center gap-2">

                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                <span className="text-[9px] font-bold text-white/60">
                  Finding geographic safety points...
                </span>

              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">

                <div className="h-full w-1/2 animate-pulse rounded-full bg-emerald-400" />

              </div>

            </div>

          ) : safetyPoints.length ? (

            <div className="mt-3 space-y-2">

              {safetyPoints
                .slice(0, 3)
                .map(point => (

                  <button
                    key={
                      point.id
                    }
                    type="button"
                    onClick={() => {

                      setSelectedPoint(
                        point
                      )

                      try {
                        mapRef.current?.flyTo(
                          {
                            center: [
                              point.longitude,
                              point.latitude,
                            ],

                            zoom: 15,

                            pitch:
                              terrainEnabled &&
                              terrainReady
                                ? 70
                                : 32,

                            duration:
                              900,

                            essential:
                              true,
                          }
                        )
                      } catch {}

                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      recommendedPoint?.id ===
                      point.id
                        ? 'border-emerald-400/30 bg-emerald-400/10'
                        : 'border-white/5 bg-white/[.025]'
                    }`}
                  >

                    <div className="flex items-center justify-between gap-3">

                      <div className="flex min-w-0 items-center gap-2">

                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            color:
                              point.color,

                            background:
                              `${point.color}18`,
                          }}
                        >
                          {point.type ===
                          'hospital' ? (
                            <Hospital
                              size={14}
                            />
                          ) : point.type ===
                            'police' ? (
                            <Siren
                              size={14}
                            />
                          ) : point.type ===
                            'fire' ? (
                            <Flame
                              size={14}
                            />
                          ) : (
                            <ShieldCheck
                              size={14}
                            />
                          )}
                        </div>


                        <div className="min-w-0">

                          <div className="truncate text-[8px] font-black text-white/80">
                            {point.name}
                          </div>

                          <div
                            className="mt-0.5 text-[6px] font-black"
                            style={{
                              color:
                                point.color,
                            }}
                          >
                            {point.label}
                          </div>

                        </div>

                      </div>


                      <div className="shrink-0 text-right">

                        <div className="text-sm font-black text-emerald-400">
                          {point.aiScore}/100
                        </div>

                        <div className="text-[5px] uppercase tracking-widest text-white/20">
                          AI SCORE
                        </div>

                      </div>

                    </div>


                    <div className="mt-2 text-[7px] text-white/25">

                      {point.distanceKm.toFixed(
                        1
                      )}

                      {' km · '}

                      {point.direction}

                    </div>

                  </button>

                ))}

            </div>

          ) : (

            <div className="mt-3 rounded-xl border border-white/5 bg-white/[.025] p-3">

              <div className="text-[9px] font-bold text-white/55">
                No mapped response facility found nearby.
              </div>

              <div className="mt-1 text-[7px] leading-4 text-white/25">
                The real geographic map remains operational.
              </div>

            </div>

          )}


          {safetySource &&
            safetyPoints.length > 0 && (

              <div className="mt-2 text-[6px] font-black uppercase tracking-[.14em] text-white/15">
                DATA: {safetySource}
              </div>

            )}


          <button
            type="button"
            disabled={
              !recommendedPoint
            }
            onClick={
              navigateToSafePoint
            }
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-3 text-[8px] font-black uppercase tracking-widest text-emerald-300 disabled:opacity-20"
          >

            <Navigation
              size={12}
            />

            Navigate to Safest Point

          </button>

        </div>


        {/* =================================================
            MAP LAYERS
        ================================================= */}

        <div className="absolute right-4 top-[425px] z-50 rounded-2xl border border-white/10 bg-black/90 p-2 backdrop-blur-xl">

          <div className="mb-2 px-2 text-[7px] font-black uppercase tracking-[.16em] text-white/20">
            MAP LAYERS
          </div>


          <button
            type="button"
            onClick={() =>
              setShowHazard(
                value =>
                  !value
              )
            }
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase ${
              showHazard
                ? 'bg-amber-400/10 text-amber-300'
                : 'text-white/25'
            }`}
          >

            <AlertTriangle
              size={11}
            />

            Hazard Zone

          </button>


          <button
            type="button"
            onClick={() =>
              setShowSafety(
                value =>
                  !value
              )
            }
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase ${
              showSafety
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'text-white/25'
            }`}
          >

            <ShieldCheck
              size={11}
            />

            AI Safe Points

          </button>


          <button
            type="button"
            onClick={() =>
              setShowRoutes(
                value =>
                  !value
              )
            }
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase ${
              showRoutes
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'text-white/25'
            }`}
          >

            <Navigation
              size={11}
            />

            Safe Routes

          </button>


          <button
            type="button"
            onClick={() =>
              setTerrainEnabled(
                value =>
                  !value
              )
            }
            disabled={
              !terrainReady
            }
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase ${
              terrainReady &&
              terrainEnabled
                ? 'bg-blue-400/10 text-blue-300'
                : 'text-white/25'
            }`}
          >

            <Mountain
              size={11}
            />

            {terrainReady
              ? '3D Terrain'
              : '3D Loading...'}

          </button>


          <button
            type="button"
            onClick={() =>
              setSatelliteEnabled(
                value =>
                  !value
              )
            }
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase ${
              satelliteEnabled
                ? 'bg-white/10 text-white'
                : 'text-white/25'
            }`}
          >

            <MapPinned
              size={11}
            />

            Satellite

          </button>

        </div>


        {/* =================================================
            RISK LEGEND
        ================================================= */}

        <div className="absolute bottom-5 left-4 z-50 rounded-2xl border border-white/10 bg-black/90 p-3 backdrop-blur-xl">

          <div className="mb-2 text-[7px] font-black uppercase tracking-[.16em] text-white/25">
            SATARK RISK INDEX
          </div>

          <div className="h-2 w-[265px] rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 to-red-500" />

          <div className="mt-1 flex justify-between text-[6px] font-black text-white/25">

            <span>
              0–20
            </span>

            <span>
              20–40
            </span>

            <span>
              40–60
            </span>

            <span>
              60–80
            </span>

            <span>
              80–100
            </span>

          </div>

          <div className="mt-1 text-[6px] font-black uppercase tracking-widest text-white/20">
            {riskLabel}
          </div>

        </div>


        {/* =================================================
            ROUTE LEGEND
        ================================================= */}

        <div className="absolute bottom-5 left-[285px] z-50 hidden rounded-2xl border border-white/10 bg-black/90 p-3 backdrop-blur-xl xl:block">

          <div className="mb-2 text-[7px] font-black uppercase tracking-[.16em] text-white/25">
            SAFE ROUTE RANKING
          </div>

          <div className="space-y-2">

            <div className="flex items-center gap-2">

              <span className="h-1.5 w-8 rounded-full bg-emerald-400" />

              <span className="text-[7px] font-bold text-white/50">
                SAFEST
              </span>

            </div>


            <div className="flex items-center gap-2">

              <span className="h-1.5 w-8 rounded-full bg-yellow-400" />

              <span className="text-[7px] font-bold text-white/40">
                ALTERNATIVE
              </span>

            </div>


            <div className="flex items-center gap-2">

              <span className="h-1.5 w-8 rounded-full bg-purple-400" />

              <span className="text-[7px] font-bold text-white/40">
                SECONDARY
              </span>

            </div>

          </div>

        </div>


        {/* =================================================
            DESTINATION SWITCHER
        ================================================= */}

        <div className="absolute bottom-5 left-1/2 z-[70] -translate-x-1/2">

          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/94 px-3 py-2.5 shadow-2xl backdrop-blur-xl">

            <LocateFixed
              size={12}
              className="text-emerald-400"
            />

            <select
              value={
                selectedLocation.id
              }
              onChange={event => {

                const next =
                  locations.find(
                    location =>
                      location.id ===
                      event.target.value
                  )

                if (next) {
                  switchLocation(
                    next
                  )
                }

              }}
              className="max-w-[190px] bg-transparent text-[9px] font-black text-white outline-none"
            >

              {locations.map(
                location => (

                  <option
                    key={
                      location.id
                    }
                    value={
                      location.id
                    }
                    className="bg-black"
                  >
                    {
                      location.name
                    }
                  </option>

                )
              )}

            </select>


            <span className="h-3 w-px bg-white/10" />


            <span className="text-[7px] font-black uppercase tracking-[.14em] text-blue-300/70">

              {terrainReady &&
              terrainEnabled
                ? '3D TERRAIN'
                : 'REAL MAP'}

            </span>

          </div>

        </div>


        {/* =================================================
            LIVE STATUS
        ================================================= */}

        <div className="absolute bottom-5 right-4 z-50">

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/90 px-3 py-2 backdrop-blur-xl">

            <span
              className={`h-1.5 w-1.5 rounded-full ${
                terrainReady &&
                terrainEnabled
                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]'
                  : 'bg-sky-400'
              }`}
            />

            <span className="text-[7px] font-black uppercase tracking-[.14em] text-white/45">

              {terrainReady &&
              terrainEnabled
                ? 'LIVE 3D TERRAIN'
                : 'LIVE GEOGRAPHIC MAP'}

            </span>

          </div>

        </div>

      </div>


      {/* ==================================================
          FOOTER
      ================================================== */}

      <div className="border-t border-white/10 bg-black/20 px-5 py-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <MapPinned
              size={13}
              className="text-white/30"
            />

            <span className="text-xs font-bold text-white/70">
              SATARK destinations
            </span>

            <span className="text-[8px] text-white/20">
              {locations.length}
            </span>

          </div>


          <span className="text-[7px] font-black uppercase tracking-[.15em] text-white/20">
            DYNAMIC GEOSPATIAL INTELLIGENCE
          </span>

        </div>


        <div className="mt-3 flex flex-wrap gap-2">

          {locations.map(
            location => {

              const active =
                location.id ===
                selectedLocation.id

              const color =
                getRiskColor(
                  location.riskScore
                )

              return (
                <button
                  key={
                    location.id
                  }
                  type="button"
                  onClick={() =>
                    switchLocation(
                      location
                    )
                  }
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                    active
                      ? 'border-white/20 bg-white/[.08]'
                      : 'border-white/5 bg-white/[.025] hover:bg-white/[.06]'
                  }`}
                >

                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        color,
                    }}
                  />

                  <span className="text-[8px] font-bold text-white/60">
                    {
                      location.name
                    }
                  </span>

                  <span
                    className="text-[8px] font-black"
                    style={{
                      color,
                    }}
                  >
                    {
                      location.riskScore
                    }
                  </span>

                </button>
              )
            }
          )}

        </div>

      </div>


      {/* ==================================================
          MAP CSS
      ================================================== */}

      <style>
        {`

          .maplibregl-map {
            width: 100% !important;
            height: 100% !important;
            font-family: inherit;
          }

          .maplibregl-canvas {
            outline: none;
          }

          .maplibregl-ctrl-group {
            overflow: hidden;
            border: 1px solid rgba(255,255,255,.10) !important;
            background: rgba(0,0,0,.82) !important;
            box-shadow: 0 12px 35px rgba(0,0,0,.35) !important;
          }

          .maplibregl-ctrl-group button {
            width: 32px !important;
            height: 32px !important;
            background-color: transparent !important;
          }

          .maplibregl-ctrl-group button:hover {
            background: rgba(255,255,255,.08) !important;
          }

          .maplibregl-ctrl-icon {
            filter:
              invert(1)
              brightness(1.6);
          }

          .maplibregl-ctrl-attrib {
            background: rgba(0,0,0,.72) !important;
            color: rgba(255,255,255,.45) !important;
            font-size: 8px !important;
          }

          .maplibregl-ctrl-attrib a {
            color: rgba(255,255,255,.60) !important;
          }


          /* DESTINATION */

          .satark-destination-marker {
            position: relative;
            width: 26px;
            height: 26px;
            pointer-events: none;
          }

          .satark-destination-pulse {
            position: absolute;
            inset: -13px;
            border-radius: 999px;
            border: 1px solid var(--marker-color);
            opacity: .35;
            animation:
              satarkPulse 2s infinite;
          }

          .satark-destination-core {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 16px;
            height: 16px;
            transform:
              translate(-50%, -50%);
            border-radius: 999px;
            border:
              3px solid rgba(255,255,255,.9);
            box-shadow:
              0 0 25px
              var(--marker-color);
          }

          .satark-destination-core span {
            position: absolute;
            inset: 3px;
            border-radius: 999px;
            background: rgba(0,0,0,.35);
          }

          .satark-destination-label {
            position: absolute;
            left: 22px;
            top: -8px;
            min-width: 150px;
            padding:
              7px 9px;
            border-radius: 9px;
            background:
              rgba(3,7,6,.92);
            border:
              1px solid rgba(255,255,255,.10);
            box-shadow:
              0 10px 30px
              rgba(0,0,0,.35);
            backdrop-filter:
              blur(10px);
          }

          .satark-destination-label small {
            display: block;
            color:
              rgba(255,255,255,.30);
            font-size: 6px;
            font-weight: 900;
            letter-spacing: .15em;
          }

          .satark-destination-label strong {
            display: block;
            margin-top: 2px;
            color: white;
            font-size: 9px;
            font-weight: 900;
          }

          .satark-destination-label span {
            display: block;
            margin-top: 2px;
            color:
              rgba(255,255,255,.35);
            font-size: 6px;
            font-weight: 700;
          }


          /* SAFETY MARKERS */

          .satark-safety-marker {
            position: relative;
            width: 32px;
            height: 32px;
            border: 0;
            padding: 0;
            background: transparent;
            cursor: pointer;
          }

          .satark-safe-pin {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background:
              rgba(4,16,11,.96);
            border:
              2px solid var(--point-color);
            color:
              var(--point-color);
            font-size: 9px;
            font-weight: 900;
            box-shadow:
              0 0 18px
              color-mix(
                in srgb,
                var(--point-color) 45%,
                transparent
              );
          }

          .satark-safe-label {
            position: absolute;
            left: 28px;
            top: -18px;
            width: 170px;
            padding: 8px;
            border-radius: 10px;
            background:
              rgba(3,9,7,.95);
            border:
              1px solid
              rgba(52,211,153,.22);
            box-shadow:
              0 12px 30px
              rgba(0,0,0,.4);
            text-align: left;
            backdrop-filter:
              blur(10px);
          }

          .satark-safe-kicker {
            color: #34d399;
            font-size: 6px;
            font-weight: 900;
            letter-spacing: .15em;
          }

          .satark-safe-label strong {
            display: block;
            margin-top: 3px;
            color: rgba(255,255,255,.85);
            font-size: 8px;
            line-height: 12px;
          }

          .satark-safe-label span {
            display: block;
            margin-top: 3px;
            color: rgba(255,255,255,.35);
            font-size: 6px;
          }

          .satark-safe-label em {
            display: block;
            margin-top: 4px;
            color: #34d399;
            font-size: 7px;
            font-style: normal;
            font-weight: 900;
          }


          @keyframes satarkPulse {
            0% {
              transform: scale(.65);
              opacity: .65;
            }

            70% {
              transform: scale(1.2);
              opacity: 0;
            }

            100% {
              transform: scale(1.2);
              opacity: 0;
            }
          }

        `}
      </style>

    </section>
  )
}