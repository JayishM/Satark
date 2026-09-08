import { useMemo, useState } from 'react'
import { Crosshair, MapPin, Search, Sparkles } from 'lucide-react'

export default function LocationSearch({ locations, selectedId, onSelect }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => locations.filter(x => `${x.name} ${x.region}`.toLowerCase().includes(query.toLowerCase())), [locations, query])

  return (
    <div className="relative z-20">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <Search size={18} className="text-white/35" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search city, district or location..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
        />
        <button
          onClick={() => onSelect(locations[0].id)}
          className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/55 hover:bg-white/5 sm:flex"
        >
          <Crosshair size={14} /> Current
        </button>
      </div>
      {(query || selectedId === null) && (
        <div className="absolute mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a1311]/95 p-1 shadow-2xl backdrop-blur-2xl">
          {filtered.map(location => (
            <button key={location.id} onClick={() => { onSelect(location.id); setQuery('') }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/5">
              <MapPin size={16} className="text-white/40" />
              <span className="flex-1"><span className="block text-sm font-semibold">{location.name}</span><span className="block text-[10px] text-white/35">{location.region}</span></span>
              <Sparkles size={14} style={{ color: 'var(--hazard-accent)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
