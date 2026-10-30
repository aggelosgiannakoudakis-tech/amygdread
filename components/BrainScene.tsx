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

function ProgramMonitor() {
  const { gl } = useThree()
  const prev = useRef(0)
  useFrame(() => {
    const info: any = gl.info
    const progs = info?.programs
    if (progs && progs.length !== prev.current) {
      if (progs.length > prev.current) {
        for (let i = prev.current; i < progs.length; i++) {
          console.log('[NEW PROGRAM]', performance.now().toFixed(0) + 'ms', progs[i]?.cacheKey ?? progs[i])
        }
      }
      prev.current = progs.length
    }
  })
  return null
}

function LightMonitor() {
  const { scene } = useThree()
  const prev = useRef(-1)
  useFrame(() => {
    let n = 0
    const walk = (o: THREE.Object3D, parentVisible: boolean) => {
      const vis = parentVisible && o.visible
      if (vis && (o as any).isLight) n++
      for (const c of o.children) walk(c, vis)
    }
    walk(scene, true)
    if (n !== prev.current) {
      console.log('[LIGHT COUNT]', performance.now().toFixed(0) + 'ms', prev.current, '->', n)
      prev.current = n
    }
  })
  return null
}

function EnvMonitor() {
  const { scene, gl } = useThree()
  const prev = useRef<string | null>(null)
  useFrame(() => {
    const snap = {
      env: (scene.environment as any)?.uuid ?? null,
      envIntensity: (scene as any).environmentIntensity ?? null,
      fog: scene.fog ? (scene.fog as any).density ?? 'fog-present' : null,
      shadows: gl.shadowMap.enabled,
      background: (scene.background as any)?.uuid ?? (scene.background ?? null),
    }
    const key = JSON.stringify(snap)
    if (key !== prev.current) {
      console.log('[ENV STATE]', performance.now().toFixed(0) + 'ms', snap)
      prev.current = key
    }
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
      <ProgramMonitor />
      <LightMonitor />
      <EnvMonitor />
      {!coarse && <Fx />}
    </Canvas>
  )
}