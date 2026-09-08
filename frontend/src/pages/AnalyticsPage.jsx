import { Activity, BrainCircuit, Database, Gauge } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { LOCATION_OPTIONS } from '@/data/demoData'
import GlassCard from '@/components/ui/GlassCard'

const data = Array.from({length: 12}, (_, i) => ({ time: `${i+1}h`, confidence: 86 + (i % 5), accuracy: 88 + ((i * 2) % 6) }))

export default function AnalyticsPage() {
  const avg = Math.round(LOCATION_OPTIONS.reduce((s, l) => s + l.confidence, 0) / LOCATION_OPTIONS.length)
  return (
    <div className="space-y-5">
      <div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">Model telemetry</div><h1 className="mt-2 text-3xl font-bold">Analytics</h1><p className="mt-2 text-xs text-white/35">Demo metrics for the SATARK intelligence layer.</p></div>
      <div className="grid gap-3 md:grid-cols-3"><Metric icon={Gauge} label="Avg. confidence" value={`${avg}%`} /><Metric icon={Activity} label="Locations assessed" value={LOCATION_OPTIONS.length} /><Metric icon={Database} label="Signals / location" value="16+" /></div>
      <GlassCard className="p-5 md:p-6"><div className="flex items-center gap-2"><BrainCircuit size={17}/><div className="text-xs font-bold">Model confidence trend</div></div><div className="mt-6 h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="time" tick={{fill:'#71847d',fontSize:9}} axisLine={false} tickLine={false}/><YAxis domain={[80,100]} tick={{fill:'#71847d',fontSize:9}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#0b1512',border:'1px solid rgba(255,255,255,.1)',borderRadius:10,fontSize:11}}/><Line type="monotone" dataKey="confidence" stroke="#8de9c5" strokeWidth={2}/><Line type="monotone" dataKey="accuracy" stroke="#7c8bff" strokeWidth={2}/></LineChart></ResponsiveContainer></div></GlassCard>
    </div>
  )
}
function Metric({ icon: Icon, label, value }) { return <GlassCard className="p-5"><Icon size={17} className="text-white/40"/><div className="mono mt-5 text-3xl font-bold">{value}</div><div className="mt-1 text-[9px] uppercase tracking-widest text-white/30">{label}</div></GlassCard> }
