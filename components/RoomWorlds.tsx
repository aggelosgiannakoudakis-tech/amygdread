'use client'
import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { P, H } from '../lib/progress'
import { sstep } from '../lib/math'
import { rooms } from '../lib/content'
import { E, enterRoom } from '../lib/enter'
import { SPLIT_FRACTION } from '../lib/roomSplit'
import Canteen from './Canteen'
import Tombstone from './Tombstone'
import { CanteenEnv, TombEnv } from './RoomEnv'

const CFG = [
  { beacon: '#c4642a', glow: '#6a2410', lights: [{ c: '#ff8a4a', p: [1.6, 1.2, 2.2], i: 70 }, { c: '#ff3a2a', p: [-1, 0.5, -2.2], i: 40 }, { c: '#7a6a58', p: [-2.5, 1, 2], i: 8 }, { c: '#ffb070', p: [0, 3.1, -0.4], i: 22 }, { c: '#ff7a3a', p: [0, -1.6, 0.3], i: 14 }, { c: '#ff8a4a', p: [0, -0.2, 3.5], i: 12 }] },
  { beacon: '#2a3a7a', glow: '#0a1430', lights: [{ c: '#2a3aff', p: [-2.2, 1.6, 1.8], i: 70 }, { c: '#1a1aff', p: [1, 0.4, -2.2], i: 40 }, { c: '#2a4a8a', p: [0, -0.8, 2], i: 8 }, { c: '#1a2a6a', p: [0, -1.4, 2.4], i: 22 }, { c: '#2a3a8a', p: [0, -0.4, 3.5], i: 14 }] },
]
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c)
}
function ModelSlot({ url }: { url: string }) {
  const { scene } = useGLTF(url), box = new THREE.Box3().setFromObject(scene), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = 3 / Math.max(sz.x, sz.y, sz.z)
  return <group scale={k} position={[-c.x * k, -c.y * k, -c.z * k]}><primitive object={scene} /></group>
}
const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
// phone-only vertical anchors: rooms stacked with a wide gap so they're visually distinct. Even with the
// real clip boundary below, more separation gives each room more breathing room before anything gets clipped.
const PORTRAIT_PY: [number, number] = [3.6, -2.0]

// Two world-space clip planes, recomputed every single frame from the REAL, live camera (position,
// orientation, FOV) by PhoneRoomClip below — not a fixed guessed Y value. This represents "exactly this
// row of pixels on screen" as a 3D plane, so it stays correct regardless of camera angle or perspective
// (a static world-space Y plane failed because the floor's Y position never actually crossed it — the
// visual "bleed" was a perspective effect, not a position problem). ROOM_CLIP[0] keeps only the screen
// area ABOVE the split line (Canteen); ROOM_CLIP[1] keeps only the area BELOW it (Dear Mother).
const ROOM_CLIP: THREE.Plane[] = [new THREE.Plane(), new THREE.Plane()]

function PhoneRoomClip() {
  const { camera } = useThree()
  useFrame(() => {
    if (!coarse) return
    const cam = camera as THREE.PerspectiveCamera
    const fovV = THREE.MathUtils.degToRad(cam.fov)
    const yNdc = 1 - 2 * SPLIT_FRACTION
    const theta = Math.atan(Math.tan(fovV / 2) * yNdc)
    const F = new THREE.Vector3(); cam.getWorldDirection(F)
    const worldUp = new THREE.Vector3(0, 1, 0)
    const R = new THREE.Vector3().crossVectors(F, worldUp)
    if (R.lengthSq() < 1e-6) R.set(1, 0, 0); else R.normalize()
    const U = new THREE.Vector3().crossVectors(R, F).normalize()
    const dir = F.clone().multiplyScalar(Math.cos(theta)).addScaledVector(U, Math.sin(theta)).normalize()
    const normal = new THREE.Vector3().crossVectors(R, dir)
    if (normal.lengthSq() < 1e-6) normal.set(0, 1, 0); else normal.normalize()
    if (normal.dot(U) < 0) normal.negate()
    const constant = -normal.dot(cam.position)
    ROOM_CLIP[0].normal.copy(normal); ROOM_CLIP[0].constant = constant
    ROOM_CLIP[1].normal.copy(normal).negate(); ROOM_CLIP[1].constant = -constant
  })
  return null
}

function Room({ i }: { i: number }) {
  const room = rooms[i], cfg = CFG[i]
  const lightsToUse = coarse ? cfg.lights.slice(0, 3) : cfg.lights
  const beacon = useRef<THREE.Mesh>(null), g = useRef<THREE.Group>(null), art = useRef<THREE.Group>(null), L = useRef<THREE.PointLight[]>([]), txt = useRef<HTMLDivElement>(null)
  const mats = useRef<THREE.Material[]>([]), st = useRef({ h: 0, q: 0 }), [on, setOn] = useState(true)
  const { size } = useThree(), portrait = size.width / size.height < 1
  const s = portrait ? 0.55 : 1, px = portrait ? 0 : i ? 3.6 : -3.6, py = portrait ? PORTRAIT_PY[i] : 0.4
  const tex = useMemo(glowTexture, [])
  const portal = useMemo(() => ({ current: document.getElementById(coarse ? (i === 0 ? 'room-ui-top' : 'room-ui-bottom') : 'room-ui') as HTMLElement }), [i])
  useFrame(({ clock }) => {
    if (!on && (P.value > 0.62 || P.r > 0)) setOn(true)
    const gr = g.current; if (!gr) return
    const r = P.r, rev = sstep(i ? 0.4 : 0.34, i ? 0.86 : 0.78, r), t = clock.elapsedTime, a = st.current, red = P.reduced
    a.h += ((H.i === i ? 1 : 0) - a.h) * 0.04; a.q += ((H.i >= 0 && H.i !== i ? 1 : 0) - a.q) * 0.04
    const bm = beacon.current; if (bm) { const bc = sstep(0.25, 0.35, r) * (1 - 0.6 * sstep(0.5, 0.75, r)); (bm.material as THREE.MeshBasicMaterial).opacity = 0.5 * bc * (1 - 0.9 * E.quiet); bm.visible = bc > 0.003; bm.scale.setScalar(3 + 0.3 * Math.sin(t * 0.7 + i)) }
    gr.visible = on; if (!gr.visible) return
    if (!mats.current.length && gr.children.length > 3) gr.traverse((o: any) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => { if (!mats.current.includes(m)) { m.userData.b = m.opacity; m.transparent = true; m.needsUpdate = true; if (coarse) m.clippingPlanes = [ROOM_CLIP[i]]; mats.current.push(m) } }) })
    const op = Math.pow(rev, 1.4) * (1 - 0.45 * a.q) * (1 - 0.9 * E.quiet * (E.room === i ? 0 : 1))
    mats.current.forEach((m) => { m.opacity = m.userData.b * op })
    cfg.lights.forEach((l, j) => { const pl = L.current[j]; if (pl) pl.intensity = l.i * Math.pow(rev, 1.2) * (1 + 0.9 * a.h * (j === 0 ? 1 : i === 1 && j === 1 ? 1.2 : 0.3)) * (1 - 0.5 * a.q) * (1 + (red ? 0 : 0.05 * Math.sin(t * 0.8 + i))) * (1 - 0.9 * E.quiet * (E.room === i ? 0 : 1)) * (i === 0 ? 1 + 0.8 * Math.max(0, E.k) : 1 - 0.95 * E.dark) * (i === 0 && j === 3 ? 1 + 0.15 * a.h * Math.sin(t * 19 + Math.sin(t * 3) * 4) : 1) })
    gr.position.set(px, py, -30 + a.h - a.q * 0.8)
    if (art.current) { art.current.rotation.y = 0; art.current.rotation.x = 0; art.current.position.y = red ? 0 : Math.sin(t * 0.4 + i) * 0.02 }
    if (txt.current) { txt.current.style.opacity = String(sstep(0.85, 0.97, r) * (0.5 + 0.5 * a.h) * (1 - 0.4 * a.q) * (1 - E.quiet)); txt.current.style.transform = `translateY(${(1 - a.h) * 4}px)` }
  })
  return (
    <>
    <mesh ref={beacon} position={[px, py + 0.2, -31]} visible={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={tex} color={cfg.beacon} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <group ref={g} position={[px, py, -30]} scale={s} visible={false}>
      <mesh position={[0, 0.2, -1.8]}><planeGeometry args={[7, 6]} /><meshBasicMaterial map={tex} color={cfg.glow} opacity={0.35} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      {on && <group ref={art}>{room.model ? <ModelSlot url={room.model} /> : i === 0 ? <Canteen /> : <Tombstone />}</group>}
      {on && (i === 0 ? <CanteenEnv /> : <TombEnv />)}
      {lightsToUse.map((l, j) => <pointLight key={j} ref={(p) => { if (p) L.current[j] = p }} position={l.p as [number, number, number]} color={l.c} distance={12} decay={2} intensity={0} />)}
      {!coarse && <mesh position={[0, 0.2, 0]} onPointerOver={() => { if (P.r > 0.9 && E.room < 0) H.i = i }} onPointerOut={() => { if (H.i === i) H.i = -1 }} onClick={() => { if (P.r > 0.9) enterRoom(i) }}><planeGeometry args={[5, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
      <Html position={[0, -2.35, 0]} center portal={portal as any} pointerEvents="none" zIndexRange={[40, 0]}>
        <div ref={txt} style={{ opacity: 0 }} className="w-[min(80vw,24rem)] text-center transition-transform duration-[1800ms]">
          <p className="font-mono text-[10px] tracking-[0.5em] text-bone/60">{room.n}</p>
          <h3 className="mt-2 font-display text-[clamp(2.4rem,4.4vw,4.6rem)] font-light uppercase italic leading-[0.9] tracking-[0.02em] text-bone">{room.name}</h3>
          <p className="mx-auto mt-3 max-w-[26ch] font-mono text-[10px] uppercase leading-[1.9] tracking-[0.3em] text-bone/55">{room.text}</p>
          <button onClick={() => enterRoom(i)} className="pointer-events-auto mt-4 inline-block border-b border-bone/30 pb-1 font-mono text-[9px] uppercase tracking-[0.5em] text-bone/70 transition-colors duration-700 hover:border-bone hover:text-bone">Enter</button>
        </div>
      </Html>
    </group>
    </>
  )
}
// phone-only: a plain, screen-space-fixed divider (not a 3D anchor) locked to the exact same
// SPLIT_FRACTION used by the text-clip containers and the real clip planes above, so all three
// always agree on precisely the same line, no matter what the camera is doing.
function PhoneDivider() {
  const ref = useRef<HTMLDivElement | null>(null)
  useFrame(() => { if (ref.current) ref.current.style.opacity = String(sstep(0.3, 0.42, P.r) * (1 - E.quiet)) })
  if (!coarse || typeof document === 'undefined') return null
  return createPortal(
    <div ref={ref} style={{ position: 'fixed', left: 0, top: `calc(${SPLIT_FRACTION * 100}dvh - 60px)`, width: '100vw', height: '120px', opacity: 0, zIndex: 45, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.96) 38%, rgba(0,0,0,0.96) 62%, rgba(0,0,0,0) 100%)' }} />
      <div style={{ position: 'relative', width: '100%', height: '2px', background: 'linear-gradient(90deg, rgba(60,80,255,0.95) 0%, rgba(150,70,220,0.95) 50%, rgba(255,60,55,0.95) 100%)', boxShadow: '0 0 14px rgba(130,90,220,0.55)' }} />
    </div>,
    document.body
  )
}
export default function RoomWorlds() {
  return (
    <>
      <Room i={0} />
      <Room i={1} />
      <PhoneRoomClip />
      <PhoneDivider />
    </>
  )
}