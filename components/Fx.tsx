'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, DepthOfField, ChromaticAberration, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { P, FOCUS } from '../lib/progress'
import { bell } from '../lib/math'

const OFF = new THREE.Vector2(0, 0)
export default function Fx() {
  const ca = useRef<any>(null)
  useFrame(() => { const a = P.reduced ? 0 : 0.0007 * bell(0.38, 0.45, 0.56, P.value); ca.current?.offset?.set(a, a) })
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField target={FOCUS} focalLength={0.05} bokehScale={2} height={720} />
      <ChromaticAberration ref={ca} offset={OFF} radialModulation={false} modulationOffset={0} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}