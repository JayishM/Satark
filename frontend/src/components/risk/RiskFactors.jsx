import GlassCard from '@/components/ui/GlassCard'

export default function RiskFactors({ factors, theme }) {
  return (
    <GlassCard className="p-5 md:p-6">
      <div className="text-xs font-bold">Why this risk?</div>
      <div className="mt-1 text-[10px] text-white/35">Contribution of current environmental signals</div>
      <div className="mt-6 space-y-4">
        {factors.map(f => (
          <div key={f.label}>
            <div className="mb-2 flex justify-between text-[10px]"><span className="text-white/55">{f.label}</span><span className="mono text-white/35">{f.impact}%</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full" style={{ width: `${f.impact * 2.7}%`, background: theme.accent }} /></div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
