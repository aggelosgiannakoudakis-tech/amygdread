'use client'
import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { P, H } from '../lib/progress'
import { sstep } from '../lib/math'
import { rooms } from '../lib/content'
import { E, enterRoom } from '../lib/enter'
import Canteen from './Canteen'
import Tombstone from './Tombstone'
import Cutaway from './Cutaway'
import { CanteenEnv, TombEnv } from './RoomEnv'

// Two different realities. Lights are the only thing that exists at first: the artifacts are ghosts until they resolve.
const CFG = [
  { beacon: '#c4642a', glow: '#6a2410', lights: [{ c: '#ff8a4a', p: [1.6, 1.2, 2.2], i: 70 }, { c: '#ff3a2a', p: [-1, 0.5, -2.2], i: 40 }, { c: '#7a6a58', p: [-2.5, 1, 2], i: 8 }, { c: '#ffb070', p: [0, 3.1, -0.4], i: 22 }, { c: '#ff7a3a', p: [0, -1.6, 0.3], i: 14 }, { c: '#ff8a4a', p: [0, -0.2, 3.5], i: 12 }] },
  { beacon: '#6a6a50', glow: '#2a1a14', lights: [{ c: '#8a6a44', p: [-2.2, 1.6, 1.8], i: 38 }, { c: '#5a1a1a', p: [1, 0.4, -2.2], i: 38 }, { c: '#4a5a2a', p: [0, -0.8, 2], i: 8 }, { c: '#3a1c14', p: [0, -1.4, 2.4], i: 10 }, { c: '#6a3a2a', p: [0, -0.4, 3.5], i: 10 }] },
]
const CFG_TOMB_LAND = { beacon: '#6a6a50', glow: '#2a1a14', lights: [{ c: '#9a7a4c', p: [-2.2, 1.6, 1.8], i: 90 }, { c: '#6a1c1c', p: [1, 0.4, -2.2], i: 60 }, { c: '#5a6a30', p: [0, -0.8, 2], i: 14 }, { c: '#4a2418', p: [0, -1.4, 2.4], i: 16 }, { c: '#7a4a2a', p: [0, -0.4, 2.2], i: 18 }] } // landscape only: brighter, no blue
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c)
}
// Drop a real, openly licensed GLB into public/models and set rooms[i].model: it replaces the procedural artifact.
function ModelSlot({ url }: { url: string }) {
  const { scene } = useGLTF(url), box = new THREE.Box3().setFromObject(scene), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()), k = 3 / Math.max(sz.x, sz.y, sz.z)
  return <group scale={k} position={[-c.x * k, -c.y * k, -c.z * k]}><primitive object={scene} /></group>
}
function Room({ i }: { i: number }) {
  const room = rooms[i]
  const beacon = useRef<THREE.Mesh>(null), g = useRef<THREE.Group>(null), art = useRef<THREE.Group>(null), L = useRef<THREE.PointLight[]>([]), txt = useRef<HTMLDivElement>(null)
  const mats = useRef<THREE.Material[]>([]), st = useRef({ h: 0, q: 0 }), [on, setOn] = useState(false)
  const { size } = useThree(), portrait = size.width / size.height < 1, cut = !portrait, cfg = cut && i === 1 ? CFG_TOMB_LAND : CFG[i]
  const s = portrait ? 0.55 : 1, px = portrait ? 0 : i ? 3.6 : -3.6, py = portrait ? (i ? -1.75 : 1.55) : i ? 0.78 : 0.4
  const tex = useMemo(glowTexture, []), portal = useMemo(() => ({ current: document.getElementById('room-ui') as HTMLElement }), [])
  useFrame(({ clock }) => {
    if (!on && (P.value > 0.62 || P.r > 0)) setOn(true)
    const gr = g.current; if (!gr) return
    const r = P.r, rev = sstep(i ? 0.4 : 0.34, i ? 0.86 : 0.78, r), t = clock.elapsedTime, a = st.current, red = P.reduced
    a.h += ((H.i === i ? 1 : 0) - a.h) * 0.04; a.q += ((H.i >= 0 && H.i !== i ? 1 : 0) - a.q) * 0.04
    const bm = beacon.current; if (bm) { const bc = sstep(0.25, 0.35, r) * (1 - 0.6 * sstep(0.5, 0.75, r)); (bm.material as THREE.MeshBasicMaterial).opacity = 0.5 * bc * (1 - 0.9 * E.quiet); bm.visible = bc > 0.003; bm.scale.setScalar(3 + 0.3 * Math.sin(t * 0.7 + i)) } // a faint warm / cold glow far off, before the scan has finished
    gr.visible = on && rev > 0.003; if (!gr.visible) return
    if (!mats.current.length && gr.children.length > 3) gr.traverse((o: any) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: THREE.Material) => { if (!mats.current.includes(m)) { m.userData.b = m.opacity; m.transparent = true; m.needsUpdate = true; mats.current.push(m) } }) })
    const op = Math.pow(rev, 1.4) * (1 - 0.45 * a.q) * (1 - 0.9 * E.quiet * (E.room === i ? 0 : 1))
    mats.current.forEach((m) => { m.opacity = m.userData.b * op })
    cfg.lights.forEach((l, j) => { const pl = L.current[j]; if (pl) pl.intensity = l.i * Math.pow(rev, 1.2) * (1 + 0.9 * a.h * (j === 0 ? 1 : i === 1 && j === 1 ? 1.2 : 0.3)) * (1 - 0.5 * a.q) * (1 + (red ? 0 : 0.05 * Math.sin(t * 0.8 + i))) * (1 - 0.9 * E.quiet * (E.room === i ? 0 : 1)) * (i === 0 ? 1 + 0.8 * Math.max(0, E.k) : 1 - 0.95 * E.dark) * (i === 0 && j === 3 ? 1 + 0.15 * a.h * Math.sin(t * 19 + Math.sin(t * 3) * 4) : 1) })
    gr.position.set(px, py, -30 + a.h - a.q * 0.8)
    if (art.current) { art.current.rotation.y = (red ? 0 : P.mx * 0.18 * (1 + a.h)); art.current.rotation.x = red ? 0 : P.my * 0.05; art.current.position.y = red ? 0 : Math.sin(t * 0.4 + i) * 0.02 }
    if (txt.current) { txt.current.style.opacity = String(sstep(0.85, 0.97, r) * (0.5 + 0.5 * a.h) * (1 - 0.4 * a.q) * (1 - E.quiet)); txt.current.style.transform = `translateY(${(1 - a.h) * 4}px)` }
  })
  return (
    <>
    <mesh ref={beacon} position={[px, py + 0.2, -31]} visible={false}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={tex} color={cfg.beacon} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
    <group ref={g} position={[px, py, -30]} scale={s} visible={false}>
      <mesh position={[0, 0.2, -1.8]}><planeGeometry args={[7, 6]} /><meshBasicMaterial map={tex} color={cfg.glow} opacity={0.35} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>
      {on && <group ref={art}>{room.model ? <ModelSlot url={room.model} /> : i === 0 ? <Canteen /> : <Tombstone cut={cut} />}</group>}
      {on && (i === 0 ? <CanteenEnv cut={cut} /> : <TombEnv cut={cut} />)}
      {cfg.lights.map((l, j) => <pointLight key={j} ref={(p) => { if (p) L.current[j] = p }} position={l.p as [number, number, number]} color={l.c} distance={12} decay={2} intensity={0} />)}
      <mesh position={[0, 0.2, 0]} onPointerOver={() => { if (P.r > 0.9 && E.room < 0) H.i = i }} onPointerOut={() => { if (H.i === i) H.i = -1 }} onClick={() => { if (P.r > 0.9) enterRoom(i) }}><planeGeometry args={[5, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      <Html position={[0, portrait ? -2.35 : -2.0, 0]} center portal={portal as any} pointerEvents="none" zIndexRange={[40, 0]}>
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
export default function RoomWorlds() { const { size } = useThree(); return <><Room i={0} /><Room i={1} />{size.width / size.height >= 1 && <Cutaway />}</> }
