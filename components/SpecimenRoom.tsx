'use client'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { P, introT, SPEC } from '../lib/progress'
import Specimens from './Specimens'
import { warnW, warnArm, warnB } from '../lib/warn'
import { bake, fbm } from '../lib/procTex'

const soft = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c) }
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const V = (a: number[][]) => new THREE.CatmullRomCurve3(a.map((q) => new THREE.Vector3(q[0], q[1], q[2])))
const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches

export default function SpecimenRoom() {
  const seen = useRef(0), g = useRef<THREE.Group>(null), mats = useRef<THREE.Material[]>([]), lights = useRef<{ l: THREE.Light; i: number }[]>([]), reds = useRef<THREE.Mesh[]>([])
  const { size } = useThree()
  const portrait = size.width / size.height < 1
  const colX = portrait ? 3.2 : 6

  const o = useMemo(() => {
    const t = bake(512, 512, (u, v) => { const a = fbm(u * 6, v * 6, 1), b = fbm(u * 40, v * 40, 2, 3), seam = Math.min(Math.abs(Math.sin(u * Math.PI * 4)), Math.abs(Math.sin(v * Math.PI * 4))) < 0.02 ? 1 : 0, st = sm(0.5, 0.8, fbm(u * 3, v * 12, 4)), k = (0.12 + 0.07 * a + 0.03 * b) * (1 - 0.5 * seam) * (1 - 0.25 * st); return [k, k, k * 1.04, 0.85 - 0.15 * st, 0, 0.5 + b * 0.3 - seam * 0.3] })
    const mk = (rx: number, ry: number, rough = 1) => {
      const rep = (tx: THREE.Texture) => { const c = tx.clone(); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.needsUpdate = true; return c }
      return new THREE.MeshStandardMaterial({
        map: rep(t.map), roughnessMap: rep(t.orm), bumpMap: rep(t.bump), bumpScale: 2, roughness: rough,
        // Phone-only self-glow so the chamber reads without extra point lights (keeps perf) or a scene-wide ambient light (which washed out the brain). Desktop: emissiveIntensity 0, fully unchanged.
        emissive: coarse ? new THREE.Color('#2b2420') : new THREE.Color('#000000'),
        emissiveIntensity: coarse ? 0.55 : 0,
      })
    }
    const cab = [[-0.5, 0.3], [0.6, -0.2], [-1.1, -0.6], [1.2, 0.5], [0.1, 0.9], [-0.3, -1]].map(([x, z], i) => V([[x * 2.2, 7, z * 2 + 0.5], [x * 1.2 + 0.4, 5.2 - i * 0.2, z + 0.4], [x * 0.5 + 0.2, 3.4, z * 0.5], [x * 0.3, 2 + (i % 3) * 0.1, z * 0.3]]))
    return { floor: mk(12, 12, 0.6), wall: mk(8, 3), col: mk(1, 4), cable: new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.45 }), tex: soft(), cab }
  }, [])
  useFrame(({ clock }) => {
    const gr = g.current; if (!gr) return
    const w = warnW(), arm = warnArm(w), B = warnB(w)
    const introVal = coarse ? 3.5 : introT()
    const base = sm(1, 3.5, introVal) * (1 - sm(0.55, 0.8, P.value)), vis = Math.max(base, 0.22 * arm); gr.visible = vis > 0.003; if (!gr.visible) return
    const sv = SPEC.v !== seen.current; if (sv) seen.current = SPEC.v
    if (!mats.current.length || sv) gr.traverse((m: any) => { if (m.isMesh) { const ms = Array.isArray(m.material) ? m.material : [m.material]; ms.forEach((q: THREE.Material) => { if (!mats.current.includes(q)) { q.userData.b = q.opacity; q.transparent = true; q.needsUpdate = true; mats.current.push(q) } }) } else if (m.isLight && !lights.current.some((x) => x.l === m)) lights.current.push({ l: m, i: m.intensity }) })
    const specRev = sm(4, 8, introT()); mats.current.forEach((q) => { q.opacity = q.userData.b * vis * (q.userData.spec ? specRev : 1) }); lights.current.forEach((x) => { const c = (x.l as THREE.PointLight).color, red = !!c && c.r > 0.9 && c.g < 0.3; x.l.intensity = red ? x.i * (base * (0.8 + (P.reduced ? 0 : 0.2 * Math.sin(clock.elapsedTime * 1.1))) + arm * B * 5) : x.i * vis * (x.l.type === 'PointLight' && !P.reduced ? 0.8 + 0.2 * Math.sin(clock.elapsedTime * 1.1) : 1) })
    reds.current.forEach((m, i) => { (m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, base * (0.55 + 0.35 * Math.sin(clock.elapsedTime * 1.1 + i)) + arm * B) })
  })
  return (
    <group ref={g} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.4, -6]} material={o.floor}><planeGeometry args={[60, 60]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 7.2, -6]} material={o.wall}><planeGeometry args={[60, 60]} /></mesh>
      <mesh position={[0, 1.8, -17]} material={o.wall}><planeGeometry args={[44, 15]} /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 12, 1.8, -6]} rotation={[0, -s * Math.PI / 2, 0]} material={o.wall}><planeGeometry args={[44, 15]} /></mesh>)}
      {[3, -1, -5, -9, -13].map((z) => (<group key={z}>
        {[-colX, colX].map((x) => <mesh key={x} position={[x, 1.9, z]} material={o.col}><boxGeometry args={[1.3, 11, 1.3]} /></mesh>)}
        <mesh position={[0, 6.9, z]} material={o.col}><boxGeometry args={[24, 0.6, 0.9]} /></mesh>
      </group>))}
      {[[-9, 3.5, -12], [8.5, 3, -14]].map(([x, y, z], i) => (<group key={i}><mesh position={[x, y, z]}><boxGeometry args={[0.25, 0.1, 0.1]} /><meshBasicMaterial color="#9fb8c8" transparent opacity={0.5} /></mesh>{!coarse && <pointLight position={[x * 0.95, y, z + 0.5]} color="#8fa8b8" intensity={2} distance={9} decay={2} />}</group>))}
      {[[-5.4, 5, -12.4], [5.4, 5, -12.4], [-5.4, 2, -4.4], [5.4, 2, -4.4], [0, -3.1, -16.7], [-11.4, 2.5, -9], [11.4, 2.5, -9]].map(([x, y, z], i) => <mesh key={`e${i}`} ref={(m) => { if (m) reds.current[2 + i] = m }} position={[x, y, z]}><planeGeometry args={[0.6, 0.6]} /><meshBasicMaterial map={o.tex} color="#ff2030" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}
      <pointLight position={[-5, 4.5, -12]} color="#ff2030" intensity={1.2} distance={9} decay={2} /><pointLight position={[5, 1.8, -4.8]} color="#ff2030" intensity={1.2} distance={7} decay={2} />
      <Specimens />
      {o.cab.map((c, i) => <mesh key={i} material={o.cable}><tubeGeometry args={[c, 28, 0.045, 6, false]} /></mesh>)}
      {[-colX, colX].map((x, i) => (<group key={x}>
        <mesh ref={(m) => { if (m) reds.current[i] = m }} position={[x * 0.9, 3, -8.6]}><planeGeometry args={[0.7, 0.7]} /><meshBasicMaterial map={o.tex} color="#ff2030" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
        {!coarse && <pointLight position={[x * 0.85, 3, -8]} color="#ff2030" intensity={2.5} distance={8} decay={2} />}
      </group>))}
      {[-5, -9, -13].map((z, i) => <mesh key={z} position={[0, 2, z]}><planeGeometry args={[32, 14]} /><meshBasicMaterial map={o.tex} color="#2a3038" opacity={0.07} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}
    </group>
  )
}