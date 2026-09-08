import {
  AlertTriangle,
  Clock3,
  MapPin,
  ShieldCheck
} from 'lucide-react'

export default function OfficialAlerts({ alerts = [] }) {

  if (!alerts || alerts.length === 0) {
    return (
      <section className="glass panel p-6">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
              <ShieldCheck
                size={18}
                className="text-white/50"
              />
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                Official alerts
              </div>

              <div className="mt-1 text-sm font-semibold">
                No active alerts
              </div>
            </div>

          </div>

          <div className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/40">
            Clear
          </div>

        </div>

        <p className="mt-5 text-[11px] leading-5 text-white/35">
          No active official disaster alerts were detected for
          this destination.
        </p>

      </section>
    )
  }

  return (
    <section className="glass panel overflow-hidden">

      {/* HEADER */}

      <div className="flex items-center justify-between border-b border-white/10 p-6">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">

            <AlertTriangle
              size={18}
              className="text-yellow-400"
            />

          </div>

          <div>

            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Official alerts
            </div>

            <div className="mt-1 text-sm font-semibold">
              Government disaster warnings
            </div>

          </div>

        </div>

        <div className="rounded-full border border-yellow-400/20 bg-yellow-400/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-yellow-300">
          {alerts.length} active
        </div>

      </div>


      {/* ALERT LIST */}

      <div className="divide-y divide-white/10">

        {alerts.map((alert, index) => (

          <AlertItem
            key={`${alert.title || 'alert'}-${index}`}
            alert={alert}
          />

        ))}

      </div>

    </section>
  )
}


function AlertItem({ alert }) {

  const severity =
    String(
      alert.severity ||
      alert.level ||
      'WATCH'
    ).toUpperCase()

  const severityStyle =
    getSeverityStyle(severity)

  return (
    <div className="p-6">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="min-w-0">

          {/* HAZARD */}

          <div className="flex flex-wrap items-center gap-2">

            <span className="text-sm font-bold uppercase tracking-wide">
              {alert.title ||
                alert.event ||
                alert.hazard ||
                'Official alert'}
            </span>

            <span
              className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${severityStyle}`}
            >
              {severity}
            </span>

          </div>


          {/* SOURCE */}

          <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">

            <ShieldCheck size={12} />

            <span>
              {alert.source ||
                alert.sender ||
                alert.issuer ||
                'Official authority'}
            </span>

          </div>

        </div>


        {/* LIKELIHOOD */}

        {alert.likelihood && (

          <div className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            {alert.likelihood}
          </div>

        )}

      </div>


      {/* DETAILS */}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">

        {alert.effective_from && (

          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3">

            <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-white/30">

              <Clock3 size={11} />

              Effective

            </div>

            <div className="mt-2 text-[11px] text-white/60">
              {formatDate(alert.effective_from)}
            </div>

          </div>

        )}


        {alert.effective_to && (

          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3">

            <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-white/30">

              <Clock3 size={11} />

              Valid until

            </div>

            <div className="mt-2 text-[11px] text-white/60">
              {formatDate(alert.effective_to)}
            </div>

          </div>

        )}


        {alert.distance_km != null && (

          <div className="rounded-lg border border-white/10 bg-white/[.02] p-3">

            <div className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-white/30">

              <MapPin size={11} />

              Distance

            </div>

            <div className="mt-2 text-[11px] text-white/60">
              {Number(alert.distance_km).toFixed(1)} km
            </div>

          </div>

        )}

      </div>

    </div>
  )
}


function formatDate(value) {

  if (!value) {
    return 'Unknown'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}


function getSeverityStyle(level) {

  switch (level) {

    case 'WARNING':
    case 'RED':
    case 'EXTREME':
      return 'border-red-400/30 bg-red-400/10 text-red-300'

    case 'ALERT':
    case 'ORANGE':
    case 'HIGH':
      return 'border-orange-400/30 bg-orange-400/10 text-orange-300'

    case 'WATCH':
    case 'YELLOW':
    case 'MODERATE':
      return 'border-yellow-400/30 bg-yellow-400/10 text-yellow-300'

    default:
      return 'border-white/10 bg-white/5 text-white/50'

  }

}