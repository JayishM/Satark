const styles = {
  CRITICAL: 'border-red-400/25 bg-red-400/10 text-red-200',
  HIGH: 'border-orange-300/25 bg-orange-300/10 text-orange-200',
  MODERATE: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  WATCH: 'border-sky-300/20 bg-sky-300/10 text-sky-200',
  NORMAL: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
}

export default function StatusBadge({ children, level = children }) {
  const key = String(level || 'NORMAL').toUpperCase()
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${styles[key] || styles.NORMAL}`}>{children}</span>
}
