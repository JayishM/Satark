import { CloudRain, Droplets, Thermometer } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'

export default function WeatherCard({ weather, theme }) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-white/35">Current weather</span><CloudRain size={16} style={{ color: theme.accent }} /></div>
      <div className="mt-6 flex items-end gap-3"><span className="mono text-5xl font-bold">{weather.temperature}°</span><span className="pb-1 text-[10px] text-white/35">{weather.condition}</span></div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/[.03] p-3"><Thermometer size={14} className="mb-2 text-white/35" /><div className="mono text-sm">{weather.feelsLike}°</div><div className="text-[9px] uppercase text-white/25">feels like</div></div>
        <div className="rounded-xl bg-white/[.03] p-3"><Droplets size={14} className="mb-2 text-white/35" /><div className="mono text-sm">{weather.humidity}%</div><div className="text-[9px] uppercase text-white/25">humidity</div></div>
      </div>
    </GlassCard>
  )
}
