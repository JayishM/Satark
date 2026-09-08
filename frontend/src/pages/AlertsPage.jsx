import { AlertTriangle, BellRing } from 'lucide-react'
import { LOCATION_OPTIONS } from '@/data/demoData'
import GlassCard from '@/components/ui/GlassCard'
import StatusBadge from '@/components/ui/StatusBadge'

export default function AlertsPage() {
  const alerts = LOCATION_OPTIONS.flatMap(l => l.alerts.map(a => ({ ...a, location: l.name, hazard: l.hazard })))
  return (
    <div className="space-y-5">
      <div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Event stream</div><h1 className="mt-2 text-3xl font-bold">Alerts</h1><p className="mt-2 text-xs text-white/35">Simulated alerts generated from the demo hazard states.</p></div>
      <div className="space-y-3">{alerts.map((a, i) => <GlassCard key={`${a.title}-${i}`} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.03]"><AlertTriangle size={17} className="text-white/60"/></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><StatusBadge level={a.severity}>{a.severity}</StatusBadge><span className="text-[10px] text-white/30">{a.location}</span></div><div className="mt-2 text-sm font-semibold">{a.title}</div><div className="mt-1 text-[10px] text-white/30">{a.time}</div></div><BellRing size={16} className="text-white/20"/></GlassCard>)}</div>
    </div>
  )
}
