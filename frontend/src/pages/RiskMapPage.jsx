import { MapPinned, Navigation, Plus, Minus } from 'lucide-react'
import { LOCATION_OPTIONS } from '@/data/demoData'
import { HAZARDS } from '@/themes/hazards'
import GlassCard from '@/components/ui/GlassCard'

export default function RiskMapPage() {
  return (
    <div className="space-y-5">
      <div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Geospatial intelligence</div><h1 className="mt-2 text-3xl font-bold">Risk Map</h1><p className="mt-2 text-xs text-white/35">Demo visualization of location-specific hazard states.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <GlassCard className="relative min-h-[560px] overflow-hidden p-0">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(141,233,197,.12), transparent 28%), linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '100% 100%, 60px 60px, 60px 60px' }} />
          <div className="absolute left-4 top-4 z-10 flex gap-2 rounded-xl border border-white/10 bg-black/35 p-2 backdrop-blur-xl"><button className="p-2 text-white/50"><Plus size={15}/></button><button className="p-2 text-white/50"><Minus size={15}/></button></div>
          <div className="absolute bottom-5 left-5 z-10 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[9px] uppercase tracking-widest text-white/35 backdrop-blur-xl">Map layer · hazard risk</div>
          {LOCATION_OPTIONS.map((loc, i) => {
            const theme = HAZARDS[loc.hazard]
            const left = [39, 54, 48, 45, 58][i]
            const top = [30, 56, 43, 23, 49][i]
            return <div key={loc.id} className="absolute" style={{ left: `${left}%`, top: `${top}%` }}>
              <div className="absolute -inset-3 animate-ping rounded-full opacity-20" style={{ background: theme.accent }} />
              <div className="relative h-4 w-4 rounded-full border-2 border-white/70" style={{ background: theme.accent, boxShadow: `0 0 28px ${theme.accent}` }} />
              <div className="absolute left-6 top-[-5px] whitespace-nowrap rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[9px] backdrop-blur-xl">{loc.name} · {loc.riskScore}</div>
            </div>
          })}
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center gap-2"><MapPinned size={17} className="text-white/50" /><span className="text-xs font-bold">Locations</span></div>
          <div className="mt-5 space-y-2">{LOCATION_OPTIONS.map(loc => { const t=HAZARDS[loc.hazard]; return <div key={loc.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3"><span className="h-2.5 w-2.5 rounded-full" style={{background:t.accent}}/><div className="flex-1"><div className="text-[11px] font-semibold">{loc.name}</div><div className="text-[9px] text-white/30">{t.label}</div></div><span className="mono text-xs">{loc.riskScore}</span></div> })}</div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/5 p-3 text-[9px] leading-4 text-white/30"><Navigation size={13}/> Replace this demo layer with MapLibre/Leaflet when the backend provides geospatial layers.</div>
        </GlassCard>
      </div>
    </div>
  )
}
