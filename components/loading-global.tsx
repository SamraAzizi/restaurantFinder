"use client"

import type React from "react"
import { useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import type * as THREE from "three"
import { Search, Home } from "lucide-react"

function ChunkyGlobe() {
  const globeRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.008
    }
  })

  return (
    <group ref={globeRef}>
      <mesh>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.02, 12, 8]} />
        <meshBasicMaterial color="#000000" wireframe wireframeLinewidth={2} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.03, 8, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[1, 0.03, 8, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>
    </group>
  )
}

function SearchMarker({ yRef }: { yRef: React.MutableRefObject<number> }) {
  const markerRef = useRef<THREE.Group>(null)
  const verticalAngleRef = useRef(0)

  useFrame(() => {
    if (markerRef.current) {
      verticalAngleRef.current += 0.012
      const y = Math.sin(verticalAngleRef.current) * 0.6
      markerRef.current.position.set(0, y, 1.25)
      yRef.current = y
    }
  })

  return (
    <group ref={markerRef}>
      <Html center>
        <div className="flex items-center">
          <Search className="h-6 w-6 text-foreground" strokeWidth={3} />
        </div>
      </Html>
    </group>
  )
}

function HousePopup({ y, onComplete }: { y: number; onComplete: () => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const [opacity, setOpacity] = useState(0)
  const [scale, setScale] = useState(0.5)
  const opacityRef = useRef(0)
  const scaleRef = useRef(0.5)
  const fadePhase = useRef<"in" | "hold" | "out">("in")
  const timer = useRef(0)

  useFrame((_, delta) => {
    timer.current += delta

    if (fadePhase.current === "in") {
      opacityRef.current = Math.min(opacityRef.current + delta * 3, 1)
      scaleRef.current = Math.min(scaleRef.current + delta * 2.1, 1.2)
      setOpacity(opacityRef.current)
      setScale(scaleRef.current)
      if (opacityRef.current >= 1) {
        fadePhase.current = "hold"
        timer.current = 0
      }
    } else if (fadePhase.current === "hold") {
      if (scaleRef.current > 1) {
        scaleRef.current = Math.max(scaleRef.current - delta * 2, 1)
        setScale(scaleRef.current)
      }
      if (timer.current > 0.6) {
        fadePhase.current = "out"
        timer.current = 0
      }
    } else if (fadePhase.current === "out") {
      opacityRef.current = Math.max(opacityRef.current - delta * 2, 0)
      scaleRef.current = Math.max(scaleRef.current - delta * 1.5, 0.5)
      setOpacity(opacityRef.current)
      setScale(scaleRef.current)
      if (opacityRef.current <= 0) {
        onComplete()
      }
    }
  })

  return (
    <group ref={groupRef} position={[0, y, 1.25]}>
      <Html center>
        <div
          style={{
            opacity,
            transform: `scale(${scale})`,
            transition: "transform 0.05s ease-out",
          }}
          className="flex items-center justify-center"
        >
          <Home className="h-5 w-5 text-foreground" strokeWidth={3} />
        </div>
      </Html>
    </group>
  )
}

function HouseSpawner({ yRef }: { yRef: React.MutableRefObject<number> }) {
  const [houses, setHouses] = useState<{ id: number; y: number }[]>([])
  const nextId = useRef(0)
  const nextSpawnTime = useRef(1 + Math.random() * 2)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current >= nextSpawnTime.current) {
      const newHouse = { id: nextId.current++, y: yRef.current }
      setHouses((prev) => [...prev, newHouse])
      elapsed.current = 0
      nextSpawnTime.current = 1 + Math.random() * 2
    }
  })

  const removeHouse = (id: number) => {
    setHouses((prev) => prev.filter((house) => house.id !== id))
  }

  return (
    <>
      {houses.map((house) => (
        <HousePopup key={house.id} y={house.y} onComplete={() => removeHouse(house.id)} />
      ))}
    </>
  )
}

function Scene() {
  const currentYRef = useRef(0)

  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <ChunkyGlobe />
      <SearchMarker yRef={currentYRef} />
      <HouseSpawner yRef={currentYRef} />
    </>
  )
}

interface LoadingGlobalProps {
  message?: string
}

export function LoadingGlobal({ message = "Searching Restaurants..." }: LoadingGlobalProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      <div className="h-44 w-44">
        <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }} style={{ background: "transparent" }}>
          <Scene />
        </Canvas>
      </div>
      <p className="font-sans text-base font-black uppercase tracking-wide text-foreground">{message}</p>
    </div>
  )
}