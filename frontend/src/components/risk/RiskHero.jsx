import { motion } from 'framer-motion'
import { ArrowUpRight, BrainCircuit, ChevronRight, MapPin } from 'lucide-react'
import StatusBadge from '@/components/ui/StatusBadge'

export default function RiskHero({ location, theme }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <motion.section
        key={`${location.id}-${theme.id}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass panel relative min-h-[330px] overflow-hidden p-6 md:p-8"
      >
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full blur-3xl" style={{ background: theme.glow }} />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/35">
            <MapPin size={12} /> {location.name} · {location.region}
            <span className="mx-1">•</span>
            Updated {location.updated}
          </div>

          <div className="mt-12 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2"><BrainCircuit size={17} style={{ color: theme.accent }} /><span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">AI risk assessment</span></div>
              <h1 className="text-5xl font-black uppercase tracking-[-0.04em] md:text-7xl" style={{ color: theme.accent }}>{theme.label}</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">{theme.description}</p>
            </div>
            <div className="shrink-0 md:text-right">
              <StatusBadge level={location.riskLevel}>{location.riskLevel}</StatusBadge>
              <div className="mono mt-2 text-6xl font-black tracking-[-0.06em]">{location.riskScore}<span className="text-xl text-white/25">/100</span></div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">risk index</div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[.025] px-3 py-2 text-[10px] uppercase tracking-wider text-white/45">Model confidence <strong className="ml-1 text-white">{location.confidence}%</strong></div>
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/35">View full assessment <ChevronRight size={13} /></div>
          </div>
        </div>
      </motion.section>

      <section className="glass panel flex flex-col justify-between p-6">
        <div>
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Risk trajectory</span><ArrowUpRight size={15} style={{ color: theme.accent }} /></div>
          <div className="mt-7 flex items-end gap-1">
            {location.trend.map((value, i) => <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(22, value * 1.8)}px`, background: theme.accent, opacity: .2 + i * .08 }} />)}
          </div>
          <div className="mt-3 flex justify-between text-[9px] uppercase tracking-widest text-white/25"><span>−24h</span><span>now</span></div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-5">
          <div className="text-xs font-semibold">Risk is trending upward</div>
          <div className="mt-1 text-[11px] leading-5 text-white/35">Signals indicate increasing hazard pressure over the next 24 hours.</div>
        </div>
      </section>
    </div>
  )
}
