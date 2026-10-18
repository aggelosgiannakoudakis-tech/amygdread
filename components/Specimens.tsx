'use client'
import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { S, SPEC } from '../lib/progress'

// Environmental specimens: the SAME real anatomy, decimated by vertex clustering (built progressively, 2 meshes/frame) so they cost ~tens of thousands of triangles,
// in three conditions (whole / hemisphere / damaged) and different scales, orientations, containers and visibility. Preserved tissue: paler, duller than the hero.
const CELL = 2.6 / 48, K = 64
type G = { full: THREE.BufferGeometry; half: THREE.BufferGeometry; damaged: THREE.BufferGeometry }
const tag = (a: string, b: string) => { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d')!; x.fillStyle = '#c9c1ac'; x.fillRect(0, 0, 256, 96); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(90,70,40,${Math.random() * 0.12})`; x.fillRect(Math.random() * 256, Math.random() * 96, 20, 6) } x.fillStyle = '#1a1410'; x.font = 'bold 22px "IBM Plex Mono",monospace'; x.fillText(a, 12, 38); x.font = '16px "IBM Plex Mono",monospace'; x.fillText(b, 12, 68); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }

export default function Specimens() {
  const [g, setG] = useState<G | null>(null)
  const job = useRef<null | { list: typeof S.pieces; i: number; cells: Map<number, number>; sx: number[]; sy: number[]; sz: number[]; n: number[]; idx: number[] }>(null)
  const m = useMemo(() => { const mm = ({
    glass: new THREE.MeshPhysicalMaterial({ color: '#c8d6d8', transparent: true, opacity: 0.18, roughness: 0.04, clearcoat: 1, side: THREE.FrontSide, depthWrite: false, fog: false }),
    liq: new THREE.MeshStandardMaterial({ color: '#6f6a3a', transparent: true, opacity: 0.2, roughness: 0.3, depthWrite: false, fog: false, side: THREE.FrontSide }),
    liqC: new THREE.MeshStandardMaterial({ color: '#3a4f4c', transparent: true, opacity: 0.2, roughness: 0.3, depthWrite: false, fog: false, side: THREE.FrontSide }),
    steel: new THREE.MeshStandardMaterial({ color: '#6a6f72', metalness: 0.9, roughness: 0.4, fog: false }), dark: new THREE.MeshStandardMaterial({ color: '#16181a', metalness: 0.6, roughness: 0.55, fog: false }),
    flesh: new THREE.MeshPhysicalMaterial({ color: '#a58f87', roughness: 0.6, clearcoat: 0.15, side: THREE.DoubleSide, fog: false }), fleshH: new THREE.MeshPhysicalMaterial({ color: '#9c857d', roughness: 0.62, side: THREE.DoubleSide, fog: false }), fleshD: new THREE.MeshPhysicalMaterial({ color: '#8f7a73', roughness: 0.65, side: THREE.DoubleSide, fog: false }),
    red: new THREE.MeshBasicMaterial({ color: '#ff2a35', transparent: true, opacity: 0.7, fog: false }),
    a2: new THREE.MeshBasicMaterial({ map: tag('SPECIMEN A-02', 'PRESERVED'), fog: false }), b7: new THREE.MeshBasicMaterial({ map: tag('B-07', 'INTEGRITY: 81%'), fog: false }), c11: new THREE.MeshBasicMaterial({ map: tag('C-11', 'UNCLASSIFIED'), fog: false }), d3: new THREE.MeshBasicMaterial({ map: tag('D-03', 'SEALED'), fog: false }),
  }); Object.values(mm).forEach((x: any) => { x.userData.spec = true }); return mm }, [])
  useFrame(() => {
    if (g || !S.norm || !S.pieces.length) return
    const j = (job.current ??= { list: S.pieces.filter((p) => p.layer === 'cortex' || p.layer === 'cerebellum'), i: 0, cells: new Map(), sx: [] as number[], sy: [] as number[], sz: [] as number[], n: [] as number[], idx: [] as number[] }), N = S.norm, v = new THREE.Vector3()
    for (let c = 0; c < 2 && j.i < j.list.length; c++, j.i++) {
      const pc = j.list[j.i], geo = pc.mesh.geometry, pos = geo.attributes.position, ix = geo.index, cellOf = new Int32Array(pos.count)
      for (let a = 0; a < pos.count; a++) { v.fromBufferAttribute(pos, a).add(pc.home).sub(N.c).multiplyScalar(N.s); const key = Math.floor(v.x / CELL) + 32 + (Math.floor(v.y / CELL) + 32) * K + (Math.floor(v.z / CELL) + 32) * K * K; let id = j.cells.get(key); if (id === undefined) { id = j.n.length; j.cells.set(key, id); j.sx.push(0); j.sy.push(0); j.sz.push(0); j.n.push(0) } j.sx[id] += v.x; j.sy[id] += v.y; j.sz[id] += v.z; j.n[id]++; cellOf[a] = id }
      const cnt = ix ? ix.count : pos.count
      for (let t = 0; t < cnt; t += 3) { const a = cellOf[ix ? ix.getX(t) : t], b = cellOf[ix ? ix.getX(t + 1) : t + 1], d = cellOf[ix ? ix.getX(t + 2) : t + 2]; if (a !== b && b !== d && a !== d) j.idx.push(a, b, d) }
    }
    if (j.i < j.list.length) return
    const P3 = new Float32Array(j.n.length * 3); for (let i = 0; i < j.n.length; i++) { P3[i * 3] = j.sx[i] / j.n[i]; P3[i * 3 + 1] = j.sy[i] / j.n[i]; P3[i * 3 + 2] = j.sz[i] / j.n[i] }
    const attr = new THREE.BufferAttribute(P3, 3), mk = (ind: number[]) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', attr); q.setIndex(ind); q.computeVertexNormals(); return q }
    const half: number[] = [], dmg: number[] = []
    for (let t = 0; t < j.idx.length; t += 3) { const a = j.idx[t], b = j.idx[t + 1], c = j.idx[t + 2], cx = (P3[a * 3] + P3[b * 3] + P3[c * 3]) / 3, cy = (P3[a * 3 + 1] + P3[b * 3 + 1] + P3[c * 3 + 1]) / 3, cz = (P3[a * 3 + 2] + P3[b * 3 + 2] + P3[c * 3 + 2]) / 3; if (cx > 0.02) half.push(a, b, c); if (Math.hypot(cx - 0.55, cy - 0.35, cz - 0.7) > 0.75) dmg.push(a, b, c) }
    setG({ full: mk(j.idx), half: mk(half), damaged: mk(dmg) }); SPEC.v++
  })
  const Table = ({ x, z, w, d }: { x: number; z: number; w: number; d: number }) => (<group position={[x, 0, z]}><mesh position={[0, -2.38, 0]} material={m.steel}><boxGeometry args={[w, 0.06, d]} /></mesh>{[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => <mesh key={`${a}${b}`} position={[(a * (w - 0.12)) / 2, -2.9, (b * (d - 0.12)) / 2]} material={m.steel}><cylinderGeometry args={[0.035, 0.035, 1.06, 8]} /></mesh>)}</group>)
  return (
    <group>
      {/* A-02: small preserved jar on a steel table, foreground left (out of focus) */}
      <Table x={-3.0} z={2.1} w={1.5} d={1.1} />
      <group position={[-3.0, -1.7, 2.1]} rotation={[0, 0.35, 0]}>
        {g && <mesh geometry={g.full} material={m.flesh} scale={0.2} rotation={[0.2, 0.8, 0.1]} renderOrder={0} />}
        <mesh position={[0, -0.05, 0]} material={m.liq} renderOrder={1}><cylinderGeometry args={[0.46, 0.46, 1.1, 28]} /></mesh>
        <mesh material={m.glass} renderOrder={2}><cylinderGeometry args={[0.5, 0.5, 1.3, 32]} /></mesh>
        <mesh position={[0, 0.7, 0]} material={m.dark}><cylinderGeometry args={[0.52, 0.52, 0.12, 32]} /></mesh><mesh position={[0, -0.68, 0]} material={m.steel}><cylinderGeometry args={[0.54, 0.54, 0.08, 32]} /></mesh>
        <mesh position={[0, -0.05, 0.505]} material={m.a2}><planeGeometry args={[0.38, 0.14]} /></mesh>
      </group>
      {/* B-07: incomplete hemisphere on a steel tray, midground right */}
      <Table x={4.0} z={-0.8} w={1.7} d={1.1} />
      <mesh position={[4.0, -2.33, -0.8]} material={m.steel}><boxGeometry args={[1.1, 0.04, 0.7]} /></mesh>
      {[[0, 0.35, 1.1, 0.04], [0, -0.35, 1.1, 0.04], [0.55, 0, 0.04, 0.7], [-0.55, 0, 0.04, 0.7]].map(([a, b, w, d], i) => <mesh key={i} position={[4.0 + a, -2.3, -0.8 + b]} material={m.steel}><boxGeometry args={[w, 0.07, d]} /></mesh>)}
      {g && <mesh geometry={g.half} material={m.fleshH} position={[4.0, -2.08, -0.8]} scale={0.26} rotation={[0, -0.6, 0.25]} />}
      <mesh position={[3.4, -2.34, -0.4]} rotation={[-1.2, 0.3, 0]} material={m.b7}><planeGeometry args={[0.3, 0.11]} /></mesh>
      <mesh position={[4.75, -2.31, -1.1]} material={m.red}><sphereGeometry args={[0.035, 10, 10]} /></mesh><pointLight position={[4.7, -2.2, -1]} color="#ff2a35" intensity={1.2} distance={3} decay={2} />
      {/* C-11: suspended in a round flask on a ring stand, far right */}
      <group position={[5.2, -1.65, -3.9]}>
        {g && <mesh geometry={g.full} material={m.flesh} scale={0.22} rotation={[0.5, -0.4, 0.3]} renderOrder={0} />}
        <mesh material={m.liq} renderOrder={1}><sphereGeometry args={[0.7, 28, 20]} /></mesh>
        <mesh material={m.glass} renderOrder={2}><sphereGeometry args={[0.75, 32, 24]} /></mesh>
        <mesh position={[0, 0.95, 0]} material={m.glass} renderOrder={2}><cylinderGeometry args={[0.22, 0.22, 0.45, 20]} /></mesh><mesh position={[0, 1.2, 0]} material={m.dark}><cylinderGeometry args={[0.25, 0.22, 0.14, 20]} /></mesh>
        <mesh position={[0, -0.78, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.steel}><torusGeometry args={[0.5, 0.04, 8, 28]} /></mesh><mesh position={[0.75, -1.15, 0]} material={m.steel}><cylinderGeometry args={[0.04, 0.04, 1.8, 8]} /></mesh>
        <mesh position={[0, -0.25, 0.745]} material={m.c11}><planeGeometry args={[0.34, 0.13]} /></mesh>
      </group>
      {/* D-03: tall containment chamber, background left, faint cold interior light */}
      <group position={[-5.4, -1.1, -6.2]}>
        {g && <mesh geometry={g.full} material={m.flesh} position={[0, 0.2, 0]} scale={0.42} rotation={[0.1, -0.5, 0]} renderOrder={0} />}
        <mesh material={m.liqC} renderOrder={1}><cylinderGeometry args={[0.9, 0.9, 4, 32]} /></mesh>
        <mesh material={m.glass} renderOrder={2}><cylinderGeometry args={[0.95, 0.95, 4.4, 36]} /></mesh>
        <mesh position={[0, 2.3, 0]} material={m.dark}><cylinderGeometry args={[1, 1, 0.2, 36]} /></mesh><mesh position={[0, -2.3, 0]} material={m.steel}><cylinderGeometry args={[1.05, 1.05, 0.2, 36]} /></mesh>
        <pointLight color="#6f8f96" intensity={1.4} distance={6} decay={2} />
        {[-0.4, 0.4].map((x) => <mesh key={x} position={[x, 4, 0]} material={m.dark}><cylinderGeometry args={[0.05, 0.05, 3.4, 8]} /></mesh>)}
        <mesh position={[0, -2.1, 0.96]} material={m.d3}><planeGeometry args={[0.36, 0.13]} /></mesh>
      </group>
      {/* far back: a damaged specimen in a dark chamber, half behind a column */}
      <group position={[4.8, -1.4, -11.5]}>
        {g && <mesh geometry={g.damaged} material={m.fleshD} position={[0, 0.1, 0]} scale={0.36} rotation={[-0.2, 0.9, 0.15]} renderOrder={0} />}
        <mesh material={m.liqC} renderOrder={1}><cylinderGeometry args={[0.75, 0.75, 3.4, 28]} /></mesh>
        <mesh material={m.glass} renderOrder={2}><cylinderGeometry args={[0.8, 0.8, 3.8, 32]} /></mesh>
        <mesh position={[0, 1.95, 0]} material={m.dark}><cylinderGeometry args={[0.85, 0.85, 0.18, 32]} /></mesh><mesh position={[0, -1.95, 0]} material={m.steel}><cylinderGeometry args={[0.9, 0.9, 0.18, 32]} /></mesh>
      </group>
    </group>
  )
}