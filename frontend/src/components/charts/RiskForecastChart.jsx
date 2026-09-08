import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import GlassCard from '@/components/ui/GlassCard'

export default function RiskForecastChart({ data, theme }) {
  return (
    <GlassCard className="p-5 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div><div className="text-xs font-bold">24-hour risk projection</div><div className="mt-1 text-[10px] text-white/35">Modelled trajectory from current signals</div></div>
        <div className="rounded-lg border border-white/10 px-2 py-1 text-[9px] uppercase tracking-widest text-white/35">forecast</div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs><linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={theme.accent} stopOpacity={.28}/><stop offset="100%" stopColor={theme.accent} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: '#71847d', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0,100]} tick={{ fill: '#71847d', fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
            <Tooltip contentStyle={{ background: '#0b1512', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, fontSize: 11 }} />
            <Area type="monotone" dataKey="risk" stroke={theme.accent} fill="url(#riskFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}
