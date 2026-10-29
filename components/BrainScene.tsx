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

// Same idea as before, but instead of snapshotting scene.children ONCE (which misses
// anything added later — e.g. RoomWorlds is behind <Suspense>, so its meshes don't exist
// in the scene graph yet at the moment the brain finishes loading), this keeps rescanning
// the top-level children every 12 frames forever, tracking what's already been warmed in
// a WeakSet. Any newly-mounted top-level object (like RoomWorlds resolving its own async
// load later) gets picked up and warmed the moment it appears, instead of compiling live
// mid-scroll. Once everything is warmed, the rescan finds nothing new each cycle — a
// single cheap array iteration, no visual effect, negligible cost.
function SceneWarmup({ armed }: { armed: { current: boolean } }) {
  const { gl, scene, camera } = useThree()
  const warmed = useRef<WeakSet<THREE.Object3D>>(new WeakSet())
  const pending = useRef<THREE.Object3D[]>([])
  const wait = useRef(0)

  useFrame(() => {
    if (!armed.current) return
    if (wait.current++ % 12 !== 0) return

    if (pending.current.length === 0) {
      for (const child of scene.children) {
        if (!warmed.current.has(child)) pending.current.push(child)
      }
      if (pending.current.length === 0) return
    }

    const target = pending.current.shift()
    if (!target) return
    warmed.current.add(target)

    const hidden: THREE.Object3D[] = []
    target.traverse((o) => { if (o.visible === false) { hidden.push(o); o.visible = true } })
    const selfHidden = target.visible === false
    if (selfHidden) target.visible = true

    try { gl.compileAsync(scene, camera).catch(() => {}) } catch {}

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