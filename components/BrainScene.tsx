'use client'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { Canvas } from '@react-three/fiber'
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
      {!coarse && <Fx />}
    </Canvas>
  )
}