import RiskMap3D from '@/components/map/RiskMap3D'

export default function RiskMapPage() {
  return (
    <div className="space-y-5">

      <div>
        <div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">
          Geospatial intelligence
        </div>

        <h1 className="mt-2 text-3xl font-bold">
          Risk Map
        </h1>

        <p className="mt-2 text-xs text-white/35">
          3D visualization of SATARK destination risk intelligence.
        </p>
      </div>

      <RiskMap3D />

    </div>
  )
} 