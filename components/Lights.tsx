'use client'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { P, introT } from '../lib/progress'
import { sstep, bell } from '../lib/math'

const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches

// Black void, film lighting: soft key, cool fill, hard cool rim, a very low red practical deep behind the brain.
export default function Lights() {
  const key = useRef<THREE.DirectionalLight>(null), rimA = useRef<THREE.PointLight>(null), rimB = useRef<THREE.PointLight>(null), prac = useRef<THREE.PointLight>(null), inner = useRef<THREE.PointLight>(null)
  useFrame(({ camera, clock, scene, gl }) => {
    const p = P.value, t = clock.elapsedTime, inside = bell(0.66, 0.8, 0.93, p), red = P.reduced
    const em = P.reduced ? 1 : sstep(1.6, 5.5, introT()), dark = 1 - 0.28 * bell(0.3, 0.45, 0.62, p)
    const flick = red ? 0 : bell(0.3, 0.42, 0.62, p) * Math.sin(t * 47) * Math.sin(t * 13.3)
    const breathe = red ? 0 : Math.sin(t * 0.9) * 0.5
    if (key.current) key.current.intensity = em * dark * (1.05 * (1 - 0.8 * sstep(0.6, 0.8, p)) + 0.1) * (1 + 0.12 * flick)
    if (rimA.current) rimA.current.intensity = em * 26 * (1 + 0.4 * sstep(0.15, 0.5, p)) * (1 + 0.05 * breathe)
    if (rimB.current) rimB.current.intensity = em * 12 * (0.7 + 0.6 * sstep(0.3, 0.6, p))
    if (prac.current) prac.current.intensity = em * (3 + breathe * 0.8 + flick * 0.6) * (1 + 1.2 * bell(0.3, 0.5, 0.8, p) + sstep(0.4, 0.7, p))
    if (inner.current) { inner.current.position.copy(camera.position); inner.current.intensity = 1.6 * inside }
    scene.environmentIntensity = em * 0.3 * (1 - 0.75 * inside)
    gl.toneMappingExposure = 1.1 - 0.3 * inside
  })
  return (
    <>
      <hemisphereLight args={['#8fa0b8', '#0a0505', 0.2]} />
      <directionalLight ref={key} position={[2.5, 3.5, 5]} color="#f1e4dc" />
      <pointLight ref={rimA} position={[-4, 2.2, -3.5]} color="#d6e0f5" distance={16} decay={2} />
      {!coarse && <pointLight ref={rimB} position={[4, 0.5, -3.5]} color="#cfd6e6" distance={16} decay={2} />}
      <pointLight ref={prac} position={[0, 0.2, -1.4]} color="#7a1018" distance={6} decay={2} />
      {!coarse && <pointLight ref={inner} color="#8a3a30" distance={4} decay={2} intensity={0} />}
      <Environment resolution={coarse ? 16 : 64}>
        <Lightformer form="rect" intensity={1.2} position={[0, 4, 3]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1} position={[-5, 0, -2]} scale={[1, 6, 1]} color="#cfd8ff" />
      </Environment>
    </>
  )
}