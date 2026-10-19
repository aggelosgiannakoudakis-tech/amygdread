'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'
import { bake, fbm, rnd } from '../lib/procTex'
import { sstep as sm } from '../lib/math'
import { E } from '../lib/enter'

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
// CANTEEN 66 — an abandoned wheeled field kitchen: chassis, axle, two spoked wheels, firebox casing with door + hatch, kettle with domed lid and handles, chimney, drawbar with ring and prop. Rust/peeling-paint maps are baked procedurally; "66" is a worn stencil decal on the casing.
export default function Canteen() {
  const o = useMemo(() => {
    const { map, orm, bump } = bake(512, 512, (u, v) => {
      const a = fbm(u * 7, v * 7, 1), b = fbm(u * 24, v * 24, 2), c = fbm(u * 3, v * 3, 3)
      const paint = sm(0.42, 0.6, c - 0.2 * a + 0.15), rust = sm(0.35, 0.7, a * 0.7 + b * 0.45), g = 0.55 + 0.45 * fbm(u * 50, v * 50, 5)
      return [mix(mix(0.22, mix(0.36, 0.5, b), rust), 0.2 * (0.7 + 0.5 * b), paint) * g, mix(mix(0.21, mix(0.17, 0.26, b), rust), 0.22 * (0.7 + 0.5 * b), paint) * g, mix(mix(0.2, mix(0.07, 0.1, b), rust), 0.14, paint) * g, paint ? 0.7 : mix(0.35, 0.9, rust), paint ? 0.1 : mix(0.9, 0.25, rust), 0.5 + (b - 0.5) * 0.5 + rust * 0.15]
    }, (ctx, which) => { for (let i = 0; i < 90; i++) { ctx.strokeStyle = which === 'map' ? 'rgba(170,165,150,.25)' : 'rgba(0,0,0,.3)'; ctx.lineWidth = 0.6 + rnd(i, 4); ctx.beginPath(); const x = rnd(i, 1) * 512, y = rnd(i, 2) * 512, l = 20 + rnd(i, 3) * 80, an = rnd(i, 5) * 3.14; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); ctx.stroke() } })
    const rust = new THREE.MeshStandardMaterial({ map, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, bumpMap: bump, bumpScale: 3 })
    const dc = document.createElement('canvas'); dc.width = 512; dc.height = 256; const d = dc.getContext('2d')!
    d.fillStyle = 'rgba(205,196,165,.85)'; d.font = '190px Impact, "Arial Narrow", sans-serif'; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText('66', 256, 118)
    d.font = '34px Impact, sans-serif'; d.fillText('CANTEEN', 256, 222)
    d.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 1400; i++) { d.globalAlpha = 0.3 + rnd(i, 6) * 0.6; d.fillRect(rnd(i, 7) * 512, rnd(i, 8) * 256, 2 + rnd(i, 9) * 8, 2 + rnd(i, 10) * 5) }
    const dt = new THREE.CanvasTexture(dc); dt.colorSpace = THREE.SRGBColorSpace
    return { rust, dark: new THREE.MeshStandardMaterial({ color: '#171615', metalness: 0.8, roughness: 0.6 }), tire: new THREE.MeshStandardMaterial({ color: '#0f0e0d', roughness: 0.95 }), decal: new THREE.MeshStandardMaterial({ map: dt, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), ground: new THREE.MeshStandardMaterial({ color: '#0b0908', roughness: 1 }) }
  }, [])
  const wheel = (x: number) => (
    <group key={x} position={[x, -0.45, 0.1]} rotation={[0, Math.PI / 2, 0]}>
      <mesh material={o.tire}><torusGeometry args={[0.5, 0.075, 12, 40]} /></mesh>
      <mesh material={o.rust}><torusGeometry args={[0.43, 0.025, 8, 40]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={o.rust}><cylinderGeometry args={[0.1, 0.1, 0.16, 16]} /></mesh>
      {Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return <mesh key={k} position={[Math.sin(a) * 0.27, Math.cos(a) * 0.27, 0]} rotation={[0, 0, -a]} material={o.rust}><boxGeometry args={[0.035, 0.34, 0.045]} /></mesh> })}
    </group>
  )
  return (
    <group scale={0.75} position={[0, coarse ? 0.05 : 0.3, 0]}>
      <group rotation={[0, -1.0, 0]} position={[0, 0, -0.9]}>
        <mesh position={[0, -0.22, 0]} material={o.dark}><boxGeometry args={[1.7, 0.1, 2.2]} /></mesh>
        <RoundedBox args={[1.5, 0.8, 2]} radius={0.06} smoothness={3} position={[0, 0.2, 0]} material={o.rust} />
        <object3D ref={(a) => { E.anchors[0] = a }} position={[0.76, 0.2, 0.1]} rotation={[0, Math.PI / 2, 0]} />
        <mesh position={[0.755, 0.2, 0.1]} rotation={[0, Math.PI / 2, 0]} material={o.decal}><planeGeometry args={[1.1, 0.55]} /></mesh>
        <RoundedBox args={[0.06, 0.45, 0.5]} radius={0.02} position={[0.78, 0.1, -0.62]} material={o.rust} />
        <mesh position={[0.83, 0.1, -0.5]} rotation={[0, 0, Math.PI / 2]} material={o.dark}><cylinderGeometry args={[0.025, 0.025, 0.14, 8]} /></mesh>
        <RoundedBox args={[0.05, 0.3, 0.4]} radius={0.02} position={[0.78, 0.38, 0.72]} material={o.rust} />
        <mesh position={[0, 0.85, 0.1]} material={o.rust}><cylinderGeometry args={[0.6, 0.6, 0.5, 40]} /></mesh>
        <mesh position={[0, 1.1, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={o.rust}><torusGeometry args={[0.6, 0.04, 8, 40]} /></mesh>
        <mesh position={[0, 1.1, 0.1]} scale={[1, 0.5, 1]} material={o.rust}><sphereGeometry args={[0.62, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        <mesh position={[0, 1.43, 0.1]} material={o.dark}><sphereGeometry args={[0.07, 12, 12]} /></mesh>
        {[-1, 1].map((s) => <mesh key={s} position={[s * 0.64, 0.95, 0.1]} rotation={[0, Math.PI / 2, 0]} material={o.dark}><torusGeometry args={[0.14, 0.03, 8, 16]} /></mesh>)}
        <mesh position={[0, 1.25, -0.85]} material={o.rust}><cylinderGeometry args={[0.1, 0.11, 1.3, 16]} /></mesh>
        <mesh position={[0, 1.95, -0.85]} material={o.rust}><coneGeometry args={[0.17, 0.15, 16]} /></mesh>
        <mesh position={[0, -0.45, 0.1]} rotation={[0, 0, Math.PI / 2]} material={o.dark}><cylinderGeometry args={[0.06, 0.06, 2.4, 12]} /></mesh>
        {wheel(-1.12)}{wheel(1.12)}
        <mesh position={[0, -0.2, 2.0]} material={o.rust}><boxGeometry args={[0.12, 0.1, 2]} /></mesh>
        <mesh position={[0, -0.2, 3.08]} rotation={[Math.PI / 2, 0, 0]} material={o.dark}><torusGeometry args={[0.14, 0.03, 8, 20]} /></mesh>
        <mesh position={[0, -0.62, 2.8]} material={o.dark}><cylinderGeometry args={[0.04, 0.04, 0.8, 8]} /></mesh>
      </group>
      <mesh position={[-3.2, 0.6, -2.6]} material={o.dark}><cylinderGeometry args={[0.1, 0.1, 9, 16]} /></mesh>
      <mesh position={[0, 3, -2.8]} rotation={[0, 0, Math.PI / 2]} material={o.dark}><cylinderGeometry args={[0.07, 0.07, 7, 16]} /></mesh>
    </group>
  )
}