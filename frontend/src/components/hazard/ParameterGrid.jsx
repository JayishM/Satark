import { Activity, Droplets, Gauge, Mountain, Wind } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'

const icons = [Gauge, Droplets, Mountain, Activity]

export default function ParameterGrid({ parameters, theme }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {parameters.map((p, i) => {
        const Icon = icons[i % icons.length]
        return (
          <GlassCard key={p.label} className="p-5">
            <div className="flex items-start justify-between">
              <div className="rounded-lg border border-white/10 bg-white/[.03] p-2"><Icon size={16} style={{ color: theme.accent }} /></div>
              <span className={`text-[9px] uppercase tracking-widest ${p.status === 'critical' ? 'text-red-300' : p.status === 'elevated' ? 'text-amber-200' : 'text-emerald-300'}`}>{p.status}</span>
            </div>
            <div className="mono mt-5 text-3xl font-bold">{p.value}<span className="ml-1 text-xs font-medium text-white/30">{p.unit}</span></div>
            <div className="mt-1 text-[10px] uppercase tracking-wider text-white/35">{p.label}</div>
            <div className="mt-4 text-[10px] text-white/40">Change <span style={{ color: theme.accent }}>{p.change}</span></div>
          </GlassCard>
        )
      })}
    </div>
  )
}
