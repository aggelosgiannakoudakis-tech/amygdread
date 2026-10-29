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

// Tracks compiled MATERIALS, not objects, and scans the FULL scene graph (not just the
// top level) every 12 frames. This catches meshes added deep inside an already-seen
// group later (e.g. a room's real content mounting after its wrapper group already
// existed), which the previous top-level-only version could silently miss. To compile
// a mesh, every ancestor up to the scene root must also be momentarily visible (Three.js
// skips invisible branches entirely) — so the whole ancestor chain is toggled, not just
// the mesh itself, then restored synchronously before any frame can render.
function SceneWarmup({ armed }: { armed: { current: boolean } }) {
  const { gl, scene, camera } = useThree()
  const warmedMats = useRef<WeakSet<THREE.Material>>(new WeakSet())
  const wait = useRef(0)

  useFrame(() => {
    if (!armed.current) return
    if (wait.current++ % 12 !== 0) return

    let found: THREE.Object3D | null = null
    scene.traverse((o) => {
      if (found) return
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      if (!mat) return
      const list = Array.isArray(mat) ? mat : [mat]
      if (list.some((m) => m && !warmedMats.current.has(m))) found = o
    })
    if (!found) return

    const mat = (found as THREE.Mesh).material as THREE.Material | THREE.Material[]
    const list = Array.isArray(mat) ? mat : [mat]
    list.forEach((m) => m && warmedMats.current.add(m))

    const touched: THREE.Object3D[] = []
    let n: THREE.Object3D | null = found
    while (n) { if (n.visible === false) { touched.push(n); n.visible = true } n = n.parent }

    try { gl.compileAsync(scene, camera).catch(() => {}) } catch {}

    for (const o of touched) o.visible = false
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