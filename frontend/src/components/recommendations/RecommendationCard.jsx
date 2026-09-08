import { ArrowRight, ShieldAlert } from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'

export default function RecommendationCard({ items, theme }) {
  return (
    <GlassCard className="p-5 md:p-6">
      <div className="flex items-center gap-2"><ShieldAlert size={17} style={{ color: theme.accent }} /><div className="text-xs font-bold">Recommended action</div></div>
      <div className="mt-1 text-[10px] text-white/35">Practical guidance for the current risk state</div>
      <div className="mt-5 space-y-3">
        {items.map((item, i) => <div key={item} className="flex gap-3 rounded-xl border border-white/5 bg-white/[.025] p-3"><span className="mono mt-0.5 text-[10px]" style={{ color: theme.accent }}>0{i+1}</span><span className="text-[11px] leading-5 text-white/55">{item}</span><ArrowRight size={13} className="ml-auto mt-1 shrink-0 text-white/20" /></div>)}
      </div>
      <div className="mt-5 rounded-xl border border-white/10 bg-white/[.02] p-3 text-[9px] leading-4 text-white/30">SATARK provides decision support. Follow official local authorities and emergency services for real-world instructions.</div>
    </GlassCard>
  )
}
