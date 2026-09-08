import { useEffect, useState } from 'react'
import { LocateFixed, Radio, Sparkles } from 'lucide-react'
import { useHazardTheme } from '@/hooks/useHazardTheme'
import LocationSearch from '@/components/location/LocationSearch'
import RiskHero from '@/components/risk/RiskHero'
import ParameterGrid from '@/components/hazard/ParameterGrid'
import RiskForecastChart from '@/components/charts/RiskForecastChart'
import RiskFactors from '@/components/risk/RiskFactors'
import WeatherCard from '@/components/weather/WeatherCard'
import RecommendationCard from '@/components/recommendations/RecommendationCard'
import GlassCard from '@/components/ui/GlassCard'
import StatusBadge from '@/components/ui/StatusBadge'
import HistoricalRiskChart from '@/components/charts/HistoricalRiskChart'
import OfficialAlerts from '@/components/alerts/OfficialAlerts'

export default function DashboardPage() {
  const [historicalData, setHistoricalData] = useState([])
  const [locationName, setLocationName] = useState('')
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const hazard = location?.hazard || 'landslide'
  const theme = useHazardTheme(hazard)

  useEffect(() => {
    if (!locationName.trim()) {
      setLocation(null)
      setHistoricalData([])
      setLoading(false)
      return
    }
    async function fetchAnalysis() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(
          `http://localhost:3000/api/analyze?location=${encodeURIComponent(locationName)}`
        )

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`)
        }

        const data = await response.json()

        const historyResponse = await fetch(
          `http://localhost:3000/api/history-risk?location=${encodeURIComponent(locationName)}`
        )

        if (!historyResponse.ok) {
          throw new Error(`Historical API returned ${historyResponse.status}`)
        }

        const historyData = await historyResponse.json()

        setHistoricalData(historyData.yearly || [])

        const current = data.weather?.current || {}
        const risk = data.risk || {}
        const summary = risk.risk_summary || {}
        const ai = data.ai_analysis || {}

        const adaptedLocation = {
          id: locationName.toLowerCase().replace(/\s+/g, '-'),

          name: data.location?.name || locationName,

          region: data.location?.country || 'India',

          coordinates: [
            data.location?.latitude,
            data.location?.longitude
          ],

          hazard: getHazardType(data),

          riskScore: risk.score ?? 0,

          riskLevel: risk.level || 'LOW',

          confidence: null,

          updated: current.time || 'Live',

          weather: {
            temperature: current.temperature_2m ?? '--',
            condition: getWeatherCondition(current.weather_code),
            feelsLike: current.apparent_temperature ?? '--',
            humidity: current.relative_humidity_2m ?? '--'
          },

          parameters: [
            {
              label: 'Temperature',
              value: current.temperature_2m ?? '--',
              unit: '°C',
              change: 'current',
              status: 'normal'
            },
            {
              label: 'Precipitation',
              value: current.precipitation ?? '--',
              unit: 'mm',
              change: 'current',
              status:
                current.precipitation > 10
                  ? 'elevated'
                  : 'normal'
            },
            {
              label: 'Elevation',
              value: data.location?.elevation ?? '--',
              unit: 'm',
              change: 'destination',
              status:
                data.location?.elevation >= 3000
                  ? 'elevated'
                  : 'normal'
            },
            {
              label: 'Wind',
              value: current.wind_speed_10m ?? '--',
              unit: 'km/h',
              change: 'current',
              status:
                current.wind_speed_10m >= 30
                  ? 'elevated'
                  : 'normal'
            }
          ],

          trend: [
            risk.score ?? 0
          ],

          forecast:
            (risk.risk_forecast || []).map(item => ({
              time: new Date(item.time).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              risk: item.score
            })),

          factors: [
            {
              label: 'Rain',
              impact: getImpact(risk.factors?.rain)
            },
            {
              label: 'Wind',
              impact: getImpact(risk.factors?.wind)
            },
            {
              label: 'Visibility',
              impact: getImpact(risk.factors?.visibility)
            },
            {
              label: 'Altitude',
              impact: getImpact(risk.factors?.altitude)
            },
            {
              label: 'Official alerts',
              impact: getImpact(
                risk.factors?.disaster_alerts
              )
            },
            {
              label: 'Landslide trigger',
              impact: getImpact(
                risk.factors?.landslide_trigger
              )
            }
          ],

          recommendations:
            summary.recommendations || [],

          explanation:
            ai.explanation ||
            summary.severity_reason ||
            'SATARK has generated a risk assessment from the available environmental signals.',

          severityReason:
            summary.severity_reason ||
            ai.explanation ||
            'Risk assessment is based on the environmental signals currently available to SATARK.',

          alerts:
            risk.official_alerts || []
        }

        setLocation(adaptedLocation)

      } catch (err) {
        console.error('SATARK backend error:', err)
        setError(err.message)

      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [locationName])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-white/50">
          SATARK is analyzing {locationName}...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6 text-center">
          <div className="text-sm font-semibold text-red-200">
            Unable to load SATARK analysis
          </div>

          <div className="mt-2 text-xs text-white/40">
            {error}
          </div>
        </div>
      </div>
    )
  }
  if (!location) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-2xl text-center">

        <div
          className="text-[10px] font-bold uppercase tracking-[.3em]"
          style={{ color: theme.accent }}
        >
          SATARK
        </div>

        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
          Understand the risk
          <br />
          <span className="text-white/40">
            before you travel.
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-white/40">
          Enter a destination to get a live AI-powered safety
          assessment using weather, terrain, official alerts,
          and environmental risk signals.
        </p>

        <div className="mt-8 text-left">
          <LocationSearch onSearch={setLocationName} />
        </div>

        <div className="mt-4 text-[10px] uppercase tracking-widest text-white/20">
          Search a city, district, or destination
        </div>

      </div>
    </div>
  )
}
  return (
    <div className="space-y-5">
      
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>

          <div
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em]"
            style={{ color: theme.accent }}
          >
            <Radio size={12} />
            Live location intelligence
          </div>

          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            Understand the risk before it becomes a disaster.
          </h2>

          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/35">
            Choose a location. SATARK combines environmental signals
            and terrain context into a location-specific risk picture.
          </p>

        </div>

        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/25">
          <LocateFixed size={13} />
          Live backend intelligence
        </div>
      </div>

      <LocationSearch onSearch={setLocationName} />

      <RiskHero
        location={location}
        theme={theme}
      />

      <div className="flex flex-wrap items-center gap-2">

        <StatusBadge level={location.riskLevel}>
          {location.riskLevel} risk
        </StatusBadge>


        <span className="text-[10px] text-white/35">
          Live assessment from current signals
        </span>

      </div>

      <ParameterGrid
        parameters={location.parameters}
        theme={theme}
      />
      <OfficialAlerts
        alerts={location.alerts}
      />
      <HistoricalRiskChart
        data={historicalData}
        theme={theme}
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">

        <RiskForecastChart
          data={location.forecast}
          theme={theme}
        />

        <WeatherCard
          weather={location.weather}
          theme={theme}
        />

      </div>

      <GlassCard className="relative overflow-hidden p-5 md:p-6">

        <Sparkles
          size={18}
          style={{ color: theme.accent }}
        />

        <div className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/35">
          SATARK AI explanation
        </div>

        <p className="mt-3 max-w-4xl text-sm leading-7 text-white/60">
          {location.explanation}
        </p>

        <div
          className="absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl"
          style={{ background: theme.glow }}
        />

      </GlassCard>

    </div>
  )
}


/* ============================= */
/* SATARK DATA HELPERS           */
/* ============================= */

function getImpact(factor) {
  if (!factor || !factor.max_score) {
    return 0
  }

  return Math.round(
    (factor.score / factor.max_score) * 100
  )
}


function getWeatherCondition(code) {
  if (code === undefined || code === null) {
    return 'Unknown'
  }

  if (code === 0) return 'Clear sky'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Rain showers'
  if (code <= 86) return 'Snow showers'
  if (code >= 95) return 'Thunderstorm'

  return 'Unknown'
}


function getHazardType(data) {
  const alerts = data?.risk?.official_alerts || []

  const alertText = alerts
    .map(alert =>
      `${alert.title || ''} ${alert.hazard || ''}`
    )
    .join(' ')
    .toLowerCase()

  if (
    alertText.includes('flood') ||
    alertText.includes('flash flood')
  ) {
    return 'flood'
  }

  if (
    alertText.includes('cyclone') ||
    alertText.includes('storm surge')
  ) {
    return 'cyclone'
  }

  if (
    alertText.includes('heat') ||
    alertText.includes('hot wave')
  ) {
    return 'heatwave'
  }

  if (
    alertText.includes('landslide') ||
    alertText.includes('avalanche')
  ) {
    return 'landslide'
  }

  return 'landslide'
}