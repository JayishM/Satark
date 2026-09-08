import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, LocateFixed, Radio, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { DEMO_LOCATIONS, LOCATION_OPTIONS } from '@/data/demoData'
import { HAZARDS } from '@/themes/hazards'
import { useHazardTheme } from '@/hooks/useHazardTheme'
import LocationSearch from '@/components/location/LocationSearch'
import RiskHero from '@/components/risk/RiskHero'
import ParameterGrid from '@/components/hazard/ParameterGrid'
import RiskForecastChart from '@/components/charts/RiskForecastChart'
import RiskFactors from '@/components/risk/RiskFactors'
import WeatherCard from '@/components/weather/WeatherCard'
import RecommendationCard from '@/components/recommendations/RecommendationCard'
import GlassCard from '@/components/ui/GlassCard'
import StatusBadge from '@/components/ui/StatusBadge'

export default function DashboardPage() {
  const [selectedId, setSelectedId] = useState('dehradun')
  const location = useMemo(() => DEMO_LOCATIONS[selectedId], [selectedId])
  const theme = useHazardTheme(location.hazard)
  const delta = location.forecast.at(-1).risk - location.riskScore

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em]" style={{ color: theme.accent }}><Radio size={12} /> Live location intelligence</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Understand the risk before it becomes a disaster.</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/35">Choose a location. SATARK combines environmental signals and terrain context into a location-specific risk picture.</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/25"><LocateFixed size={13} /> Demo / simulated data</div>
      </div>

      <LocationSearch locations={LOCATION_OPTIONS} selectedId={selectedId} onSelect={setSelectedId} />

      <RiskHero location={location} theme={theme} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge level={location.riskLevel}>{location.riskLevel} risk</StatusBadge>
        <span className="text-[10px] text-white/35">{theme.label} probability is {location.riskScore}/100</span>
        <span className="flex items-center gap-1 text-[10px]" style={{ color: delta > 0 ? theme.accent : '#86d7ad' }}>{delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {Math.abs(delta)} points projected by +24h</span>
      </div>

      <ParameterGrid parameters={location.parameters} theme={theme} />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <RiskForecastChart data={location.forecast} theme={theme} />
        <WeatherCard weather={location.weather} theme={theme} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RiskFactors factors={location.factors} theme={theme} />
        <RecommendationCard items={location.recommendations} theme={theme} />
      </div>

      <GlassCard className="relative overflow-hidden p-5 md:p-6">
        <Sparkles size={18} style={{ color: theme.accent }} />
        <div className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/35">SATARK AI explanation</div>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/60">{location.explanation}</p>
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl" style={{ background: theme.glow }} />
      </GlassCard>
    </div>
  )
}
