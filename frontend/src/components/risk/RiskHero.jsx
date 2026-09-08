import { motion } from 'framer-motion'
import {
  BrainCircuit,
  ChevronRight,
  MapPin
} from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'

export default function RiskHero({ location, theme }) {
  const score = location?.riskScore ?? 0
  const riskLevel = location?.riskLevel || 'LOW'

  const severityReason =
    location?.severityReason ||
    'Risk assessment is based on the environmental signals currently available to SATARK.'

  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">

      {/* MAIN RISK CARD */}
      <motion.section
        key={`${location?.id}-${theme.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass panel relative min-h-[330px] overflow-hidden p-6 md:p-8"
      >

        <div
          className="absolute right-0 top-0 h-64 w-64 rounded-full blur-3xl"
          style={{ background: theme.glow }}
        />

        <div className="relative">

          {/* LOCATION */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/35">

            <MapPin size={12} />

            <span>
              {location?.name || 'Unknown location'}
            </span>

            <span className="mx-1">•</span>

            <span>
              {location?.region || 'Unknown region'}
            </span>

            <span className="mx-1">•</span>

            <span>
              Updated {formatUpdatedTime(location?.updated)}
            </span>

          </div>


          {/* RISK */}
          <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">

            <div>

              <div className="mb-3 flex items-center gap-2">

                <BrainCircuit
                  size={17}
                  style={{ color: theme.accent }}
                />

                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  SATARK risk assessment
                </span>

              </div>


              <h1
                className="text-5xl font-black uppercase tracking-[-0.04em] md:text-7xl"
                style={{ color: theme.accent }}
              >
                {theme.label}
              </h1>


              <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                {severityReason}
              </p>

            </div>


            {/* SCORE */}
            <div className="shrink-0 md:text-right">

              <StatusBadge level={riskLevel}>
                {riskLevel}
              </StatusBadge>

              <div className="mono mt-2 text-6xl font-black tracking-[-0.06em]">
                {location?.hazardIndex ?? score}
                <span className="text-xl text-white/25">/100</span>
              </div>

              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                {getHazardIndexLabel(location?.hazard)}
              </div>

            </div>

          </div>


          {/* DATA STATUS */}
          <div className="mt-8 flex flex-wrap items-center gap-3">

            <div className="rounded-lg border border-white/10 bg-white/[.025] px-3 py-2 text-[10px] uppercase tracking-wider text-white/45">
              Live environmental assessment
            </div>

            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35">
              View full assessment
              <ChevronRight size={13} />
            </div>

          </div>

        </div>

      </motion.section>


      {/* RISK STATUS CARD */}
      <section className="glass panel flex flex-col justify-between p-6">

        <div>

          <div className="flex items-center justify-between">

            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Current risk status
            </span>

            <div
              className="h-2 w-2 rounded-full animate-pulse"
              style={{ background: theme.accent }}
            />

          </div>


          {/* SCORE VISUAL */}
          <div className="mt-7">

            <div className="flex items-end justify-between">

              <span className="text-[10px] uppercase tracking-widest text-white/30">
                Risk index
              </span>

              <span className="mono text-sm">
                {score}/100
              </span>

            </div>


            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">

              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  background: theme.accent
                }}
              />

            </div>

          </div>


          {/* RISK LEVEL */}
          <div className="mt-8">

            <div className="text-2xl font-bold">
              {riskLevel}
            </div>

            <div className="mt-2 text-[11px] leading-5 text-white/35">
              Current risk level calculated from SATARK's
              environmental and official-alert signals.
            </div>

          </div>

        </div>


        {/* BOTTOM INFO */}
        <div className="mt-8 border-t border-white/10 pt-5">

          <div className="text-xs font-semibold">
            {getStatusMessage(riskLevel)}
          </div>

          <div className="mt-1 text-[11px] leading-5 text-white/35">
            Monitor current conditions and official alerts
            before making travel decisions.
          </div>

        </div>

      </section>

    </div>
  )
}


function formatUpdatedTime(value) {
  if (!value) {
    return 'Live'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}


function getStatusMessage(level) {
  switch (String(level).toUpperCase()) {
    case 'EXTREME':
      return 'Immediate caution required'

    case 'HIGH':
      return 'Elevated travel risk'

    case 'MODERATE':
      return 'Conditions require caution'

    case 'LOW':
      return 'Conditions currently appear relatively stable'

    default:
      return 'Monitor conditions regularly'
  }
}
function getHazardIndexLabel(hazard) {
  switch (hazard) {
    case 'flood':
      return 'Flood Index'

    case 'landslide':
      return 'Landslide Index'

    case 'cyclone':
      return 'Cyclone Index'

    case 'heatwave':
      return 'Heatwave Index'

    default:
      return 'Hazard Index'
  }
}