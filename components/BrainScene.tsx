'use client'
import { Suspense, useRef, useCallback } from 'react'
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

// Measured via Chrome Performance profiling: the mid-experience freezes were ~400ms
// gl.getProgramParameter() calls firing inside renderBufferDirect — i.e. during normal
// rendering. Cause: on Windows/ANGLE, gl.linkProgram() is lazy — the driver defers the
// real link work until the FIRST query or draw on that program. Three.js's compile()
// submits links but never queries them, so any program that isn't actually drawn during
// loading (frustum-culled meshes, objects outside the camera) keeps a PENDING link on
// the driver. The first time the camera later reveals that mesh mid-scroll, Three.js's
// first uniforms query on it blocks until the driver finishes the whole link — one long
// visible freeze. Fix: after compiling, explicitly query LINK_STATUS on every program
// (renderer.info.programs) every frame during the loading screen, forcing all pending
// links to complete while nothing is visible. Later first-use is then cheap.
type GLProgramHandle = { program: WebGLProgram }
function SceneWarmup({ armed }: { armed: { current: boolean } }) {
  const { gl, scene, camera } = useThree()
  const settled = useRef<WeakSet<object>>(new WeakSet())
  const frames = useRef(0)
  const lastCount = useRef(0)
  useFrame(() => {
    if (!armed.current) return
    frames.current++
    // Keep discovering + settling new programs every frame for the first ~4s after the
    // brain is ready (still behind the loading screen), then a light periodic sweep for
    // anything that appears later.
    const active = frames.current <= 240 || frames.current % 30 === 0
    if (!active) return
    try { gl.compile(scene, camera) } catch {}
    const ctx = gl.getContext()
    const list = (gl.info as unknown as { programs: (GLProgramHandle & { cacheKey?: string })[] | null }).programs
    if (!ctx || !list) return
    if (list.length !== lastCount.current) {
      if (list.length > lastCount.current && typeof console !== 'undefined') {
        const fresh = list.slice(lastCount.current).map((p) => p.cacheKey ?? '?').join(' | ')
        console.info(`[warmup] programs ${lastCount.current} -> ${list.length}: ${fresh}`)
      }
      lastCount.current = list.length
    }
    for (const p of list) {
      if (!p || settled.current.has(p)) continue
      settled.current.add(p)
      try { ctx.getProgramParameter(p.program, ctx.LINK_STATUS) } catch {}
    }
  })
  return null
}

export default function BrainScene({ onReady }: { onReady: () => void }) {
  const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
  const brainReady = useRef(false)
  const handleBrainReady = useCallback(() => { brainReady.current = true; onReady() }, [onReady])
  return (
    <Canvas eventSource={document.body} eventPrefix="client" dpr={coarse ? [1, 1.3] : [1, 1.75]} camera={{ fov: 38, near: 0.08, far: 60, position: [0, 0.1, 6.0] }}
      gl={{ antialias: !coarse, powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        LOAD.canvas = true
        gl.setClearColor('#000000')
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
        gl.localClippingEnabled = true
        gl.debug.checkShaderErrors = false
        scene.fog = new THREE.FogExp2('#000000', 0.035)
      }}>
      <Suspense fallback={null}><BrainModel onReady={handleBrainReady} /></Suspense>
      <Suspense fallback={null}><Wordmark3D /></Suspense>
      <CameraRig /><Lights /><Dust count={coarse ? 130 : 460} /><LabelDriver /><SpecimenRoom /><Suspense fallback={null}><RoomWorlds /></Suspense>
      <SceneWarmup armed={brainReady} />
      {!coarse && <Fx />}
    </Canvas>
  )
}