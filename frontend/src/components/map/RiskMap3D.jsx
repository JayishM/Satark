import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { MapPinned, Rotate3D } from 'lucide-react'

const CACHE_KEY = 'satark_location_cache'

/* =========================================================
   RISK HELPERS
========================================================= */

function getRiskColor(score) {
  if (score >= 80) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 40) return '#eab308'
  if (score >= 20) return '#84cc16'
  return '#22c55e'
}

function getRiskLabel(score) {
  if (score >= 80) return 'VERY HIGH'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MODERATE'
  if (score >= 20) return 'LOW'
  return 'VERY LOW'
}

/* =========================================================
   LOAD LOCATIONS FROM SATARK LOCAL STORAGE
========================================================= */

function getSavedLocations() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)

    if (!raw) {
      return []
    }

    const cache = JSON.parse(raw)

    return Object.values(cache)
      .map((entry) => {
        const location = entry?.data?.location

        if (!location) {
          return null
        }

        const coordinates = location.coordinates || []

        const latitude = Number(coordinates[0])
        const longitude = Number(coordinates[1])

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null
        }

        return {
          ...location,

          latitude,
          longitude,

          riskScore: Number(location.riskScore ?? 0),

          hazardIndex: Number(
            location.hazardIndex ?? 0
          ),

          elevation: Number(
            location.elevation ?? 0
          ),

          savedAt: entry.savedAt ?? 0,
        }
      })
      .filter(Boolean)
  } catch (error) {
    console.error(
      'SATARK 3D map storage error:',
      error
    )

    return []
  }
}

/* =========================================================
   GEOGRAPHIC PROJECTION
========================================================= */

function projectLocation(location, center) {
  const scale = 70

  const latDifference =
    location.latitude - center.latitude

  const lonDifference =
    location.longitude - center.longitude

  const latitudeRadians =
    center.latitude * Math.PI / 180

  const x =
    lonDifference *
    Math.cos(latitudeRadians) *
    scale

  const z =
    -latDifference * scale

  return {
    x,
    z,
  }
}

/* =========================================================
   3D TERRAIN
========================================================= */

function Terrain({
  riskScore,
  riskColor,
}) {
  const geometry = useMemo(() => {
    const size = 18
    const segments = 50

    const vertexCount =
      (segments + 1) *
      (segments + 1)

    const positions =
      new Float32Array(
        vertexCount * 3
      )

    const indices = []

    let vertex = 0

    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const px =
          (x / segments - 0.5) *
          size

        const pz =
          (z / segments - 0.5) *
          size

        const distance =
          Math.sqrt(
            px * px +
            pz * pz
          )

        /*
         * Creates a mountain/ridge structure
         * around the selected destination.
         */

        const centerInfluence =
          Math.max(
            0,
            1 - distance / 10
          )

        const ridge1 =
          Math.sin(px * 0.9) *
          Math.cos(pz * 0.7)

        const ridge2 =
          Math.sin(
            (px + pz) * 0.55
          )

        const ridge3 =
          Math.cos(
            (px - pz) * 0.35
          )

        /*
         * Actual SATARK risk controls
         * the intensity of the terrain.
         */

        const riskHeight =
          centerInfluence *
          (riskScore / 100) *
          3.8

        const height =
          0.15 +
          ridge1 * 0.3 +
          ridge2 * 0.18 +
          ridge3 * 0.15 +
          riskHeight

        positions[vertex * 3] =
          px

        positions[vertex * 3 + 1] =
          Math.max(0, height)

        positions[vertex * 3 + 2] =
          pz

        vertex++
      }
    }

    /*
     * Build triangles.
     */

    for (let z = 0; z < segments; z++) {
      for (let x = 0; x < segments; x++) {
        const a =
          z * (segments + 1) + x

        const b = a + 1

        const c =
          a + segments + 1

        const d = c + 1

        indices.push(
          a,
          c,
          b,

          b,
          c,
          d
        )
      }
    }

    return {
      positions,
      indices: new Uint32Array(indices),
    }
  }, [riskScore])

  return (
    <mesh>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            geometry.positions,
            3,
          ]}
        />

        <bufferAttribute
          attach="index"
          args={[
            geometry.indices,
            1,
          ]}
        />
      </bufferGeometry>

      <meshStandardMaterial
        color={riskColor}
        wireframe
        transparent
        opacity={0.72}
      />
    </mesh>
  )
}

/* =========================================================
   TERRAIN FLOOR
========================================================= */

function TerrainFloor() {
  return (
    <mesh
      rotation={[
        0,
        0,
        0,
      ]}
      position={[
        0,
        -0.4,
        0,
      ]}
    >
      <boxGeometry
        args={[
          19,
          0.3,
          19,
        ]}
      />

      <meshStandardMaterial
        color="#080d12"
      />
    </mesh>
  )
}

/* =========================================================
   GRID
========================================================= */

function TerrainGrid() {
  return (
    <gridHelper
      args={[
        20,
        20,
        '#26333d',
        '#131c24',
      ]}
      position={[
        0,
        -0.22,
        0,
      ]}
    />
  )
}

/* =========================================================
   LOCATION MARKER
========================================================= */

function LocationMarker({
  location,
  position,
  selected,
}) {
  const color =
    getRiskColor(
      location.riskScore
    )

  const height =
    Math.max(
      1,
      location.riskScore / 100 * 4
    )

  return (
    <group
      position={[
        position.x,
        height + 0.1,
        position.z,
      ]}
    >
      {/* vertical beam */}

      <mesh
        position={[
          0,
          -height / 2,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.025,
            0.025,
            height,
            12,
          ]}
        />

        <meshBasicMaterial
          color={color}
        />
      </mesh>

      {/* location marker */}

      <mesh>
        <sphereGeometry
          args={[
            selected ? 0.24 : 0.16,
            20,
            20,
          ]}
        />

        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={
            selected ? 2 : 1
          }
        />
      </mesh>

      {/* label */}

      <Text
        position={[
          0,
          0.5,
          0,
        ]}
        fontSize={
          selected ? 0.32 : 0.23
        }
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {location.name}
      </Text>
    </group>
  )
}

/* =========================================================
   SCENE
========================================================= */

function RiskScene({
  locations,
  selectedLocation,
}) {
  const center =
    selectedLocation ||
    locations[0]

  if (!center) {
    return null
  }

  const terrainColor =
    getRiskColor(
      center.riskScore
    )

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[
          9,
          8,
          10,
        ]}
        fov={45}
      />

      <ambientLight
        intensity={0.7}
      />

      <directionalLight
        position={[
          6,
          10,
          6,
        ]}
        intensity={2}
      />

      <pointLight
        position={[
          0,
          5,
          0,
        ]}
        color={terrainColor}
        intensity={3}
        distance={15}
      />

      <Terrain
        riskScore={
          center.riskScore
        }
        riskColor={
          terrainColor
        }
      />

      <TerrainFloor />

      <TerrainGrid />

      {locations.map(
        (location) => {
          const projected =
            projectLocation(
              location,
              center
            )

          /*
           * Keep markers inside
           * the visualization.
           */

          const x =
            Math.max(
              -8,
              Math.min(
                8,
                projected.x
              )
            )

          const z =
            Math.max(
              -8,
              Math.min(
                8,
                projected.z
              )
            )

          const selected =
            location.name ===
            center.name

          return (
            <LocationMarker
              key={
                location.name
              }
              location={
                location
              }
              position={{
                x,
                z,
              }}
              selected={
                selected
              }
            />
          )
        }
      )}

      <OrbitControls
        enableRotate
        enableZoom
        enablePan

        minDistance={5}
        maxDistance={25}

        minPolarAngle={0.35}
        maxPolarAngle={1.5}

        target={[
          0,
          0,
          0,
        ]}
      />
    </>
  )
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function RiskMap3D() {
  const [
    locations,
    setLocations,
  ] = useState([])

  const [
    selectedName,
    setSelectedName,
  ] = useState(null)

  /* =======================================================
     LOAD CACHE
  ======================================================= */

  useEffect(() => {
    const loadLocations = () => {
      const saved =
        getSavedLocations()

      setLocations(saved)

      if (saved.length === 0) {
        setSelectedName(null)
        return
      }

      /*
       * Keep currently selected location
       * if it still exists.
       */

      setSelectedName(
        current => {
          const stillExists =
            saved.some(
              location =>
                location.name ===
                current
            )

          if (stillExists) {
            return current
          }

          return saved[0].name
        }
      )
    }

    loadLocations()

    /*
     * localStorage events allow another
     * browser tab to update the map.
     */

    const handleStorage = (event) => {
      if (
        event.key === CACHE_KEY
      ) {
        loadLocations()
      }
    }

    window.addEventListener(
      'storage',
      handleStorage
    )

    /*
     * Also check periodically because
     * localStorage changes made in the
     * same tab do not fire storage events.
     */

    const interval =
      window.setInterval(
        loadLocations,
        3000
      )

    return () => {
      window.removeEventListener(
        'storage',
        handleStorage
      )

      window.clearInterval(
        interval
      )
    }
  }, [])

  /* =======================================================
     SELECTED LOCATION
  ======================================================= */

  const selectedLocation =
    locations.find(
      location =>
        location.name ===
        selectedName
    ) ||
    locations[0]

  /* =======================================================
     EMPTY STATE
  ======================================================= */

  if (!selectedLocation) {
    return (
      <section className="overflow-hidden rounded-xl border border-white/10 bg-[#05070b]">
        <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
          <MapPinned
            size={32}
            className="text-white/20"
          />

          <div className="mt-4 text-sm font-semibold text-white/60">
            No saved locations
          </div>

          <p className="mt-2 max-w-md text-xs leading-5 text-white/30">
            Search for a destination from the
            SATARK dashboard first. Its saved
            assessment will automatically appear
            on this 3D risk map.
          </p>
        </div>
      </section>
    )
  }

  const riskScore =
    Number(
      selectedLocation.riskScore ?? 0
    )

  const riskColor =
    getRiskColor(riskScore)

  const riskLabel =
    getRiskLabel(riskScore)

  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-[#05070b]">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">

        <div>
          <div className="flex items-center gap-2">
            <Rotate3D
              size={13}
              className="text-white/35"
            />

            <span className="text-[10px] font-bold uppercase tracking-[.2em] text-white/35">
              SATARK 3D Risk Intelligence
            </span>
          </div>

          <div className="mt-1 text-sm font-semibold text-white">
            {selectedLocation.name}
          </div>
        </div>

        <div className="flex items-center gap-5">

          <div className="text-right">
            <div
              className="text-xl font-black"
              style={{
                color: riskColor,
              }}
            >
              {riskScore}/100
            </div>

            <div className="text-[9px] font-bold uppercase tracking-widest text-white/30">
              {riskLabel}
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div>
            <div className="text-[9px] uppercase tracking-widest text-white/30">
              Hazard
            </div>

            <div
              className="mt-1 text-xs font-bold capitalize"
              style={{
                color: riskColor,
              }}
            >
              {selectedLocation.hazard}
            </div>
          </div>

        </div>
      </div>

      {/* =================================================
          3D MAP
      ================================================= */}

      <div className="relative h-[520px]">

        <Canvas
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
          }}
        >
          <RiskScene
            locations={
              locations
            }
            selectedLocation={
              selectedLocation
            }
          />
        </Canvas>

        {/* hazard index */}

        <div className="absolute right-4 top-4 z-10 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl">

          <div className="text-[9px] uppercase tracking-widest text-white/30">
            Hazard Index
          </div>

          <div
            className="mt-1 text-xl font-black"
            style={{
              color: riskColor,
            }}
          >
            {selectedLocation.hazardIndex}/100
          </div>

        </div>

        {/* legend */}

        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-xl">

          <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">
            3D Risk Surface
          </div>

          <div className="mt-1 text-[9px] text-white/30">
            Higher terrain = higher risk
          </div>

          <div className="mt-3 flex items-center gap-2">

            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  riskColor,
              }}
            />

            <span className="text-[9px] uppercase tracking-widest text-white/40">
              {riskLabel} risk
            </span>

          </div>

        </div>

        {/* controls */}

        <div className="absolute bottom-4 right-4 z-10 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[9px] text-white/30 backdrop-blur-xl">
          Drag to rotate • Scroll to zoom
        </div>

      </div>

      {/* =================================================
          SAVED LOCATIONS
      ================================================= */}

      <div className="border-t border-white/10 px-5 py-4">

        <div className="flex items-center gap-2">

          <MapPinned
            size={15}
            className="text-white/40"
          />

          <span className="text-xs font-bold">
            Saved destinations
          </span>

          <span className="text-[9px] text-white/25">
            {locations.length}
          </span>

        </div>

        <div className="mt-4 flex flex-wrap gap-2">

          {locations.map(
            location => {

              const color =
                getRiskColor(
                  location.riskScore
                )

              const selected =
                location.name ===
                selectedName

              return (
                <button
                  key={
                    location.name
                  }
                  type="button"
                  onClick={() =>
                    setSelectedName(
                      location.name
                    )
                  }
                  className={`
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    px-3
                    py-2
                    transition
                    ${
                      selected
                        ? 'border-white/20 bg-white/[.08]'
                        : 'border-white/5 bg-white/[.025] hover:bg-white/[.05]'
                    }
                  `}
                >

                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        color,
                    }}
                  />

                  <span className="text-[10px] font-semibold text-white/70">
                    {location.name}
                  </span>

                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color,
                    }}
                  >
                    {location.riskScore}
                  </span>

                </button>
              )
            }
          )}

        </div>

      </div>

      {/* =================================================
          METRICS
      ================================================= */}

      <div className="grid grid-cols-3 border-t border-white/10">

        <Metric
          label="Risk Score"
          value={`${riskScore}/100`}
        />

        <Metric
          label="Hazard Index"
          value={`${selectedLocation.hazardIndex}/100`}
        />

        <Metric
          label="Elevation"
          value={`${selectedLocation.elevation}m`}
        />

      </div>

    </section>
  )
}

/* =========================================================
   METRIC
========================================================= */

function Metric({
  label,
  value,
}) {
  return (
    <div className="border-r border-white/10 px-4 py-4 last:border-r-0">

      <div className="text-[9px] uppercase tracking-widest text-white/25">
        {label}
      </div>

      <div className="mt-1 text-sm font-bold text-white">
        {value}
      </div>

    </div>
  )
}