import { MapPinned, Navigation, Plus, Minus } from 'lucide-react'
import { HAZARDS } from '@/themes/hazards'
import GlassCard from '@/components/ui/GlassCard'

export default function RiskMap({
  locations = [],
  selectedLocation = null,
}) {

  /*
   * These positions are currently visual/demo positions.
   *
   * Later, when we have real geospatial layers,
   * these can be replaced by latitude/longitude projection.
   */
  const positions = [
    { left: 39, top: 30 },
    { left: 54, top: 56 },
    { left: 48, top: 43 },
    { left: 45, top: 23 },
    { left: 58, top: 49 },
  ]


  /*
   * If the dashboard sends one real location,
   * show that location prominently in the map.
   */
  const mapLocations = locations.map((loc, index) => {

    const position =
      positions[index % positions.length]

    return {
      ...loc,
      left: position.left,
      top: position.top,
    }
  })


  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">

      {/* =====================================================
          MAP
      ===================================================== */}

      <GlassCard className="relative min-h-[560px] overflow-hidden p-0">

        {/* MAP BACKGROUND */}

        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              `
              radial-gradient(
                circle at 50% 50%,
                rgba(141,233,197,.12),
                transparent 28%
              ),
              linear-gradient(
                rgba(255,255,255,.04) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,.04) 1px,
                transparent 1px
              )
              `,

            backgroundSize:
              '100% 100%, 60px 60px, 60px 60px',
          }}
        />


        {/* =================================================
            ZOOM CONTROLS
        ================================================= */}

        <div className="absolute left-4 top-4 z-10 flex gap-2 rounded-xl border border-white/10 bg-black/35 p-2 backdrop-blur-xl">

          <button
            type="button"
            className="p-2 text-white/50 transition hover:text-white"
            aria-label="Zoom in"
          >
            <Plus size={15} />
          </button>

          <button
            type="button"
            className="p-2 text-white/50 transition hover:text-white"
            aria-label="Zoom out"
          >
            <Minus size={15} />
          </button>

        </div>


        {/* =================================================
            LOCATION MARKERS
        ================================================= */}

        {mapLocations.map((loc) => {

          const theme =
            HAZARDS[loc.hazard] ||
            HAZARDS.landslide

          const isSelected =
            selectedLocation &&
            (
              selectedLocation.id === loc.id ||
              selectedLocation.name === loc.name
            )


          return (

            <div
              key={loc.id || loc.name}
              className="absolute transition-all duration-500"
              style={{
                left: `${loc.left}%`,
                top: `${loc.top}%`,
                transform: isSelected
                  ? 'scale(1.25)'
                  : 'scale(1)',
              }}
            >

              {/* PULSE */}

              <div
                className="absolute -inset-3 animate-ping rounded-full opacity-20"
                style={{
                  background:
                    theme.accent,
                }}
              />


              {/* MARKER */}

              <div
                className="relative h-4 w-4 rounded-full border-2 border-white/70"
                style={{
                  background:
                    theme.accent,

                  boxShadow:
                    `0 0 28px ${theme.accent}`,
                }}
              />


              {/* LABEL */}

              <div
                className={`
                  absolute
                  left-6
                  top-[-5px]
                  whitespace-nowrap
                  rounded-md
                  border
                  px-2
                  py-1
                  text-[9px]
                  backdrop-blur-xl
                  ${
                    isSelected
                      ? 'border-white/20 bg-black/80 text-white'
                      : 'border-white/10 bg-black/60'
                  }
                `}
              >

                {loc.name}

                {' · '}

                {loc.riskScore}

              </div>

            </div>

          )
        })}


        {/* =================================================
            MAP LAYER LABEL
        ================================================= */}

        <div className="absolute bottom-5 left-5 z-10 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[9px] uppercase tracking-widest text-white/35 backdrop-blur-xl">

          Map layer · hazard risk

        </div>


        {/* =================================================
            SELECTED LOCATION
        ================================================= */}

        {selectedLocation && (

          <div className="absolute right-5 top-5 z-10 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl">

            <div className="text-[9px] uppercase tracking-widest text-white/30">
              Selected destination
            </div>

            <div className="mt-1 text-sm font-bold text-white">
              {selectedLocation.name}
            </div>

            <div className="mt-1 text-[10px] text-white/40">
              Risk {selectedLocation.riskScore}/100
            </div>

          </div>

        )}

      </GlassCard>


      {/* =====================================================
          LOCATIONS PANEL
      ===================================================== */}

      <GlassCard className="p-5">

        <div className="flex items-center gap-2">

          <MapPinned
            size={17}
            className="text-white/50"
          />

          <span className="text-xs font-bold">
            Locations
          </span>

        </div>


        <div className="mt-5 space-y-2">

          {mapLocations.map((loc) => {

            const theme =
              HAZARDS[loc.hazard] ||
              HAZARDS.landslide

            const isSelected =
              selectedLocation &&
              (
                selectedLocation.id === loc.id ||
                selectedLocation.name === loc.name
              )


            return (

              <div
                key={loc.id || loc.name}
                className={`
                  flex
                  items-center
                  gap-3
                  rounded-xl
                  border
                  p-3
                  transition
                  ${
                    isSelected
                      ? 'border-white/15 bg-white/[.06]'
                      : 'border-white/5 bg-white/[.025]'
                  }
                `}
              >

                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background:
                      theme.accent,
                  }}
                />


                <div className="flex-1">

                  <div className="text-[11px] font-semibold">
                    {loc.name}
                  </div>

                  <div className="text-[9px] text-white/30">
                    {theme.label}
                  </div>

                </div>


                <span className="mono text-xs">
                  {loc.riskScore}
                </span>

              </div>

            )
          })}

        </div>


        <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/5 p-3 text-[9px] leading-4 text-white/30">

          <Navigation size={13} />

          Risk visualization based on SATARK
          environmental intelligence.

        </div>

      </GlassCard>

    </div>
  )
}