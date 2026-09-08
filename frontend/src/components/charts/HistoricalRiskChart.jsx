import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

export default function HistoricalRiskChart({
  data = [],
  theme
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <div className="text-sm font-semibold text-white/80">
        20-year historical risk
        </div>

        <div className="mt-2 text-xs text-white/35">
          Historical risk data is unavailable for this location.
        </div>
      </div>
    )
  }

  const averageRisk =
    Math.round(
      data.reduce(
        (sum, item) => sum + (item.risk || 0),
        0
      ) / data.length
    )

  const highestRisk = data.reduce(
    (highest, current) =>
      current.risk > highest.risk
        ? current
        : highest,
    data[0]
  )

  function getRiskLabel(score) {
    if (score >= 75) return 'EXTREME'
    if (score >= 55) return 'HIGH'
    if (score >= 30) return 'MODERATE'
    return 'LOW'
  }

  const riskLabel = getRiskLabel(averageRisk)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b1110] p-5 md:p-6">

      {/* ------------------------------------------------ */}
      {/* HEADER                                           */}
      {/* ------------------------------------------------ */}

      <div className="flex items-start justify-between gap-4">

        <div>
          <div className="text-lg font-bold tracking-tight text-white">
            20-year historical risk
          </div>

          <div className="mt-1 text-xs text-white/35">
            Historical environmental risk pattern
          </div>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-[.16em]"
          style={{
            borderColor: `${theme?.accent || '#ffffff'}30`,
            color: theme?.accent || 'rgba(255,255,255,.6)'
          }}
        >
          {riskLabel}
        </div>

      </div>

      {/* ------------------------------------------------ */}
      {/* SUMMARY                                          */}
      {/* ------------------------------------------------ */}

      <div className="mt-5 grid grid-cols-2 gap-3">

        <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-white/25">
            20-year average
          </div>

          <div className="mt-1 text-xl font-bold text-white">
            {averageRisk}
            <span className="ml-1 text-xs font-normal text-white/30">
              /100
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
          <div className="text-[9px] font-bold uppercase tracking-[.16em] text-white/25">
            20-year highest
          </div>

          <div className="mt-1 text-xl font-bold text-white">
            {highestRisk.year}
            <span className="ml-2 text-xs font-normal text-white/30">
              {highestRisk.risk}/100
            </span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------ */}
      {/* CHART                                            */}
      {/* ------------------------------------------------ */}

      <div className="mt-6 h-[280px] w-full">

        <ResponsiveContainer width="100%" height="100%">

          <LineChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: -15,
              bottom: 5
            }}
          >

            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />

            <XAxis
              dataKey="year"
              tick={{
                fill: 'rgba(255,255,255,0.35)',
                fontSize: 10
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{
                fill: 'rgba(255,255,255,0.35)',
                fontSize: 10
              }}
              axisLine={false}
              tickLine={false}
            />

            {/* LOW / MODERATE / HIGH reference levels */}

            <ReferenceLine
              y={30}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />

            <ReferenceLine
              y={55}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />

            <ReferenceLine
              y={75}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 4"
            />

            <Tooltip
              cursor={{
                stroke: 'rgba(255,255,255,0.12)'
              }}
              contentStyle={{
                background: '#0c1311',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px',
                color: '#fff'
              }}
              labelStyle={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 11
              }}
              formatter={(value) => [
                `${value}/100`,
                'Historical risk'
              ]}
            />

            <Line
              type="monotone"
              dataKey="risk"
              stroke={theme?.accent || '#ffffff'}
              strokeWidth={2.5}
              dot={{
                r: 3,
                strokeWidth: 2,
                fill: '#0b1110'
              }}
              activeDot={{
                r: 5,
                strokeWidth: 2
              }}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>

      {/* ------------------------------------------------ */}
      {/* INSIGHT                                          */}
      {/* ------------------------------------------------ */}

      <div className="mt-4 border-t border-white/5 pt-4">

        <div className="text-[9px] font-bold uppercase tracking-[.18em] text-white/25">
          Historical insight
        </div>

        <p className="mt-2 text-xs leading-5 text-white/45">

          The historical weather-risk index averaged{' '}
          <span className="font-semibold text-white/70">
            {averageRisk}/100
          </span>{' '}
          across the available period, with{' '}
          <span className="font-semibold text-white/70">
            {highestRisk.year}
          </span>{' '}
          recording the highest annual index at{' '}
          <span className="font-semibold text-white/70">
            {highestRisk.risk}/100
          </span>
          .

        </p>

      </div>

      {/* Glow */}

      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl opacity-10"
        style={{
          background: theme?.glow || theme?.accent
        }}
      />

    </div>
  )
}