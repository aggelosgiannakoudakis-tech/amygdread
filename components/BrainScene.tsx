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

// Three.js's compile()/compileAsync() walk the scene with traverseVisible(), so any object
// that is currently visible=false (the rooms, specimen room, anything not scrolled to yet)
// is skipped entirely and never gets its shaders compiled. Those shaders then compile for
// the first time at the exact moment the object becomes visible mid-scroll, which profiling
// measured as a ~3.3s main-thread stall (getProgramParameter / link-status wait).
//
// This walks the scene one top-level child at a time, briefly marks that subtree visible,
// compiles it, then restores every visibility flag — all inside one synchronous block, so
// no frame can ever be painted while something is temporarily visible. Spreading it one
// child per 12 frames keeps each compile small instead of one long freeze.
function SceneWarmup({ armed }: { armed: { current: boolean } }) {
  const { gl, scene, camera } = useThree()
  const queue = useRef<THREE.Object3D[] | null>(null)
  const i = useRef(0)
  const wait = useRef(0)

  useFrame(() => {
    if (!armed.current) return
    if (queue.current === null) queue.current = [...scene.children]
    if (i.current >= queue.current.length) return
    if (wait.current++ % 12 !== 0) return

    const target = queue.current[i.current++]
    if (!target) return

    const hidden: THREE.Object3D[] = []
    target.traverse((o) => { if (o.visible === false) { hidden.push(o); o.visible = true } })
    const selfHidden = target.visible === false
    if (selfHidden) target.visible = true

    try { gl.compileAsync(scene, camera, target).catch(() => {}) } catch {}

    // Restored synchronously, before the renderer ever gets a chance to draw a frame.
    if (selfHidden) target.visible = false
    for (const o of hidden) o.visible = false
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