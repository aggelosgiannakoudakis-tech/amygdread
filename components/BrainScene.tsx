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

// Best-effort second pass: once the brain has already warmed itself up and called
// onReady, this quietly pre-compiles everything else in the scene (rooms, dust,
// wordmark, postprocessing) a few frames later — while you're still at the top of
// the site — instead of each one compiling for the first time exactly when it
// scrolls into view later. No visual effect: compileAsync only prepares GPU
// programs, it doesn't render or change anything.
function SceneWarmup({ armed }: { armed: { current: boolean } }) {
  const { gl, scene, camera } = useThree()
  const done = useRef(false)
  const frames = useRef(0)
  useFrame(() => {
    if (done.current || !armed.current) return
    frames.current++
    if (frames.current === 10) { done.current = true; gl.compileAsync(scene, camera).catch(() => {}) }
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