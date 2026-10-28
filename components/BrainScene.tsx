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
// IMPORTANT: this only fires once LOAD.model is true — i.e. once BrainModel's time-sliced ~436-piece builder has
// actually finished and the brain's real materials are attached to the scene (see BrainModel.tsx). Firing on a
// fixed frame count (the previous approach) risked compiling before the brain even existed in the scene graph,
// silently skipping it and paying the cost live instead — this is believed to be the cause of the visible
// colour-pop on load (desktop only, where the extra organic()-shader materials + Fx post-processing add real
// compile weight that phone doesn't have).
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
      onCreated={({ gl, scene }) => { LOAD.canvas = true; gl.setClearColor('#000000'); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; gl.localClippingEnabled = true; scene.fog = new THREE.FogExp2('#000000', 0.035) }}>
      <Suspense fallback={null}><BrainModel onReady={onReady} /></Suspense>
      <Suspense fallback={null}><Wordmark3D /></Suspense>
      <CameraRig /><Lights /><Dust count={coarse ? 130 : 460} /><LabelDriver /><SpecimenRoom /><Suspense fallback={null}><RoomWorlds /></Suspense>
      <Warmup />
      {!coarse && <Fx />}
    </Canvas>
  )
}