import { useEffect, useState } from 'react'
import { LocateFixed, Radio } from 'lucide-react'

import { useHazardTheme } from '@/hooks/useHazardTheme'
import RiskMap3D from '@/components/map/RiskMap3D'
import LocationSearch from '@/components/location/LocationSearch'
import RiskHero from '@/components/risk/RiskHero'
import ParameterGrid from '@/components/hazard/ParameterGrid'
import RiskForecastChart from '@/components/charts/RiskForecastChart'
import WeatherCard from '@/components/weather/WeatherCard'
import StatusBadge from '@/components/ui/StatusBadge'
import HistoricalRiskChart from '@/components/charts/HistoricalRiskChart'
import OfficialAlerts from '@/components/alerts/OfficialAlerts'


/* =========================================================
   SATARK LOCAL STORAGE
========================================================= */

const SATARK_CACHE_KEY = 'satark_location_cache'
const SATARK_LAST_LOCATION_KEY = 'satark_last_location'
const SATARK_TRAVELLER_KEY = 'satark_traveller_profile'

/*
  Cache lifetime:
  10 minutes.

  Switching tabs does NOT refetch.
  Refreshing the page does NOT refetch.
  Returning within 10 minutes does NOT refetch.

  After 10 minutes SATARK gets fresh environmental data.
*/

const SATARK_CACHE_TTL = 10 * 60 * 1000
const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3000'

function saveSatarkData(locationName, data) {
  if (!locationName || !data) return

  try {
    const existing = JSON.parse(
      localStorage.getItem(SATARK_CACHE_KEY) || '{}'
    )

    const key = locationName.toLowerCase().trim()

    existing[key] = {
      savedAt: Date.now(),
      data
    }

    localStorage.setItem(
      SATARK_CACHE_KEY,
      JSON.stringify(existing)
    )

  } catch (error) {
    console.warn(
      'SATARK cache save failed:',
      error
    )
  }
}


function getSatarkData(locationName) {
  if (!locationName) return null

  try {
    const existing = JSON.parse(
      localStorage.getItem(SATARK_CACHE_KEY) || '{}'
    )

    const key = locationName.toLowerCase().trim()

    const cached = existing[key]

    if (!cached) {
      return null
    }

    /*
      Prevent stale environmental information.
    */

    if (
      Date.now() - cached.savedAt >
      SATARK_CACHE_TTL
    ) {

      delete existing[key]

      localStorage.setItem(
        SATARK_CACHE_KEY,
        JSON.stringify(existing)
      )

      return null
    }

    return cached.data

  } catch (error) {

    console.warn(
      'SATARK cache read failed:',
      error
    )

    return null
  }
}


/* =========================================================
   DASHBOARD
========================================================= */

export default function DashboardPage() {

  /* =======================================================
     RESTORE TRAVELLER PROFILE
  ======================================================= */

  const savedTravellerProfile =
    (() => {
      try {
        return JSON.parse(
          localStorage.getItem(
            SATARK_TRAVELLER_KEY
          ) || 'null'
        )
      } catch {
        return null
      }
    })()


  /* =======================================================
     STATE
  ======================================================= */

  const [historicalData, setHistoricalData] =
    useState([])


  const [locationName, setLocationName] =
    useState(
      () =>
        localStorage.getItem(
          SATARK_LAST_LOCATION_KEY
        ) || ''
    )


  const [location, setLocation] =
    useState(null)


  const [loading, setLoading] =
    useState(false)


  const [error, setError] =
    useState(null)


  const [travellerAge, setTravellerAge] =
    useState(
      savedTravellerProfile?.age || ''
    )


  const [medicalConditions, setMedicalConditions] =
    useState(
      savedTravellerProfile?.medicalConditions || []
    )


  /* =======================================================
     CACHE STATUS
  ======================================================= */

  const [dataSource, setDataSource] =
    useState('live')


  /* =======================================================
     HAZARD THEME
  ======================================================= */

  const hazard =
    location?.hazard || 'landslide'

  const theme =
    useHazardTheme(hazard)


  /* =======================================================
     SAVE TRAVELLER PROFILE
     
     IMPORTANT:
     This does NOT trigger the SATARK backend.
     
     It only saves the profile locally.
  ======================================================= */

  useEffect(() => {

    localStorage.setItem(
      SATARK_TRAVELLER_KEY,
      JSON.stringify({
        age: travellerAge,
        medicalConditions
      })
    )

  }, [
    travellerAge,
    medicalConditions
  ])


  /* =======================================================
     MAIN SATARK DATA LOADER
  ======================================================= */

  useEffect(() => {

    if (!locationName.trim()) {

      setLocation(null)
      setHistoricalData([])
      setLoading(false)

      return
    }


    async function fetchAnalysis() {

      const cacheKey =
        locationName.toLowerCase().trim()


      /* ===================================================
         1. CHECK LOCAL STORAGE
      =================================================== */

      const cachedData =
        getSatarkData(cacheKey)


      if (cachedData) {

        console.log(
          `⚡ SATARK: Loaded ${locationName} from local cache`
        )


        setLocation(
          cachedData.location
        )


        setHistoricalData(
          cachedData.historicalData || []
        )


        setDataSource('cached')


        setLoading(false)
        setError(null)


        return
      }


      /* ===================================================
         2. NO CACHE → FETCH FRESH DATA
      =================================================== */

      try {

        setLoading(true)
        setError(null)
        setDataSource('live')


        console.log(
          `🌐 SATARK: Fetching fresh data for ${locationName}`
        )


        /* =================================================
           ANALYZE API
        ================================================= */

        const params =
          new URLSearchParams({
            location: locationName
          })


        const response =
  await fetch(
    `${API_BASE_URL}/api/analyze?${params.toString()}`
  )


        if (!response.ok) {

          throw new Error(
            `Backend returned ${response.status}`
          )
        }


        const data =
          await response.json()


        /* =================================================
           HISTORICAL RISK
           
           OPTIONAL.
           
           If this fails, the main dashboard still works.
        ================================================= */

        let historicalDataResult = []


        try {

          const historyResponse =
  await fetch(
    `${API_BASE_URL}/api/history-risk?location=${encodeURIComponent(locationName)}`
  )


          if (historyResponse.ok) {

            const historyData =
              await historyResponse.json()


            historicalDataResult =
              Array.isArray(
                historyData.yearly
              )
                ? historyData.yearly
                : []
          }

        } catch (historyError) {

          console.warn(
            'Historical risk unavailable:',
            historyError
          )

        }


        /* =================================================
           EXTRACT DATA
        ================================================= */

        const current =
          data.weather?.current || {}


        const risk =
          data.risk || {}


        const summary =
          risk.risk_summary || {}


        const ai =
          data.ai_analysis || {}


        const hazardType =
          getHazardType(data)


        /* =================================================
           BUILD SATARK LOCATION OBJECT
        ================================================= */

        const adaptedLocation = {

          id:
            locationName
              .toLowerCase()
              .replace(/\s+/g, '-'),


          name:
            data.location?.name ||
            locationName,


          region:
            data.location?.country ||
            'India',


          elevation:
            data.location?.elevation ?? 0,


          coordinates: [

            data.location?.latitude,

            data.location?.longitude

          ],


          hazard:
            hazardType,


          riskScore:
            risk.score ?? 0,


          riskLevel:
            risk.level || 'LOW',


          recommendedAge:
            getRecommendedAge(data),


          recommendedFitness:
            getRecommendedFitness(data),


          recommendedMedical:
            getRecommendedMedical(data),


          travellerRecommendation:
            getTravellerRecommendation(data),


          hazardIndex:
            getHazardIndex(
              risk,
              hazardType
            ),


          confidence:
            null,


          updated:
            current.time || 'Live',


          /* =============================================
             WEATHER
          ============================================= */

          weather: {

            temperature:
              current.temperature_2m ?? '--',


            condition:
              getWeatherCondition(
                current.weather_code
              ),


            feelsLike:
              current.apparent_temperature ?? '--',


            humidity:
              current.relative_humidity_2m ?? '--'

          },


          /* =============================================
             PARAMETERS
          ============================================= */

          parameters: [

            {

              label: 'Temperature',

              value:
                current.temperature_2m ?? '--',

              unit: '°C',

              change: 'current',

              status: 'normal'

            },


            {

              label: 'Precipitation',

              value:
                current.precipitation ?? '--',

              unit: 'mm',

              change: 'current',

              status:
                current.precipitation > 10
                  ? 'elevated'
                  : 'normal'

            },


            {

              label: 'Elevation',

              value:
                data.location?.elevation ?? '--',

              unit: 'm',

              change: 'destination',

              status:
                data.location?.elevation >= 3000
                  ? 'elevated'
                  : 'normal'

            },


            {

              label: 'Wind',

              value:
                current.wind_speed_10m ?? '--',

              unit: 'km/h',

              change: 'current',

              status:
                current.wind_speed_10m >= 30
                  ? 'elevated'
                  : 'normal'

            }

          ],


          /* =============================================
             TREND
          ============================================= */

          trend: [

            risk.score ?? 0

          ],


          /* =============================================
             FORECAST
          ============================================= */

          forecast:
            (risk.risk_forecast || [])
              .map(item => ({

                time:
                  new Date(
                    item.time
                  ).toLocaleTimeString(
                    'en-IN',
                    {
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  ),

                risk:
                  item.score

              })),


          /* =============================================
             RISK FACTORS
          ============================================= */

          factors: [

            {

              label: 'Rain',

              impact:
                getImpact(
                  risk.factors?.rain
                )

            },


            {

              label: 'Wind',

              impact:
                getImpact(
                  risk.factors?.wind
                )

            },


            {

              label: 'Visibility',

              impact:
                getImpact(
                  risk.factors?.visibility
                )

            },


            {

              label: 'Altitude',

              impact:
                getImpact(
                  risk.factors?.altitude
                )

            },


            {

              label: 'Official alerts',

              impact:
                getImpact(
                  risk.factors?.disaster_alerts
                )

            },


            {

              label: 'Landslide trigger',

              impact:
                getImpact(
                  risk.factors?.landslide_trigger
                )

            }

          ],


          /* =============================================
             RECOMMENDATIONS
          ============================================= */

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


          /* =============================================
             ALERTS
          ============================================= */

          alerts:
            risk.official_alerts || []

        }


        /* =================================================
           3. SAVE EVERYTHING TO LOCAL STORAGE
        ================================================= */

        saveSatarkData(
          cacheKey,
          {

            location:
              adaptedLocation,

            historicalData:
              historicalDataResult,

            rawData:
              data

          }
        )


        console.log(
          `💾 SATARK: Saved ${locationName} to local cache`
        )


        /* =================================================
           4. UPDATE UI
        ================================================= */

        setLocation(
          adaptedLocation
        )


        setHistoricalData(
          historicalDataResult
        )


        setDataSource('live')


      } catch (err) {

        console.error(
          'SATARK backend error:',
          err
        )


        setError(
          err.message
        )


      } finally {

        setLoading(false)

      }

    }


    fetchAnalysis()


  }, [locationName])


  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {

    return (

      <div className="flex min-h-[60vh] items-center justify-center">

        <div className="text-sm text-white/50">

          SATARK is analyzing {locationName}...

        </div>

      </div>

    )
  }


  /* =======================================================
     ERROR
  ======================================================= */

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


  /* =======================================================
     SEARCH SCREEN
  ======================================================= */

  if (!location) {

    return (

      <div className="flex min-h-[70vh] items-center justify-center px-4">

        <div className="w-full max-w-2xl text-center">

          <div
            className="text-[10px] font-bold uppercase tracking-[.3em]"
            style={{
              color: theme.accent
            }}
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

            Enter a destination to get a live AI-powered
            safety assessment using weather, terrain,
            official alerts, and environmental risk signals.

          </p>


          <div className="mt-8 text-left">

            <LocationSearch

              onSearch={(value) => {

                setLocationName(value)

                localStorage.setItem(
                  SATARK_LAST_LOCATION_KEY,
                  value
                )

              }}

            />

          </div>


          <div className="mt-4 text-[10px] uppercase tracking-widest text-white/20">

            Search a city, district, or destination

          </div>

        </div>

      </div>

    )
  }


  /* =======================================================
     MAIN DASHBOARD
  ======================================================= */

  return (

    <div className="space-y-5">


      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

        <div>

          <div
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.22em]"
            style={{
              color: theme.accent
            }}
          >

            <Radio size={12} />

            Live location intelligence

          </div>


          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">

            Understand the risk before it becomes a disaster.

          </h2>


          <p className="mt-2 max-w-2xl text-xs leading-5 text-white/35">

            Choose a location. SATARK combines environmental
            signals and terrain context into a location-specific
            risk picture.

          </p>

        </div>


        {/* =================================================
            CACHE STATUS
        ================================================= */}

        <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/25">

          <span
            className={`h-1.5 w-1.5 rounded-full ${
              dataSource === 'cached'
                ? 'bg-amber-400'
                : 'bg-emerald-400'
            }`}
          />

          {dataSource === 'cached'
            ? 'Cached intelligence'
            : 'Live intelligence'}

        </div>

      </div>


      <div className="space-y-4">


        {/* =================================================
            LOCATION SEARCH
        ================================================= */}

        <LocationSearch

          onSearch={(value) => {

            setLocationName(value)

            localStorage.setItem(
              SATARK_LAST_LOCATION_KEY,
              value
            )

          }}

        />


        {/* =================================================
            TRAVELLER SUITABILITY
        ================================================= */}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">


          <div className="mb-4">

            <div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">

              Traveller Suitability

            </div>


            <div className="mt-1 text-xs text-white/30">

              See who is best suited for this destination
              under current conditions.

            </div>

          </div>


          {/* =================================================
              TRAVELLER INPUTS
          ================================================= */}

          <div className="flex flex-col gap-4 md:flex-row">


            {/* AGE */}

            <div className="w-full md:w-40">

              <label className="mb-2 block text-xs text-white/50">

                Traveller Age

              </label>


              <input

                type="number"

                min="1"

                max="120"

                placeholder="Age"

                value={travellerAge}

                onChange={(e) =>
                  setTravellerAge(
                    e.target.value
                  )
                }

                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/20"

              />

            </div>


            {/* MEDICAL */}

            <div className="flex-1">

              <label className="mb-2 block text-xs text-white/50">

                Medical Conditions

              </label>


              <div className="flex flex-wrap gap-2">

                {[
                  'None',
                  'Asthma',
                  'Diabetes',
                  'Heart condition',
                  'Respiratory condition',
                  'Mobility limitations'
                ].map(condition => {

                  const selected =
                    medicalConditions.includes(
                      condition
                    )


                  return (

                    <button

                      key={condition}

                      type="button"

                      onClick={() => {

                        if (
                          condition === 'None'
                        ) {

                          setMedicalConditions(
                            ['None']
                          )

                          return
                        }


                        setMedicalConditions(
                          prev => {

                            const withoutNone =
                              prev.filter(
                                item =>
                                  item !== 'None'
                              )


                            if (
                              withoutNone.includes(
                                condition
                              )
                            ) {

                              return withoutNone.filter(
                                item =>
                                  item !== condition
                              )

                            }


                            return [
                              ...withoutNone,
                              condition
                            ]

                          }
                        )

                      }}

                      className={`rounded-lg border px-3 py-2 text-xs transition ${
                        selected
                          ? 'border-white/30 bg-white/15 text-white'
                          : 'border-white/10 bg-white/5 text-white/40 hover:bg-white/10'
                      }`}

                    >

                      {condition}

                    </button>

                  )

                })}

              </div>

            </div>

          </div>


          {/* =================================================
              WHO SHOULD GO
          ================================================= */}

          <div className="mt-5 border-t border-white/10 pt-5">


            <div className="flex items-center justify-between">


              <div>

                <div className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">

                  Who should go?

                </div>


                <div className="mt-1 text-xs text-white/30">

                  Traveller suitability based on current
                  destination risk.

                </div>

              </div>


              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white/50">

                SATARK

              </div>

            </div>


            {/* =================================================
                RECOMMENDATION CARDS
            ================================================= */}

            <div className="mt-4 grid gap-3 md:grid-cols-3">


              {/* AGE */}

              <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] p-4">

                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/60">

                  Recommended age

                </div>


                <div className="mt-2 text-sm font-semibold text-white">

                  {location.recommendedAge}

                </div>

              </div>


              {/* FITNESS */}

              <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.04] p-4">

                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-300/60">

                  Physical ability

                </div>


                <div className="mt-2 text-sm font-semibold text-white">

                  {location.recommendedFitness}

                </div>

              </div>


              {/* MEDICAL */}

              <div className="rounded-lg border border-red-400/15 bg-red-400/[0.04] p-4">

                <div className="text-[9px] font-bold uppercase tracking-wider text-red-300/60">

                  Medical suitability

                </div>


                <div className="mt-2 text-sm font-semibold text-white">

                  {location.recommendedMedical}

                </div>

              </div>

            </div>


            {/* =================================================
                MAIN RECOMMENDATION
            ================================================= */}

            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">

              <div className="text-[9px] font-bold uppercase tracking-[.15em] text-white/30">

                SATARK recommendation

              </div>


              <p className="mt-2 text-xs leading-6 text-white/60">

                {location.travellerRecommendation}

              </p>

            </div>


            {/* =================================================
                PERSONAL SUITABILITY
            ================================================= */}

            {(
              travellerAge ||
              medicalConditions.some(
                condition =>
                  condition !== 'None'
              )
            ) && (

              <div className="mt-3">

                <PersonalSuitability

                  data={location}

                  age={travellerAge}

                  medicalConditions={
                    medicalConditions
                  }

                />

              </div>

            )}

          </div>

        </div>


        {/* =================================================
            RISK HERO
        ================================================= */}

        <RiskHero

          location={location}

          theme={theme}

        />


        {/* =================================================
            RISK STATUS
        ================================================= */}

        <div className="flex flex-wrap items-center gap-2">

          <StatusBadge
            level={location.riskLevel}
          >

            {location.riskLevel} risk

          </StatusBadge>


          <span className="text-[10px] text-white/35">

            {dataSource === 'cached'
              ? 'Loaded from local SATARK intelligence cache'
              : 'Live assessment from current signals'}

          </span>

        </div>


        {/* =================================================
            PARAMETERS
        ================================================= */}

        <ParameterGrid

          parameters={
            location.parameters
          }

          theme={theme}

        />


        {/* =================================================
            OFFICIAL ALERTS
        ================================================= */}

        <OfficialAlerts

          alerts={location.alerts}

        />


        {/* =================================================
            HISTORICAL RISK
        ================================================= */}

        <HistoricalRiskChart

          data={historicalData}

          theme={theme}

        />


        {/* =================================================
            FORECAST + WEATHER
        ================================================= */}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">


          <RiskForecastChart

            data={
              location.forecast
            }

            theme={theme}

          />


          <WeatherCard

            weather={
              location.weather
            }

            theme={theme}

          />

        </div>

      </div>

    </div>

  )
}


/* =========================================================
   SATARK DATA HELPERS
========================================================= */


/* =========================================================
   IMPACT
========================================================= */

function getImpact(factor) {

  if (
    !factor ||
    !factor.max_score
  ) {

    return 0

  }


  return Math.round(
    (
      factor.score /
      factor.max_score
    ) * 100
  )

}


/* =========================================================
   WEATHER CONDITION
========================================================= */

function getWeatherCondition(code) {

  if (
    code === undefined ||
    code === null
  ) {

    return 'Unknown'

  }


  if (code === 0)
    return 'Clear sky'


  if (code <= 3)
    return 'Partly cloudy'


  if (code <= 48)
    return 'Foggy'


  if (code <= 57)
    return 'Drizzle'


  if (code <= 67)
    return 'Rain'


  if (code <= 77)
    return 'Snow'


  if (code <= 82)
    return 'Rain showers'


  if (code <= 86)
    return 'Snow showers'


  if (code >= 95)
    return 'Thunderstorm'


  return 'Unknown'

}


/* =========================================================
   HAZARD TYPE
========================================================= */

function getHazardType(data) {

  const risk =
    data?.risk || {}


  const factors =
    risk.factors || {}


  const alerts =
    risk.official_alerts || []


  /* =======================================================
     OFFICIAL ALERTS HAVE HIGHEST PRIORITY
  ======================================================= */

  const alertText =
    alerts
      .map(
        alert =>
          `${alert.title || ''} ${alert.hazard || ''}`
      )
      .join(' ')
      .toLowerCase()


  if (
    alertText.includes('cyclone') ||
    alertText.includes('storm surge')
  ) {

    return 'cyclone'

  }


  if (
    alertText.includes('flood') ||
    alertText.includes('flash flood')
  ) {

    return 'flood'

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


  if (
    alertText.includes('snow') ||
    alertText.includes('blizzard')
  ) {

    return 'snow'

  }


  /* =======================================================
     NO OFFICIAL ALERT
     FIND STRONGEST SATARK FACTOR
  ======================================================= */

  const candidates = [

    {
      name: 'heatwave',

      score:
        factors.temperature?.score || 0
    },


    {
      name: 'flood',

      score:
        factors.rain?.score || 0
    },


    {
      name: 'landslide',

      score:
        factors.landslide_trigger?.score || 0
    },


    {
      name: 'snow',

      score:
        factors.snow?.score || 0
    }

  ]


  candidates.sort(
    (a, b) =>
      b.score - a.score
  )


  return (
    candidates[0]?.name ||
    'landslide'
  )

}


/* =========================================================
   HAZARD INDEX
========================================================= */

function getHazardIndex(
  risk,
  hazardType
) {

  const factors =
    risk?.factors || {}


  switch (hazardType) {


    case 'flood':

      return Math.round(
        (
          (factors.rain?.score || 0) /
          (factors.rain?.max_score || 25)
        ) * 100
      )


    case 'heatwave':

      return Math.round(
        (
          (factors.temperature?.score || 0) /
          (factors.temperature?.max_score || 10)
        ) * 100
      )


    case 'landslide':

      return Math.round(
        (
          (factors.landslide_trigger?.score || 0) /
          (factors.landslide_trigger?.max_score || 20)
        ) * 100
      )


    case 'snow':

      return Math.round(
        (
          (factors.snow?.score || 0) /
          (factors.snow?.max_score || 20)
        ) * 100
      )


    case 'cyclone':

      return Math.round(
        (
          (factors.wind?.score || 0) /
          (factors.wind?.max_score || 15)
        ) * 100
      )


    default:

      return risk?.score ?? 0

  }

}


/* =========================================================
   RECOMMENDED AGE
========================================================= */

function getRecommendedAge(data) {

  const risk =
    data?.risk || {}


  const location =
    data?.location || {}


  const score =
    risk.score ?? 0


  const elevation =
    location.elevation ?? 0


  if (score >= 80) {

    return 'Experienced adults only'

  }


  if (elevation >= 3000) {

    return 'Young adults & fit adults'

  }


  if (score >= 70) {

    return 'Fit adults & experienced travellers'

  }


  if (score >= 40) {

    return 'Young adults & adults'

  }


  return 'Most age groups'

}


/* =========================================================
   RECOMMENDED FITNESS
========================================================= */

function getRecommendedFitness(data) {

  const risk =
    data?.risk || {}


  const location =
    data?.location || {}


  const score =
    risk.score ?? 0


  const elevation =
    location.elevation ?? 0


  const hazard =
    getHazardType(data)


  if (score >= 80) {

    return 'High physical fitness required'

  }


  if (
    elevation >= 3000 ||
    hazard === 'landslide' ||
    hazard === 'snow'
  ) {

    return 'Good physical fitness'

  }


  if (
    hazard === 'flood' ||
    score >= 50
  ) {

    return 'Moderate fitness'

  }


  return 'Normal fitness'

}


/* =========================================================
   RECOMMENDED MEDICAL
========================================================= */

function getRecommendedMedical(data) {

  const risk =
    data?.risk || {}


  const location =
    data?.location || {}


  const score =
    risk.score ?? 0


  const elevation =
    location.elevation ?? 0


  const hazard =
    getHazardType(data)


  if (score >= 80) {

    return 'Healthy travellers preferred'

  }


  if (elevation >= 3000) {

    return 'Heart/respiratory conditions require caution'

  }


  if (hazard === 'heatwave') {

    return 'Heat-sensitive conditions require caution'

  }


  if (
    hazard === 'landslide' ||
    hazard === 'flood' ||
    hazard === 'snow'
  ) {

    return 'Mobility limitations require caution'

  }


  if (score >= 50) {

    return 'Review individual health needs'

  }


  return 'Generally suitable'

}


/* =========================================================
   TRAVELLER RECOMMENDATION
========================================================= */

function getTravellerRecommendation(data) {

  const risk =
    data?.risk || {}


  const location =
    data?.location || {}


  const score =
    risk.score ?? 0


  const elevation =
    location.elevation ?? 0


  const hazard =
    getHazardType(data)


  /* =======================================================
     VERY HIGH RISK
  ======================================================= */

  if (score >= 80) {

    return (
      'Currently best suited to experienced, physically fit adult travellers. ' +
      'Vulnerable travellers should consider postponing travel until conditions improve.'
    )

  }


  /* =======================================================
     HIGH ALTITUDE + LANDSLIDE
  ======================================================= */

  if (
    elevation >= 3000 &&
    hazard === 'landslide'
  ) {

    return (
      'Best suited to young adults and physically fit adults who can manage high altitude and difficult terrain. ' +
      'Elderly travellers and people with mobility, heart, or respiratory conditions should exercise additional caution.'
    )

  }


  /* =======================================================
     HIGH ALTITUDE
  ======================================================= */

  if (elevation >= 3000) {

    return (
      'Best suited to young adults and physically fit adults. ' +
      'Travellers with heart or respiratory conditions should take additional precautions because of the high altitude.'
    )

  }


  /* =======================================================
     LANDSLIDE
  ======================================================= */

  if (hazard === 'landslide') {

    return (
      'Best suited to physically fit adults and experienced travellers. ' +
      'People with mobility limitations and elderly travellers should exercise additional caution because unstable terrain can make movement and evacuation more difficult.'
    )

  }


  /* =======================================================
     FLOOD
  ======================================================= */

  if (hazard === 'flood') {

    return (
      'Generally better suited to adults who can adapt to changing weather. ' +
      'People with mobility limitations and other vulnerable travellers should exercise additional caution during heavy rainfall or flooding.'
    )

  }


  /* =======================================================
     HEATWAVE
  ======================================================= */

  if (hazard === 'heatwave') {

    return (
      'Best suited to healthy adults who can tolerate high temperatures. ' +
      'Elderly travellers, children, and people with cardiovascular or respiratory conditions should take additional precautions.'
    )

  }


  /* =======================================================
     CYCLONE
  ======================================================= */

  if (hazard === 'cyclone') {

    return (
      'Best suited to experienced adult travellers while severe weather remains possible. ' +
      'Vulnerable travellers should consider postponing travel if official warnings are active.'
    )

  }


  /* =======================================================
     SNOW
  ======================================================= */

  if (hazard === 'snow') {

    return (
      'Best suited to physically fit adults with appropriate cold-weather preparation. ' +
      'Travellers with mobility limitations or conditions affected by cold weather should exercise additional caution.'
    )

  }


  /* =======================================================
     MODERATE RISK
  ======================================================= */

  if (score >= 40) {

    return (
      'Generally suitable for young adults and adults with normal physical fitness. ' +
      'Travellers with significant medical conditions should review current conditions before travelling.'
    )

  }


  /* =======================================================
     LOW RISK
  ======================================================= */

  return (
    'Current conditions are generally suitable for most travellers, including families and older adults.'
  )

}


/* =========================================================
   PERSONAL SUITABILITY
========================================================= */

function PersonalSuitability({
  data,
  age,
  medicalConditions
}) {

  const score =
    data?.riskScore ?? 0


  const elevation =
    data?.elevation ?? 0


  const hazard =
    data?.hazard


  const numericAge =
    Number(age)


  let unsuitable = false

  let caution = false

  const reasons = []


  /* =======================================================
     AGE
  ======================================================= */

  if (numericAge >= 65) {

    if (
      hazard === 'landslide' ||
      hazard === 'snow' ||
      elevation >= 3000 ||
      score >= 70
    ) {

      caution = true

      reasons.push(
        'older travellers may face greater difficulty with altitude, unstable terrain, or demanding conditions'
      )

    }

  }


  if (
    numericAge > 0 &&
    numericAge < 12
  ) {

    if (
      elevation >= 3000 ||
      score >= 70 ||
      hazard === 'heatwave'
    ) {

      caution = true

      reasons.push(
        'young children may have greater difficulty adapting to demanding environmental conditions'
      )

    }

  }


  /* =======================================================
     HEART CONDITION
  ======================================================= */

  if (
    medicalConditions.includes(
      'Heart condition'
    ) &&
    elevation >= 3000
  ) {

    unsuitable = true

    reasons.push(
      'high altitude may increase cardiovascular strain'
    )

  }


  /* =======================================================
     RESPIRATORY CONDITION
  ======================================================= */

  if (
    medicalConditions.includes(
      'Respiratory condition'
    ) &&
    elevation >= 3000
  ) {

    unsuitable = true

    reasons.push(
      'high altitude and reduced oxygen availability may create additional respiratory concerns'
    )

  }


  /* =======================================================
     ASTHMA
  ======================================================= */

  if (
    medicalConditions.includes(
      'Asthma'
    ) &&
    (
      hazard === 'heatwave' ||
      hazard === 'snow'
    )
  ) {

    caution = true

    reasons.push(
      'the current environmental conditions may create additional breathing-related challenges'
    )

  }


  /* =======================================================
     MOBILITY
  ======================================================= */

  if (
    medicalConditions.includes(
      'Mobility limitations'
    ) &&
    (
      hazard === 'landslide' ||
      hazard === 'snow' ||
      elevation >= 3000
    )
  ) {

    unsuitable = true

    reasons.push(
      'steep, unstable, or difficult terrain may make movement and evacuation more difficult'
    )

  }


  /* =======================================================
     DIABETES
  ======================================================= */

  if (
    medicalConditions.includes(
      'Diabetes'
    ) &&
    hazard === 'heatwave'
  ) {

    caution = true

    reasons.push(
      'extreme heat can increase dehydration risk'
    )

  }


  /* =======================================================
     VERY HIGH DESTINATION RISK
  ======================================================= */

  if (score >= 80) {

    unsuitable = true

    reasons.push(
      'the destination currently has very high environmental risk'
    )

  }


  /* =======================================================
     FINAL STATUS
  ======================================================= */

  const status =
    unsuitable
      ? 'NOT RECOMMENDED'
      : caution
        ? 'USE CAUTION'
        : 'SUITABLE'


  const statusClass =
    unsuitable
      ? 'border-red-400/20 bg-red-400/[0.06] text-red-300'
      : caution
        ? 'border-amber-400/20 bg-amber-400/[0.06] text-amber-300'
        : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300'


  return (

    <div
      className={`rounded-lg border p-4 ${statusClass}`}
    >


      <div className="flex items-center justify-between">


        <div>

          <div className="text-[9px] font-bold uppercase tracking-[.18em] opacity-60">

            Your profile

          </div>


          <div className="mt-1 text-sm font-bold">

            {status}

          </div>

        </div>


        <div className="text-xl">

          {unsuitable
            ? '⚠'
            : caution
              ? '!'
              : '✓'}

        </div>

      </div>


      {reasons.length > 0 ? (

        <p className="mt-3 text-xs leading-6 opacity-70">

          {reasons.join('. ')}.

        </p>

      ) : (

        <p className="mt-3 text-xs leading-6 opacity-70">

          Your selected age and medical profile do not
          currently indicate an additional
          destination-specific concern.

        </p>

      )}

    </div>

  )

}