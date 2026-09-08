import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  OrbitControls,
  PerspectiveCamera,
  Text,
  Float,
} from '@react-three/drei'
import {
  MapPinned,
  Rotate3D,
  Compass,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import * as THREE from 'three'

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
   TERRAIN COLOR
========================================================= */

function getTerrainColor(risk) {
  if (risk >= 80) {
    return [0.94, 0.12, 0.12]
  }

  if (risk >= 60) {
    return [0.95, 0.32, 0.08]
  }

  if (risk >= 40) {
    return [0.92, 0.68, 0.04]
  }

  if (risk >= 20) {
    return [0.45, 0.75, 0.12]
  }

  return [0.08, 0.78, 0.40]
}

/* =========================================================
   LOAD SAVED LOCATIONS
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

          riskScore: Number(
            location.riskScore ?? 0
          ),

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

function projectLocation(
  location,
  center
) {
  const scale = 42

  const latDifference =
    location.latitude -
    center.latitude

  const lonDifference =
    location.longitude -
    center.longitude

  const latitudeRadians =
    center.latitude *
    Math.PI /
    180

  return {
    x:
      lonDifference *
      Math.cos(latitudeRadians) *
      scale,

    z:
      -latDifference *
      scale,
  }
}

/* =========================================================
   TERRAIN HEIGHT
========================================================= */

function terrainHeight(
  x,
  z,
  riskScore
) {
  const broad =
    Math.sin(x * 0.42) *
    Math.cos(z * 0.38)

  const ridge =
    Math.sin(
      x * 0.92 +
      z * 0.18
    )

  const secondary =
    Math.cos(
      z * 0.72 -
      x * 0.25
    )

  const fine =
    Math.sin(
      (x + z) * 1.65
    ) * 0.12

  const valley =
    Math.cos(
      Math.sqrt(
        x * x +
        z * z
      ) * 0.7
    )

  const distance =
    Math.sqrt(
      x * x +
      z * z
    )

  const centerInfluence =
    Math.max(
      0,
      1 -
        distance / 11
    )

  const riskInfluence =
    centerInfluence *
    (riskScore / 100)

  return (
    0.15 +
    broad * 0.42 +
    ridge * 0.28 +
    secondary * 0.22 +
    fine +
    valley * 0.1 +
    riskInfluence * 4
  )
}

/* =========================================================
   CREATE TERRAIN GEOMETRY
========================================================= */

function createTerrainGeometry(
  riskScore
) {
  const size = 20
  const segments = 90

  const geometry =
    new THREE.BufferGeometry()

  const positions =
    new Float32Array(
      (segments + 1) *
      (segments + 1) *
      3
    )

  const colors =
    new Float32Array(
      (segments + 1) *
      (segments + 1) *
      3
    )

  const indices = []

  let vertex = 0

  for (
    let z = 0;
    z <= segments;
    z++
  ) {
    for (
      let x = 0;
      x <= segments;
      x++
    ) {
      const px =
        (
          x /
            segments -
          0.5
        ) *
        size

      const pz =
        (
          z /
            segments -
          0.5
        ) *
        size

      const height =
        terrainHeight(
          px,
          pz,
          riskScore
        )

      positions[
        vertex * 3
      ] = px

      positions[
        vertex * 3 + 1
      ] =
        Math.max(
          0,
          height
        )

      positions[
        vertex * 3 + 2
      ] = pz

      const normalizedHeight =
        Math.min(
          1,
          Math.max(
            0,
            height / 5
          )
        )

      const localRisk =
        Math.min(
          100,
          Math.max(
            0,
            riskScore +
              (
                normalizedHeight -
                0.5
              ) *
                35
          )
        )

      const [
        r,
        g,
        b,
      ] =
        getTerrainColor(
          localRisk
        )

      colors[
        vertex * 3
      ] = r

      colors[
        vertex * 3 + 1
      ] = g

      colors[
        vertex * 3 + 2
      ] = b

      vertex++
    }
  }

  for (
    let z = 0;
    z < segments;
    z++
  ) {
    for (
      let x = 0;
      x < segments;
      x++
    ) {
      const a =
        z *
          (segments + 1) +
        x

      const b =
        a + 1

      const c =
        a +
        segments +
        1

      const d =
        c + 1

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

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      positions,
      3
    )
  )

  geometry.setAttribute(
    'color',
    new THREE.BufferAttribute(
      colors,
      3
    )
  )

  /*
   * IMPORTANT:
   * Use setIndex() instead of
   * <bufferAttribute attach="index" />
   * because the latter caused the
   * R3F "Index is not part of THREE"
   * error in your setup.
   */
  geometry.setIndex(indices)

  geometry.computeVertexNormals()

  return geometry
}

/* =========================================================
   TERRAIN
========================================================= */

function Terrain({
  riskScore,
}) {
  const geometry =
    useMemo(
      () =>
        createTerrainGeometry(
          riskScore
        ),
      [riskScore]
    )

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  return (
    <group>

      {/* SOLID TERRAIN */}

      <mesh
        geometry={geometry}
        receiveShadow
      >
        <meshStandardMaterial
          vertexColors
          roughness={0.92}
          metalness={0.04}
          transparent
          opacity={0.58}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* WIREFRAME TERRAIN */}

      <mesh
        geometry={geometry}
      >
        <meshBasicMaterial
          color="#f59e0b"
          wireframe
          transparent
          opacity={0.22}
        />
      </mesh>

    </group>
  )
}

/* =========================================================
   TERRAIN FLOOR
========================================================= */

function TerrainFloor() {
  return (
    <mesh
      position={[
        0,
        -0.48,
        0,
      ]}
      receiveShadow
    >
      <boxGeometry
        args={[
          21,
          0.25,
          21,
        ]}
      />

      <meshStandardMaterial
        color="#05080c"
        roughness={1}
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
        21,
        30,
        '#394651',
        '#121a22',
      ]}
      position={[
        0,
        -0.3,
        0,
      ]}
    />
  )
}

/* =========================================================
   RISK RING
========================================================= */

function RiskRing({
  color,
}) {
  const ref =
    useRef(null)

  useFrame(
    ({
      clock,
    }) => {
      if (!ref.current) {
        return
      }

      const pulse =
        1 +
        Math.sin(
          clock.getElapsedTime() *
            2
        ) *
          0.08

      ref.current.scale.set(
        pulse,
        pulse,
        pulse
      )

      ref.current.material.opacity =
        0.22 +
        (
          Math.sin(
            clock.getElapsedTime() *
              2
          ) +
          1
        ) *
          0.07
    }
  )

  return (
    <mesh
      ref={ref}
      rotation={[
        -Math.PI / 2,
        0,
        0,
      ]}
      position={[
        0,
        0.08,
        0,
      ]}
    >
      <torusGeometry
        args={[
          0.58,
          0.025,
          12,
          64,
        ]}
      />

      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
      />
    </mesh>
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
      (
        location.riskScore /
        100
      ) *
        4.5
    )

  return (
    <group
      position={[
        position.x,
        height + 0.1,
        position.z,
      ]}
    >

      {/* GLOW */}

      <pointLight
        color={color}
        intensity={
          selected
            ? 2.5
            : 0.5
        }
        distance={
          selected
            ? 5
            : 2.5
        }
      />

      {/* BEAM */}

      <mesh
        position={[
          0,
          -height / 2,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            selected
              ? 0.035
              : 0.018,
            selected
              ? 0.035
              : 0.018,
            height,
            12,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={
            selected
              ? 0.9
              : 0.5
          }
        />
      </mesh>

      {/* GROUND GLOW */}

      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
        position={[
          0,
          -height +
            0.12,
          0,
        ]}
      >
        <circleGeometry
          args={[
            selected
              ? 0.7
              : 0.35,
            32,
          ]}
        />

        <meshBasicMaterial
          color={color}
          transparent
          opacity={
            selected
              ? 0.15
              : 0.07
          }
        />
      </mesh>

      {/* MARKER */}

      <Float
        speed={
          selected
            ? 2
            : 1
        }
        rotationIntensity={0}
        floatIntensity={
          selected
            ? 0.12
            : 0.04
        }
      >
        <mesh>
          <sphereGeometry
            args={[
              selected
                ? 0.27
                : 0.15,
              24,
              24,
            ]}
          />

          <meshStandardMaterial
            color="#ffffff"
            emissive={color}
            emissiveIntensity={
              selected
                ? 3
                : 1.2
            }
            roughness={0.15}
            metalness={0.2}
          />
        </mesh>
      </Float>

      {/* SELECTED RING */}

      {selected && (
        <RiskRing
          color={color}
        />
      )}

      {/* NAME */}

      <Text
        position={[
          0,
          0.65,
          0,
        ]}
        fontSize={
          selected
            ? 0.34
            : 0.21
        }
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={
          selected
            ? 0.035
            : 0.02
        }
        outlineColor="#000000"
        maxWidth={2}
      >
        {location.name}
      </Text>

      {/* SCORE */}

      {selected && (
        <Text
          position={[
            0,
            0.3,
            0,
          ]}
          fontSize={0.17}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {location.riskScore}/100
        </Text>
      )}

    </group>
  )
}

/* =========================================================
   COMPASS
========================================================= */

function MapCompass() {
  return (
    <group
      position={[
        -8,
        0.25,
        -8,
      ]}
    >
      <mesh
        rotation={[
          -Math.PI / 2,
          0,
          0,
        ]}
      >
        <circleGeometry
          args={[
            0.45,
            32,
          ]}
        />

        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.04}
        />
      </mesh>

      <Text
        position={[
          0,
          0.05,
          0,
        ]}
        fontSize={0.18}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        N
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

  return (
    <>

      {/* CAMERA */}

      <PerspectiveCamera
        makeDefault
        position={[
          9,
          6.5,
          9,
        ]}
        fov={48}
      />

      {/* BACKGROUND */}

      <color
        attach="background"
        args={[
          '#03060a',
        ]}
      />

      <fog
        attach="fog"
        args={[
          '#03060a',
          13,
          29,
        ]}
      />

      {/* LIGHTING */}

      <ambientLight
        intensity={0.45}
      />

      <directionalLight
        position={[
          8,
          12,
          5,
        ]}
        intensity={2.3}
        castShadow
      />

      <directionalLight
        position={[
          -8,
          5,
          -6,
        ]}
        intensity={0.6}
      />

      <pointLight
        position={[
          0,
          6,
          0,
        ]}
        color={getRiskColor(
          center.riskScore
        )}
        intensity={3.5}
        distance={18}
      />

      {/* TERRAIN */}

      <Terrain
        riskScore={
          center.riskScore
        }
      />

      <TerrainFloor />

      <TerrainGrid />

      <MapCompass />

      {/* LOCATION MARKERS */}

      {locations.map(
        (location) => {
          const projected =
            projectLocation(
              location,
              center
            )

          const x =
            Math.max(
              -8.8,
              Math.min(
                8.8,
                projected.x
              )
            )

          const z =
            Math.max(
              -8.8,
              Math.min(
                8.8,
                projected.z
              )
            )

          const selected =
            location.name ===
            center.name

          return (
            <LocationMarker
              key={`${location.name}-${location.latitude}-${location.longitude}`}
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

      {/* CAMERA CONTROLS */}

      <OrbitControls
        enableRotate
        enableZoom
        enablePan
        enableDamping
        dampingFactor={0.06}
        minDistance={5}
        maxDistance={27}
        minPolarAngle={0.45}
        maxPolarAngle={1.45}
        target={[
          0,
          1.2,
          0,
        ]}
      />

    </>
  )
}

/* =========================================================
   MAP LAYERS
========================================================= */

const MAP_LAYERS = [
  {
    id: 'overall',
    label: 'Overall Risk',
    short: 'Overall',
  },
  {
    id: 'hazard',
    label: 'Dominant Hazard',
    short: 'Hazard',
  },
  {
    id: 'alerts',
    label: 'Official Alerts',
    short: 'Alerts',
  },
]

/* =========================================================
   LAYER SCORE
========================================================= */

function getLayerScore(
  location,
  layer
) {
  if (!location) {
    return null
  }

  if (layer === 'overall') {
    return Number(
      location.riskScore ?? 0
    )
  }

  if (layer === 'hazard') {
    return Number(
      location.hazardIndex ?? 0
    )
  }

  /*
   * We do not invent an alert score.
   * If your backend later provides
   * alert severity, wire it here.
   */
  return null
}

/* =========================================================
   HAZARD DRIVERS
========================================================= */

function getHazardDrivers(
  hazard
) {
  const value =
    String(hazard || '')
      .toLowerCase()

  if (
    value.includes(
      'landslide'
    )
  ) {
    return [
      'Steep terrain exposure',
      'Heavy precipitation sensitivity',
      'High-elevation environment',
    ]
  }

  if (
    value.includes(
      'flood'
    )
  ) {
    return [
      'Precipitation intensity',
      'Surface-water exposure',
      'Low-lying / drainage sensitivity',
    ]
  }

  if (
    value.includes(
      'wind'
    )
  ) {
    return [
      'Wind-speed exposure',
      'Peak gust potential',
      'Open-area exposure',
    ]
  }

  if (
    value.includes(
      'heat'
    ) ||
    value.includes(
      'temperature'
    )
  ) {
    return [
      'Temperature stress',
      'Apparent-temperature exposure',
      'Duration of heat conditions',
    ]
  }

  if (
    value.includes(
      'snow'
    ) ||
    value.includes(
      'avalanche'
    )
  ) {
    return [
      'Snow exposure',
      'Low-temperature conditions',
      'Mountain environment',
    ]
  }

  return [
    'Current environmental conditions',
    'Destination hazard exposure',
    'Forecast conditions',
  ]
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

  /*
   * FIX:
   * fullscreen was being referenced
   * without being declared.
   */
  const [
    fullscreen,
    setFullscreen,
  ] = useState(false)

  const [
    activeLayer,
    setActiveLayer,
  ] = useState('overall')

  const [
    showWhy,
    setShowWhy,
  ] = useState(false)

  const [
    forecastHour,
    setForecastHour,
  ] = useState(0)

  /* =======================================================
     LOAD LOCATIONS
  ======================================================= */

  useEffect(() => {
    const loadLocations = () => {
      const saved =
        getSavedLocations()

      setLocations(saved)

      if (
        saved.length === 0
      ) {
        setSelectedName(
          null
        )

        return
      }

      setSelectedName(
        (current) => {
          const exists =
            saved.some(
              (location) =>
                location.name ===
                current
            )

          if (exists) {
            return current
          }

          return saved[0].name
        }
      )
    }

    loadLocations()

    const handleStorage =
      (event) => {
        if (
          event.key ===
          CACHE_KEY
        ) {
          loadLocations()
        }
      }

    window.addEventListener(
      'storage',
      handleStorage
    )

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
     ESCAPE FULLSCREEN
  ======================================================= */

  useEffect(() => {
    const handleKeyDown = (
      event
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        setFullscreen(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [])

  /* =======================================================
     SELECTED LOCATION
  ======================================================= */

  const selectedLocation =
    locations.find(
      (location) =>
        location.name ===
        selectedName
    ) ||
    locations[0]

  /* =======================================================
     EMPTY STATE
  ======================================================= */

  if (!selectedLocation) {
    return (
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#03060a]">

        <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.03]">

            <MapPinned
              size={25}
              className="text-white/30"
            />

          </div>

          <div className="mt-5 text-sm font-semibold text-white/70">
            No destinations mapped
          </div>

          <p className="mt-2 max-w-md text-xs leading-5 text-white/30">
            Search for a destination from
            the SATARK dashboard first.
            Saved assessments will
            automatically appear here.
          </p>

        </div>

      </section>
    )
  }

  /* =======================================================
     RISK VALUES
  ======================================================= */

  const riskScore =
    Number(
      selectedLocation.riskScore ??
        0
    )

  const hazardIndex =
    Number(
      selectedLocation.hazardIndex ??
        0
    )

  const riskColor =
    getRiskColor(
      riskScore
    )

  const riskLabel =
    getRiskLabel(
      riskScore
    )

  /*
   * Dynamic value for selected layer.
   */
  const layerScore =
    getLayerScore(
      selectedLocation,
      activeLayer
    )

  const layerLabel =
    activeLayer ===
    'overall'
      ? 'Overall Risk'
      : activeLayer ===
        'hazard'
        ? 'Hazard Index'
        : 'Official Alerts'

  /* =======================================================
     FULLSCREEN SECTION CLASS
  ======================================================= */

  const sectionClass =
    fullscreen
      ? `
        fixed
        inset-4
        z-50
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-[#03060a]
        shadow-2xl
      `
      : `
        overflow-hidden
        rounded-2xl
        border
        border-white/10
        bg-[#03060a]
        shadow-2xl
      `

  return (
    <section
      className={sectionClass}
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex flex-col gap-4 border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl md:flex-row md:items-center md:justify-between">

        <div>

          <div className="flex items-center gap-2">

            <div
              className="flex h-6 w-6 items-center justify-center rounded-md border"
              style={{
                borderColor:
                  `${riskColor}44`,
                background:
                  `${riskColor}12`,
              }}
            >
              <Rotate3D
                size={12}
                style={{
                  color:
                    riskColor,
                }}
              />
            </div>

            <span className="text-[9px] font-bold uppercase tracking-[.22em] text-white/35">
              SATARK / Geospatial Intelligence
            </span>

          </div>

          <div className="mt-2 flex items-center gap-3">

            <h2 className="text-sm font-bold text-white">
              {selectedLocation.name}
            </h2>

            <span
              className="rounded-md border px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest"
              style={{
                color:
                  riskColor,
                borderColor:
                  `${riskColor}44`,
                background:
                  `${riskColor}0d`,
              }}
            >
              {riskLabel}
            </span>

          </div>

        </div>

        <div className="flex items-center gap-5">

          {/* OVERALL RISK */}

          <div className="text-right">

            <div
              className="text-2xl font-black tracking-tight"
              style={{
                color:
                  riskColor,
              }}
            >
              {riskScore}

              <span className="text-sm text-white/25">
                /100
              </span>
            </div>

            <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/25">
              Overall Risk
            </div>

          </div>

          <div className="h-9 w-px bg-white/10" />

          {/* DOMINANT HAZARD */}

          <div>

            <div className="text-[8px] uppercase tracking-[.18em] text-white/25">
              Dominant Hazard
            </div>

            <div
              className="mt-1 text-xs font-bold capitalize"
              style={{
                color:
                  riskColor,
              }}
            >
              {selectedLocation.hazard ||
                'Environmental'}
            </div>

          </div>

          {/* FULLSCREEN */}

          <button
            type="button"
            onClick={() =>
              setFullscreen(
                (value) =>
                  !value
              )
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[.03] text-white/40 transition hover:bg-white/[.08] hover:text-white"
            title={
              fullscreen
                ? 'Exit fullscreen'
                : 'Toggle fullscreen'
            }
          >
            {fullscreen ? (
              <Minimize2
                size={13}
              />
            ) : (
              <Maximize2
                size={13}
              />
            )}
          </button>

        </div>

      </div>

      {/* =================================================
          MAP
      ================================================= */}

      <div
        className={`
          relative
          ${
            fullscreen
              ? 'h-[calc(100vh-260px)]'
              : 'h-[580px]'
          }
        `}
      >

        <Canvas
          dpr={[
            1,
            1.75,
          ]}
          shadows
          gl={{
            antialias: true,
            powerPreference:
              'high-performance',
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

        {/* =================================================
            MAP LAYER CONTROL
        ================================================= */}

        <div className="absolute left-4 top-4 z-20 w-[165px] rounded-xl border border-white/10 bg-black/65 p-2.5 shadow-2xl backdrop-blur-xl">

          <div className="px-2 pb-2 text-[8px] font-bold uppercase tracking-[.18em] text-white/30">
            Map Layers
          </div>

          <div className="space-y-1">

            {MAP_LAYERS.map(
              (layer) => {
                const active =
                  activeLayer ===
                  layer.id

                return (
                  <button
                    key={
                      layer.id
                    }
                    type="button"
                    onClick={() =>
                      setActiveLayer(
                        layer.id
                      )
                    }
                    className={`
                      flex
                      w-full
                      items-center
                      gap-2
                      rounded-lg
                      px-2.5
                      py-2
                      text-left
                      transition
                      ${
                        active
                          ? 'bg-white/[.09] text-white'
                          : 'text-white/35 hover:bg-white/[.04] hover:text-white/70'
                      }
                    `}
                  >

                    <span
                      className={`
                        h-1.5
                        w-1.5
                        rounded-full
                        ${
                          active
                            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.8)]'
                            : 'bg-white/20'
                        }
                      `}
                    />

                    <span className="text-[9px] font-semibold">
                      {
                        layer.label
                      }
                    </span>

                  </button>
                )
              }
            )}

          </div>

        </div>

        {/* =================================================
            LIVE STATUS
        ================================================= */}

        <div className="absolute left-[190px] top-4 z-10 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-xl">

          <div className="flex items-center gap-2">

            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{
                background:
                  riskColor,
                boxShadow:
                  `0 0 10px ${riskColor}`,
              }}
            />

            <span className="text-[8px] font-bold uppercase tracking-[.18em] text-white/50">
              Live Risk Surface
            </span>

          </div>

          <div className="mt-1 text-[8px] text-white/25">
            Geospatial visualization
          </div>

        </div>

        {/* =================================================
            ACTIVE LAYER SCORE
        ================================================= */}

        <div className="absolute right-4 top-4 z-10 rounded-xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">

          <div className="text-[8px] uppercase tracking-[.18em] text-white/25">
            {layerLabel}
          </div>

          <div
            className="mt-1 text-2xl font-black"
            style={{
              color:
                riskColor,
            }}
          >
            {layerScore === null
              ? '—'
              : layerScore}

            {layerScore !== null && (
              <span className="text-xs text-white/25">
                /100
              </span>
            )}
          </div>

          {layerScore !== null ? (
            <div className="mt-2 h-1 w-28 overflow-hidden rounded-full bg-white/10">

              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      layerScore
                    )
                  )}%`,
                  background:
                    riskColor,
                }}
              />

            </div>
          ) : (
            <div className="mt-2 text-[8px] leading-4 text-white/25">
              No alert severity score
              available.
            </div>
          )}

        </div>

        {/* =================================================
            WHY THIS RISK
        ================================================= */}

        <div className="absolute right-4 top-[145px] z-20 w-[235px] rounded-xl border border-white/10 bg-black/65 p-4 shadow-2xl backdrop-blur-xl">

          <button
            type="button"
            onClick={() =>
              setShowWhy(
                (value) =>
                  !value
              )
            }
            className="flex w-full items-center justify-between"
          >

            <div className="text-left">

              <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/30">
                Risk Intelligence
              </div>

              <div className="mt-1 text-xs font-bold text-white">
                Why is this risky?
              </div>

            </div>

            <span
              className="text-xs"
              style={{
                color:
                  riskColor,
              }}
            >
              {showWhy
                ? '−'
                : '+'}
            </span>

          </button>

          {showWhy && (
            <div className="mt-4 border-t border-white/10 pt-3">

              <div className="text-[8px] uppercase tracking-[.15em] text-white/25">
                Dominant threat
              </div>

              <div
                className="mt-1 text-sm font-bold"
                style={{
                  color:
                    riskColor,
                }}
              >
                {selectedLocation.hazard ||
                  'Environmental'}
              </div>

              <div className="mt-3 space-y-2">

                {getHazardDrivers(
                  selectedLocation.hazard
                ).map(
                  (
                    driver
                  ) => (
                    <div
                      key={
                        driver
                      }
                      className="flex items-start gap-2"
                    >

                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{
                          background:
                            riskColor,
                        }}
                      />

                      <span className="text-[9px] leading-4 text-white/45">
                        {driver}
                      </span>

                    </div>
                  )
                )}

              </div>

              <div className="mt-4 rounded-lg border border-white/5 bg-white/[.025] p-2.5">

                <div className="text-[8px] font-bold uppercase tracking-widest text-white/25">
                  SATARK assessment
                </div>

                <div className="mt-1 text-[9px] leading-4 text-white/45">

                  {riskScore >=
                  80
                    ? 'Conditions indicate a very high-risk environment. Travel should be reconsidered.'
                    : riskScore >=
                      60
                      ? 'Conditions indicate elevated risk. Extra precautions are recommended.'
                      : riskScore >=
                        40
                        ? 'Conditions indicate moderate environmental risk. Monitor conditions before travel.'
                        : 'Current conditions indicate comparatively lower environmental risk.'}

                </div>

              </div>

            </div>
          )}

        </div>

        {/* =================================================
            LEGEND
        ================================================= */}

        <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl">

          <div className="flex items-center gap-2">

            <div
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  riskColor,
                boxShadow:
                  `0 0 8px ${riskColor}`,
              }}
            />

            <span className="text-[8px] font-bold uppercase tracking-[.18em] text-white/40">
              Risk Surface
            </span>

          </div>

          <div className="mt-2 text-[8px] text-white/25">
            Elevated terrain indicates
            higher relative risk.
          </div>

        </div>

        {/* =================================================
            RISK TIMELINE
        ================================================= */}

        <div className="absolute bottom-4 left-1/2 z-20 w-[360px] -translate-x-1/2 rounded-xl border border-white/10 bg-black/65 px-4 py-3 backdrop-blur-xl">

          <div className="flex items-center justify-between">

            <div>

              <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/30">
                Risk Horizon
              </div>

              <div className="mt-1 text-[10px] font-bold text-white">
                {forecastHour ===
                0
                  ? 'Current conditions'
                  : `+${forecastHour} hours`}
              </div>

            </div>

            <div
              className="text-sm font-black"
              style={{
                color:
                  riskColor,
              }}
            >
              {riskScore}/100
            </div>

          </div>

          <input
            type="range"
            min="0"
            max="24"
            step="6"
            value={
              forecastHour
            }
            onChange={(
              event
            ) =>
              setForecastHour(
                Number(
                  event.target
                    .value
                )
              )
            }
            className="mt-3 w-full accent-amber-400"
          />

          <div className="mt-1 flex justify-between text-[7px] uppercase tracking-widest text-white/20">

            <span>
              Now
            </span>

            <span>
              +6h
            </span>

            <span>
              +12h
            </span>

            <span>
              +18h
            </span>

            <span>
              +24h
            </span>

          </div>

        </div>

        {/* =================================================
            CONTROLS
        ================================================= */}

        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[8px] text-white/25 backdrop-blur-xl">

          <Rotate3D
            size={11}
            className="text-white/35"
          />

          <span>
            Drag to rotate
          </span>

          <span className="text-white/10">
            •
          </span>

          <span>
            Scroll to zoom
          </span>

        </div>

      </div>

      {/* =================================================
          SAVED DESTINATIONS
      ================================================= */}

      <div className="border-t border-white/10 bg-black/10 px-5 py-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2">

            <MapPinned
              size={14}
              className="text-white/35"
            />

            <span className="text-[10px] font-bold uppercase tracking-[.12em] text-white/60">
              Saved destinations
            </span>

            <span className="rounded-md bg-white/[.05] px-1.5 py-0.5 text-[8px] text-white/30">
              {
                locations.length
              }
            </span>

          </div>

          <div className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-white/20">

            <Compass
              size={11}
            />

            Interactive terrain

          </div>

        </div>

        <div className="mt-4 flex flex-wrap gap-2">

          {locations.map(
            (location) => {
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
                    group
                    flex
                    items-center
                    gap-2
                    rounded-lg
                    border
                    px-3
                    py-2
                    transition-all
                    ${
                      selected
                        ? 'border-white/20 bg-white/[.08] shadow-lg'
                        : 'border-white/5 bg-white/[.02] hover:border-white/10 hover:bg-white/[.05]'
                    }
                  `}
                >

                  <span
                    className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-125"
                    style={{
                      background:
                        color,
                      boxShadow:
                        selected
                          ? `0 0 8px ${color}`
                          : 'none',
                    }}
                  />

                  <span
                    className={`
                      text-[9px] font-semibold
                      ${
                        selected
                          ? 'text-white'
                          : 'text-white/50'
                      }
                    `}
                  >
                    {
                      location.name
                    }
                  </span>

                  <span
                    className="text-[9px] font-black"
                    style={{
                      color,
                    }}
                  >
                    {
                      location.riskScore
                    }
                  </span>

                </button>
              )
            }
          )}

        </div>

      </div>

      {/* =================================================
          TRAVELLER INTELLIGENCE
      ================================================= */}

      <div className="border-t border-white/10 px-5 py-4">

        <div className="flex items-center justify-between">

          <div>

            <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/25">
              Traveller Intelligence
            </div>

            <div className="mt-1 text-xs font-bold text-white/70">
              Destination suitability
            </div>

          </div>

          <span className="rounded-md border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-amber-400">
            SATARK AI
          </span>

        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3">

          <div className="rounded-lg border border-white/5 bg-white/[.025] p-3">

            <div className="text-[8px] uppercase tracking-widest text-white/20">
              Destination
            </div>

            <div className="mt-1 text-[10px] font-bold text-white/70">
              {
                selectedLocation.name
              }
            </div>

          </div>

          <div className="rounded-lg border border-white/5 bg-white/[.025] p-3">

            <div className="text-[8px] uppercase tracking-widest text-white/20">
              Risk profile
            </div>

            <div
              className="mt-1 text-[10px] font-bold"
              style={{
                color:
                  riskColor,
              }}
            >
              {
                riskLabel
              }
            </div>

          </div>

          <div className="rounded-lg border border-white/5 bg-white/[.025] p-3">

            <div className="text-[8px] uppercase tracking-widest text-white/20">
              Primary concern
            </div>

            <div className="mt-1 text-[10px] font-bold capitalize text-white/70">
              {
                selectedLocation.hazard ||
                'Environmental'
              }
            </div>

          </div>

        </div>

      </div>

      {/* =================================================
          METRICS
      ================================================= */}

      <div className="grid grid-cols-4 border-t border-white/10">

        <Metric
          label="Alert Status"
          value={
            selectedLocation.hazard
              ? 'MONITORED'
              : 'CLEAR'
          }
        />

        <Metric
          label="Risk Score"
          value={`${riskScore}/100`}
          accent={
            riskColor
          }
        />

        <Metric
          label={
            activeLayer ===
            'overall'
              ? 'Overall Risk'
              : activeLayer ===
                'hazard'
                ? 'Hazard Index'
                : 'Alert Status'
          }
          value={
            activeLayer ===
            'overall'
              ? `${riskScore}/100`
              : activeLayer ===
                'hazard'
                ? `${hazardIndex}/100`
                : '—'
          }
          accent={
            activeLayer ===
            'alerts'
              ? undefined
              : riskColor
          }
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
  accent,
}) {
  return (
    <div className="relative border-r border-white/10 px-5 py-4 last:border-r-0">

      {accent && (
        <div
          className="absolute left-0 top-0 h-px w-12"
          style={{
            background:
              accent,
          }}
        />
      )}

      <div className="text-[8px] font-bold uppercase tracking-[.18em] text-white/20">
        {label}
      </div>

      <div
        className="mt-1.5 text-sm font-bold"
        style={{
          color:
            accent ||
            '#ffffff',
        }}
      >
        {value}
      </div>

    </div>
  )
}