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

// Three.js's gl.compile() uses traverseVisible(), meaning it completely ignores
// anything with visible={false}. Since rooms start hidden at the top of the page,
// warmup skipped them, leaving their shaders to compile live mid-scroll during the
// threat response.
// This forces EVERY object in the scene visible for one frame, compiles all shaders
// across the entire project, and restores visibility before rendering anything.
function BulletproofWarmup() {
  const { gl, scene, camera } = useThree()
  const done = useRef(false)

  useFrame(() => {
    if (done.current) return
    done.current = true

    const visMap = new Map<THREE.Object3D, boolean>()
    scene.traverse((o) => {
      visMap.set(o, o.visible)
      o.visible = true // Force visible so gl.compile visits rooms, tombstones, canteens, etc.
    })

    try {
      gl.compile(scene, camera)
    } catch {}

    scene.traverse((o) => {
      if (visMap.has(o)) o.visible = visMap.get(o)!
    })
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
        gl.debug.checkShaderErrors = false
        scene.fog = new THREE.FogExp2('#000000', 0.035)
      }}>
      <Suspense fallback={null}><BrainModel onReady={onReady} /></Suspense>
      <Suspense fallback={null}><Wordmark3D /></Suspense>
      <CameraRig /><Lights /><Dust count={coarse ? 130 : 460} /><LabelDriver /><SpecimenRoom /><Suspense fallback={null}><RoomWorlds /></Suspense>
      <BulletproofWarmup />
      {!coarse && <Fx />}
    </Canvas>
  )
}