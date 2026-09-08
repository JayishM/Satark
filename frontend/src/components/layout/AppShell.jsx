import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Activity, Bell, ChevronDown, Menu, ShieldCheck, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { HAZARDS } from '@/themes/hazards'
import { useHazardTheme } from '@/hooks/useHazardTheme'

const nav = [
  { to: '/', label: 'Command Center' },
  { to: '/map', label: 'Risk Map' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/analytics', label: 'Analytics' },
]

export default function AppShell({ children }) {
  const [hazard, setHazard] = useState('landslide')
  const [mobileOpen, setMobileOpen] = useState(false)
  const theme = useHazardTheme(hazard)

  return (
    <div className="app-bg" style={{ '--hazard-glow': theme.glow, background: `radial-gradient(circle at 15% 5%, ${theme.glow}, transparent 35%), ${theme.background}` }}>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/25 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 md:px-7">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <ShieldCheck size={20} style={{ color: theme.accent }} />
            </div>
            <div>
              <div className="text-sm font-black tracking-[0.28em]">SATARK</div>
              <div className="hidden text-[9px] uppercase tracking-[0.24em] text-white/40 sm:block">Risk intelligence</div>
            </div>
          </Link>

          <nav className="desktop-only flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `rounded-lg px-4 py-2 text-xs font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white'}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="desktop-only flex items-center gap-2 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-[10px] uppercase tracking-widest text-white/55">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              System live
            </div>
            <button className="hidden rounded-lg border border-white/10 bg-white/[.03] p-2 text-white/60 sm:block"><Bell size={17} /></button>
            <button className="rounded-lg border border-white/10 bg-white/[.03] p-2 text-white/60 md:hidden" onClick={() => setMobileOpen(v => !v)}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 px-4 py-3 md:hidden">
            {nav.map(item => (
              <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-3 text-sm text-white/70">
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 md:px-7 md:py-8">
        {children}
      </main>

      <footer className="mx-auto flex max-w-[1500px] items-center justify-between px-4 pb-7 text-[10px] uppercase tracking-[0.2em] text-white/25 md:px-7">
        <span>SATARK · DEMO MODE</span>
        <span className="flex items-center gap-2"><Activity size={12} /> environmental intelligence</span>
      </footer>
    </div>
  )
}

export { HAZARDS }
