import { useEffect, useMemo, useState } from 'react'

import {
  AlertTriangle,
  LocateFixed,
  MapPinned,
  Maximize2,
  Minimize2,
  Navigation,
  Route,
  ShieldCheck,
} from 'lucide-react'

/* =========================================================
   CONFIG
========================================================= */

const CACHE_KEY =
  'satark_location_cache'

const OSM_EMBED_URL =
  'https://www.openstreetmap.org/export/embed.html'

/* =========================================================
   HELPERS
========================================================= */

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(max, value)
  )
}

function getRiskColor(
  score
) {
  if (score >= 80) {
    return '#ef4444'
  }

  if (score >= 60) {
    return '#f97316'
  }

  if (score >= 40) {
    return '#eab308'
  }

  if (score >= 20) {
    return '#84cc16'
  }

  return '#22c55e'
}

function getRiskLabel(
  score
) {
  if (score >= 80) {
    return 'VERY HIGH'
  }

  if (score >= 60) {
    return 'HIGH'
  }

  if (score >= 40) {
    return 'MODERATE'
  }

  if (score >= 20) {
    return 'LOW'
  }

  return 'VERY LOW'
}

function normalizeHazard(
  value
) {
  const text =
    String(
      value || ''
    ).toLowerCase()

  if (
    text.includes(
      'landslide'
    ) ||
    text.includes(
      'avalanche'
    )
  ) {
    return 'Landslide'
  }

  if (
    text.includes(
      'flood'
    )
  ) {
    return 'Flood'
  }

  if (
    text.includes(
      'wildfire'
    ) ||
    text.includes(
      'forest fire'
    )
  ) {
    return 'Wildfire'
  }

  if (
    text.includes(
      'heat'
    ) ||
    text.includes(
      'hot wave'
    )
  ) {
    return 'Extreme Heat'
  }

  if (
    text.includes(
      'storm'
    ) ||
    text.includes(
      'cyclone'
    ) ||
    text.includes(
      'thunder'
    )
  ) {
    return 'Storm'
  }

  return 'General Risk'
}

/* =========================================================
   LOAD SATARK LOCATIONS
========================================================= */

function loadSavedLocations() {
  try {
    const raw =
      localStorage.getItem(
        CACHE_KEY
      )

    if (!raw) {
      return []
    }

    const cache =
      JSON.parse(raw)

    return Object.entries(cache)
      .map(
        ([
          key,
          entry,
        ]) => {
          const location =
            entry?.data
              ?.location

          if (!location) {
            return null
          }

          const coordinates =
            location.coordinates ||
            []

          const latitude =
            Number(
              coordinates[0]
            )

          const longitude =
            Number(
              coordinates[1]
            )

          if (
            !Number.isFinite(
              latitude
            ) ||
            !Number.isFinite(
              longitude
            )
          ) {
            return null
          }

          const data =
            entry?.data ||
            {}

          const risk =
            data?.risk ||
            {}

          const factors =
            risk?.factors ||
            {}

          const candidates =
            [
              {
                name:
                  'Flood',

                score:
                  Number(
                    factors
                      ?.rain
                      ?.score ||
                      0
                  ),
              },

              {
                name:
                  'Landslide',

                score:
                  Number(
                    factors
                      ?.landslide_trigger
                      ?.score ||
                      0
                  ),
              },

              {
                name:
                  'Storm',

                score:
                  Number(
                    factors
                      ?.wind
                      ?.score ||
                      0
                  ),
              },

              {
                name:
                  'Extreme Heat',

                score:
                  Number(
                    factors
                      ?.temperature
                      ?.score ||
                      0
                  ),
              },
            ]

          candidates.sort(
            (a, b) =>
              b.score -
              a.score
          )

          const inferredHazard =
            candidates[0]
              ?.score > 0
              ? candidates[0]
                  .name
              : location
                  ?.dominantHazard ||
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
                  risk.score ??
                  0
              ),

            dominantHazard:
              normalizeHazard(
                inferredHazard
              ),

            elevation:
              Number(
                location.elevation ??
                  0
              ),

            savedAt:
              Number(
                entry?.savedAt ||
                  0
              ),
          }
        }
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.savedAt -
          a.savedAt
      )
  } catch (
    error
  ) {
    console.error(
      'SATARK cache error:',
      error
    )

    return []
  }
}

/* =========================================================
   OSM MAP URL
========================================================= */

function createOSMUrl(
  latitude,
  longitude
) {
  /*
   * Slightly wider bbox so the map looks better
   * in the dashboard card.
   */

  const longitudeDelta =
    0.04

  const latitudeDelta =
    0.031

  const minLon =
    longitude -
    longitudeDelta

  const maxLon =
    longitude +
    longitudeDelta

  const minLat =
    latitude -
    latitudeDelta

  const maxLat =
    latitude +
    latitudeDelta

  return (
    `${OSM_EMBED_URL}` +
    `?bbox=${encodeURIComponent(
      `${minLon},${minLat},${maxLon},${maxLat}`
    )}` +
    `&layer=mapnik` +
    `&marker=${encodeURIComponent(
      `${latitude},${longitude}`
    )}`
  )
}

/* =========================================================
   METRIC
========================================================= */

function Metric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/75 px-3 py-2 backdrop-blur-xl">
      <div className="text-[7px] font-bold uppercase tracking-[.15em] text-white/25">
        {label}
      </div>

      <div className="mt-1 text-[11px] font-black text-white">
        {value}
      </div>
    </div>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function RiskMap3D() {
  const [
    locations,
    setLocations,
  ] = useState([])

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState(null)

  const [
    fullscreen,
    setFullscreen,
  ] = useState(false)

  const [
    showHazard,
    setShowHazard,
  ] = useState(true)

  const [
    camera3D,
    setCamera3D,
  ] = useState(true)

  /* =======================================================
     LOAD DESTINATIONS
  ======================================================= */

  useEffect(() => {
    function refresh() {
      const saved =
        loadSavedLocations()

      setLocations(
        saved
      )

      setSelectedLocation(
        current => {
          if (
            !current &&
            saved.length
          ) {
            return saved[0]
          }

          if (
            current
          ) {
            return (
              saved.find(
                item =>
                  item.id ===
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
        2000
      )

    return () =>
      window.clearInterval(
        interval
      )
  }, [])

  /* =======================================================
     OSM URL
  ======================================================= */

  const mapUrl =
    useMemo(() => {
      if (
        !selectedLocation
      ) {
        return ''
      }

      return createOSMUrl(
        selectedLocation.latitude,
        selectedLocation.longitude
      )
    }, [
      selectedLocation,
    ])

  /* =======================================================
     SELECT LOCATION
  ======================================================= */

  function selectLocation(
    location
  ) {
    setSelectedLocation(
      location
    )
  }

  /* =======================================================
     EMPTY STATE
  ======================================================= */

  if (
    !locations.length
  ) {
    return (
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#05070b]">
        <div className="flex min-h-[620px] flex-col items-center justify-center text-center">
          <MapPinned
            size={40}
            className="text-white/20"
          />

          <div className="mt-4 text-sm font-bold text-white/60">
            No SATARK destination
          </div>

          <div className="mt-2 max-w-md text-xs leading-5 text-white/30">
            Search for a destination
            from the SATARK dashboard
            first.
          </div>
        </div>
      </section>
    )
  }

  /* =======================================================
     DATA
  ======================================================= */

  const riskScore =
    Number(
      selectedLocation
        ?.riskScore ||
        0
    )

  const hazardIndex =
    Number(
      selectedLocation
        ?.hazardIndex ||
        riskScore
    )

  const hazard =
    normalizeHazard(
      selectedLocation
        ?.dominantHazard
    )

  const color =
    getRiskColor(
      riskScore
    )

  const label =
    getRiskLabel(
      riskScore
    )

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <section
      className={
        fullscreen
          ? 'fixed inset-0 z-[100] bg-[#05070b]'
          : 'overflow-hidden rounded-2xl border border-white/10 bg-[#05070b]'
      }
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 border-b border-white/10 bg-black/30 px-5 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10">
              <MapPinned
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

          <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-white/25">
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

        <div className="flex items-center gap-5">
          <div className="text-right">
            <div
              className="text-2xl font-black"
              style={{
                color,
              }}
            >
              {riskScore}/100
            </div>

            <div className="text-[8px] font-black uppercase tracking-[.18em] text-white/30">
              {label}
            </div>
          </div>

          <div className="h-9 w-px bg-white/10" />

          <div>
            <div className="text-[8px] font-bold uppercase tracking-[.16em] text-white/25">
              DOMINANT HAZARD
            </div>

            <div
              className="mt-1 text-xs font-black"
              style={{
                color,
              }}
            >
              {hazard}
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
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-white/50 transition hover:bg-white/10 hover:text-white"
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

      {/* =================================================
          MAP AREA
      ================================================= */}

      <div
        className={
          fullscreen
            ? 'relative h-[calc(100vh-82px)] w-full overflow-hidden'
            : 'relative h-[690px] w-full overflow-hidden'
        }
      >
        {/* =================================================
            REAL OPENSTREETMAP
        ================================================= */}

        <div
          className={`absolute inset-0 overflow-hidden bg-[#d8e1dc] transition-all duration-700 ${
            camera3D
              ? 'satark-map-3d'
              : ''
          }`}
        >
          <iframe
            key={mapUrl}
            title={`SATARK map of ${selectedLocation.name}`}
            src={mapUrl}
            className="absolute inset-[-7%] h-[114%] w-[114%] border-0"
            loading="eager"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* =================================================
            CINEMATIC MAP TREATMENT
        ================================================= */}

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/10 via-transparent to-black/55" />

        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.42)_100%)]" />

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-20 bg-gradient-to-b from-black/30 to-transparent" />

        {/* =================================================
            HAZARD GLOW
        ================================================= */}

        {showHazard && (
          <div
            className="pointer-events-none absolute z-20 rounded-full"
            style={{
              left: '50%',
              top: '50%',
              width:
                `${150 + hazardIndex * 2.2}px`,
              height:
                `${150 + hazardIndex * 2.2}px`,
              transform:
                'translate(-50%, -50%)',
              border:
                `2px solid ${color}`,
              background:
                `${color}18`,
              boxShadow:
                `0 0 0 14px ${color}08,
                 0 0 45px ${color}35`,
            }}
          />
        )}

        {/* =================================================
            CENTRAL SATARK DESTINATION
        ================================================= */}

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <div
            className="satark-location-pulse"
            style={{
              borderColor:
                color,
            }}
          />

          <div
            className="satark-location-core"
            style={{
              background:
                color,

              boxShadow:
                `0 0 0 6px ${color}22,
                 0 0 35px ${color}aa`,
            }}
          />

          <div className="satark-location-card">
            <div className="text-[6px] font-black uppercase tracking-[.16em] text-white/30">
              SATARK DESTINATION
            </div>

            <div className="mt-1 text-[9px] font-black text-white">
              {selectedLocation.name}
            </div>
          </div>
        </div>

        {/* =================================================
            TOP METRICS
        ================================================= */}

        <div className="absolute left-1/2 top-4 z-30 hidden -translate-x-1/2 lg:block">
          <div className="flex gap-2">
            <Metric
              label="Risk"
              value={`${riskScore}/100`}
            />

            <Metric
              label="Hazard"
              value={`${hazardIndex}/100`}
            />

            <Metric
              label="Elevation"
              value={`${selectedLocation.elevation || '--'}m`}
            />

            <Metric
              label="Map"
              value="LIVE"
            />
          </div>
        </div>

        {/* =================================================
            HAZARD PANEL
        ================================================= */}

        <div className="absolute left-4 top-4 z-30 w-[260px] rounded-2xl border border-white/10 bg-[#070909]/90 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={14}
              className="text-amber-400"
            />

            <span className="text-[9px] font-black uppercase tracking-[.18em] text-amber-300">
              ACTIVE HAZARD
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div className="text-lg font-black text-white">
              {hazard}
            </div>

            <div
              className="text-sm font-black"
              style={{
                color,
              }}
            >
              {hazardIndex}/100
            </div>
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
                  color,
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric
              label="Risk Score"
              value={
                `${riskScore}/100`
              }
            />

            <Metric
              label="Elevation"
              value={
                `${selectedLocation.elevation || '--'}m`
              }
            />
          </div>

          <div className="mt-3 text-[8px] leading-4 text-white/30">
            The hazard visualization
            is centered on the selected
            destination's actual
            coordinates.
          </div>
        </div>

        {/* =================================================
            SAFE NAVIGATION
        ================================================= */}

        <div className="absolute right-4 top-4 z-30 w-[300px] rounded-2xl border border-emerald-400/15 bg-[#06110b]/92 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10">
              <ShieldCheck
                size={14}
                className="text-emerald-400"
              />
            </div>

            <div>
              <div className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">
                SATARK SAFE NAVIGATION
              </div>

              <div className="mt-0.5 text-[7px] text-white/25">
                Hazard-aware geographic intelligence
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/5 bg-white/[.025] p-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />

              <span className="text-[10px] font-bold text-white/70">
                Live geographic map online
              </span>
            </div>

            <div className="mt-2 text-[8px] leading-4 text-white/30">
              SATARK is positioning the
              map around the selected
              destination using its real
              latitude and longitude.
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric
              label="3D View"
              value={
                camera3D
                  ? 'ACTIVE'
                  : 'FLAT'
              }
            />

            <Metric
              label="Coordinate"
              value="LIVE"
            />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-400/10 bg-emerald-400/5 px-3 py-2">
            <Navigation
              size={12}
              className="text-emerald-400"
            />

            <span className="text-[8px] font-bold text-emerald-200/60">
              Destination centered
              automatically
            </span>
          </div>
        </div>

        {/* =================================================
            MAP LAYERS
        ================================================= */}

        <div className="absolute right-4 top-[285px] z-30 rounded-2xl border border-white/10 bg-black/80 p-2 backdrop-blur-xl">
          <div className="mb-2 px-2 text-[7px] font-black uppercase tracking-[.17em] text-white/20">
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
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase tracking-wider ${
              showHazard
                ? 'bg-amber-400/10 text-amber-300'
                : 'text-white/25'
            }`}
          >
            <AlertTriangle
              size={12}
            />

            Hazard Zone
          </button>

          <button
            type="button"
            onClick={() =>
              setCamera3D(
                value =>
                  !value
              )
            }
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[8px] font-black uppercase tracking-wider ${
              camera3D
                ? 'bg-emerald-400/10 text-emerald-300'
                : 'text-white/25'
            }`}
          >
            <Route
              size={12}
            />

            3D View
          </button>
        </div>

        {/* =================================================
            LOCATION SWITCHER
        ================================================= */}

        <div className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/90 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
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
                      event.target
                        .value
                  )

                if (next) {
                  selectLocation(
                    next
                  )
                }
              }}
              className="max-w-[180px] bg-transparent text-[9px] font-black text-white outline-none"
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

            <span className="text-[7px] font-bold uppercase tracking-[.13em] text-white/25">
              LIVE MAP
            </span>
          </div>
        </div>

        {/* =================================================
            ROUTE LEGEND
        ================================================= */}

        <div className="absolute bottom-5 left-4 z-30 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-xl">
          <div className="mb-2 text-[7px] font-black uppercase tracking-[.17em] text-white/20">
            SATARK ROUTE INTELLIGENCE
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.6)]" />

              <span className="text-[8px] font-bold text-white/55">
                SAFEST
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-yellow-400" />

              <span className="text-[8px] font-bold text-white/40">
                ALTERNATIVE
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-purple-400" />

              <span className="text-[8px] font-bold text-white/40">
                SECONDARY
              </span>
            </div>
          </div>

          <div className="mt-2 text-[7px] leading-3 text-white/20">
            Route engine can be connected
            server-side without affecting
            the geographic map.
          </div>
        </div>

        {/* =================================================
            MAP STATUS
        ================================================= */}

        <div className="absolute bottom-5 right-4 z-30">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-xl">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,.8)]" />

            <span className="text-[7px] font-black uppercase tracking-[.14em] text-white/45">
              LIVE OPENSTREETMAP
            </span>
          </div>
        </div>

        {/* =================================================
            SOURCE CREDIT
        ================================================= */}

        <div className="absolute right-4 bottom-[52px] z-20">
          <div className="rounded-lg border border-white/5 bg-black/65 px-2 py-1 text-[6px] uppercase tracking-widest text-white/20">
            © OpenStreetMap contributors
          </div>
        </div>
      </div>

      {/* =================================================
          DESTINATION FOOTER
      ================================================= */}

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

          <div className="text-[7px] font-black uppercase tracking-[.15em] text-white/20">
            REAL COORDINATES
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {locations.map(
            location => {
              const active =
                location.id ===
                selectedLocation.id

              const c =
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
                    selectLocation(
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
                        c,
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
                      color:
                        c,
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

      {/* =================================================
          CSS
      ================================================= */}

      <style>
        {`
          /*
           * Emergency-stable map presentation.
           *
           * The geographic map itself is an actual
           * OpenStreetMap view loaded independently from
           * MapLibre/WebGL/network-heavy services.
           *
           * This 3D transform provides the cinematic
           * presentation while keeping the live map visible.
           */

          .satark-map-3d {
            transform:
              perspective(1500px)
              rotateX(7deg)
              scale(1.04);

            transform-origin:
              center center;

            transition:
              transform .7s ease;
          }

          .satark-map-3d iframe {
            filter:
              saturate(.72)
              contrast(1.05)
              brightness(.85);
          }

          .satark-location-pulse {
            position: absolute;
            left: 50%;
            top: 50%;

            width: 72px;
            height: 72px;

            transform:
              translate(-50%, -50%);

            border:
              1px solid;

            border-radius:
              999px;

            box-shadow:
              0 0 0 12px rgba(255,255,255,.025);

            animation:
              satark-pulse 2.3s ease-out infinite;
          }

          .satark-location-core {
            position: absolute;
            left: 50%;
            top: 50%;

            width: 20px;
            height: 20px;

            transform:
              translate(-50%, -50%);

            border:
              3px solid white;

            border-radius:
              999px;
          }

          .satark-location-card {
            position: absolute;

            left: 50%;
            top: 64px;

            min-width: 145px;

            transform:
              translateX(-50%);

            padding:
              7px 10px;

            border:
              1px solid rgba(255,255,255,.12);

            border-radius:
              8px;

            background:
              rgba(4,7,8,.88);

            backdrop-filter:
              blur(12px);

            box-shadow:
              0 10px 30px rgba(0,0,0,.4);

            text-align:
              center;
          }

          @keyframes satark-pulse {
            0% {
              transform:
                translate(-50%, -50%)
                scale(.55);

              opacity:
                .85;
            }

            70% {
              transform:
                translate(-50%, -50%)
                scale(1.45);

              opacity:
                0;
            }

            100% {
              opacity:
                0;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .satark-location-pulse {
              animation:
                none;
            }
          }
        `}
      </style>
    </section>
  )
}