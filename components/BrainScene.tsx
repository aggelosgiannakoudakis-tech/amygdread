'use client'
import { Suspense, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import BrainModel from './BrainModel'
import CameraRig from './CameraRig'
import Lights from './Lights'
import Dust from './Dust'
import Wordmark3D from './Wordmark3D'
import LabelDriver from './LabelDriver'
import RoomWorlds from './RoomWorlds'
import SpecimenRoom from './SpecimenRoom'
import { LOAD } from '../lib/progress'

const Fx = dynamic(() => import('./Fx'), { ssr: false })

// Forces WebGL to compile every material's shader program ahead of time, while still hidden behind the loading screen,
// instead of paying that cost the instant each object first becomes visible mid-scroll.
function Warmup() {
  const { gl, scene, camera } = useThree()
  const stage = useRef(0) // 0 = waiting for brain, 1 = armed, 2 = first compile done, 3 = second compile done
  const armedFor = useRef(0)
  useFrame(() => {
    if (stage.current === 0) { if (LOAD.model) stage.current = 1; return }
    armedFor.current++
    if (stage.current === 1 && armedFor.current === 2) { stage.current = 2; try { gl.compile(scene, camera) } catch {} }
    else if (stage.current === 2 && armedFor.current === 20) { stage.current = 3; try { gl.compile(scene, camera) } catch {} }
  })
  return null
}
export default function BrainScene({ onReady }: { onReady: () => void }) {
  const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
  return (
    <Canvas eventSource={document.body} eventPrefix="client" dpr={coarse ? [1, 1.3] : [1, 1.75]} camera={{ fov: 38, near: 0.08, far: 60, position: [0, 0.1, 6.0] }}
      gl={{ antialias: !coarse, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        LOAD.canvas = true
        gl.setClearColor('#000000')
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
        gl.localClippingEnabled = true
        // Skips Three.js's per-shader-compile error-log fetch (gl.getProgramInfoLog / gl.getShaderInfoLog),
        // which forces a synchronous GPU pipeline stall on every compiled program purely to check for
        // compile errors. Measured via Chrome Performance profiling as the single largest cost during
        // initial load (~3s self time on getProgramInfoLog alone). Does not change rendering in any way —
        // only skips a diagnostic check that's meant for catching shader bugs during development.
        gl.debug.checkShaderErrors = false
        scene.fog = new THREE.FogExp2('#000000', 0.035)
      }}>
      <Suspense fallback={null}><BrainModel onReady={onReady} /></Suspense>
      <Suspense fallback={null}><Wordmark3D /></Suspense>
      <CameraRig /><Lights /><Dust count={coarse ? 130 : 460} /><LabelDriver /><SpecimenRoom /><Suspense fallback={null}><RoomWorlds /></Suspense>
      <Warmup />
      {!coarse && <Fx />}
    </Canvas>
  )
}