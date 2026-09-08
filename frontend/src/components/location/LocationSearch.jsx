import { useState } from 'react'
import { Crosshair, Search, Sparkles } from 'lucide-react'

export default function LocationSearch({ onSearch }) {
  const [query, setQuery] = useState('')

  function handleSearch() {
    const location = query.trim()

    if (!location) {
      return
    }

    onSearch(location)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="relative z-20">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <Search size={18} className="text-white/35" />

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search city, district or location..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
        />

        <button
          onClick={handleSearch}
          className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/55 hover:bg-white/5 sm:flex"
        >
          <Sparkles size={14} />
          Analyze
        </button>

        <button
          onClick={() => {
            setQuery('')
            onSearch('Kedarnath')
          }}
          className="hidden items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/55 hover:bg-white/5 sm:flex"
        >
          <Crosshair size={14} />
          Current
        </button>
      </div>
    </div>
  )
}