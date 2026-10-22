'use client'
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { bake, fbm, rnd } from '../lib/procTex'
import { sstep as sm } from '../lib/math'
import { H, P } from '../lib/progress'

const soft = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c) }
const dark = (c = '#0a0a0a', m = 0.8, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r })
const V = (a: number[][]) => new THREE.CatmullRomCurve3(a.map((q) => new THREE.Vector3(q[0], q[1], q[2])))
const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches

// phone-only pillar materials: rust columns + steel collars like desktop, lit by the room lights,
// with a small built-in glow (emissive) so they can never disappear into the black background.
const pillarMat = new THREE.MeshStandardMaterial({ color: '#7a4426', roughness: 0.7, metalness: 0.15, emissive: '#3a1608', emissiveIntensity: 1 })
const collarMat = new THREE.MeshStandardMaterial({ color: '#4a4440', roughness: 0.5, metalness: 0.3, emissive: '#1a120c', emissiveIntensity: 1 })

// phone-only Dear Mother sand: drawn every frame as an exact circle ON SCREEN, then projected back
// onto the ground, so it reads as perfectly round regardless of camera angle or phone size.
const PLAT_Y = -0.97      // ground height under the tombstone (local units)
const SAND_R = 1.8        // circle size (bigger number = bigger circle)
const SAND_DROP = 0.4     // how far the circle's center sits below the tombstone base (0 = centered on base)
const SEG = 64
const _sc = new THREE.Vector3(), _se = new THREE.Vector3(), _so = new THREE.Vector3(), _sd = new THREE.Vector3(), _sp = new THREE.Vector3(), _sq = new THREE.Vector3(), _sm = new THREE.Matrix4()

export function CanteenEnv() {
  const steam = useRef<THREE.Mesh[]>([])
  const o = useMemo(() => {
    const fl = bake(512, 512, (u, v) => { const a = fbm(u * 6, v * 6, 1), b = fbm(u * 30, v * 30, 2, 3), wet = sm(0.55, 0.68, fbm(u * 3, v * 3, 7)), st = sm(0.55, 0.8, fbm(u * 5, v * 9, 4)), g = (0.15 + 0.08 * a + 0.04 * b) * (1 - 0.45 * wet); return [g + 0.06 * st, g + 0.02 * st, g * 0.95, wet ? 0.12 : 0.85, 0, 0.5 + b * 0.3] },
      (ctx, w) => { if (w === 'map') { for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? 'rgba(150,120,30,.4)' : 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(60 + i * 24, 400); ctx.lineTo(84 + i * 24, 400); ctx.lineTo(44 + i * 24, 470); ctx.lineTo(20 + i * 24, 470); ctx.fill() } ctx.globalCompositeOperation = 'destination-out' ; ctx.globalCompositeOperation = 'source-over' } for (let i = 0; i < 7; i++) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); let x = rnd(i, 1) * 512, y = rnd(i, 2) * 512; ctx.moveTo(x, y); for (let j = 0; j < 10; j++) { x += (rnd(i * 9 + j, 3) - 0.5) * 60; y += (rnd(i * 9 + j, 4) - 0.5) * 60; ctx.lineTo(x, y) } ctx.stroke() } })
    ;[fl.map, fl.orm, fl.bump].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2) })
    const gc = document.createElement('canvas'); gc.width = gc.height = 512; const gx = gc.getContext('2d')!; gx.fillStyle = '#000'; gx.fillRect(0, 0, 512, 512); gx.fillStyle = '#fff'
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { gx.fillRect(i * 32, j * 32, 32, 5); gx.fillRect(i * 32, j * 32, 5, 32) }
    let rg = gx.createRadialGradient(256, 174, 20, 256, 174, 130); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = rg; gx.fillRect(0, 0, 512, 512)
    gx.globalCompositeOperation = 'destination-in'
    let lg = gx.createLinearGradient(0, 0, 512, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.22, 'rgba(255,255,255,1)'); lg.addColorStop(0.78, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = lg; gx.fillRect(0, 0, 512, 512)
    lg = gx.createLinearGradient(0, 0, 0, 512); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.18, 'rgba(255,255,255,1)'); lg.addColorStop(0.9, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = lg; gx.fillRect(0, 0, 512, 512)
    const ud = [[-2.2, -0.8], [1.8, -1.4], [-0.6, 1.6], [2.6, 1], [-3.1, 0.9]].map(([x, z]) => V([[x * 0.9, -0.5, z], [x * 0.9 + 0.2, -1.5, z + 0.1], [x - 0.1, -2.8, z + 0.2], [x + 0.15, -4.4, z]]))
    return { floorC: [[0.3, 0.6], [-0.9, 0.2], [1.1, -0.3]].map(([x, z]) => V([[x, -0.44, z], [x + 0.2, -0.44, z + 2], [x - 0.1, -0.44, z + 4], [x + 0.3, -0.44, z + 6]])), under: ud, floor: new THREE.MeshStandardMaterial({ map: fl.map, roughnessMap: fl.orm, roughness: 1, bumpMap: fl.bump, bumpScale: 2, alphaMap: new THREE.CanvasTexture(gc), transparent: true }), steel: dark('#101010', 0.8, 0.6), cable: dark('#060606', 0, 0.8), rust: dark('#2a1a10', 0.5, 0.8), puddle: dark('#030303', 0.7, 0.04), bulb: new THREE.MeshBasicMaterial({ color: '#ffc98a' }), tex: soft(), cables: [V([[-1.8, 4.5, -0.6], [-1.7, 3.3, -0.5], [-1.95, 2.2, -0.4], [-1.85, 1.5, -0.3]]), V([[2.1, 4.5, -1.2], [2.2, 3.4, -1.1], [1.95, 2.4, -1], [2.05, 1.9, -0.9]]), V([[0.4, 4.5, -2], [0.3, 3.5, -2.1], [0.55, 2.9, -2.1]])] }
  }, [])
  useFrame(({ clock }) => { const t = clock.elapsedTime; steam.current.forEach((m, k) => { if (!m) return; const c = (t * 0.07 + k * 0.33) % 1; m.position.y = 0.9 + c * 1.5; m.scale.setScalar(0.8 + c * 1.4) }) })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={coarse ? [0, -0.47, -0.3] : [0, -0.47, 1.6]} material={o.floor}><planeGeometry args={coarse ? [3.4, 3.6] : [6.4, 10]} /></mesh>
      {coarse && (
        // phone-only: 6 rust support columns with steel collars + 2 crossbeams under the cart.
        // Span local y -0.45 to -1.95, which ends above the divider line. noClip = never clipped.
        <group userData={{ noClip: true }}>
          {[-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].map((x, i) => (
            <group key={`leg${i}`} position={[x, 0, -0.4]}>
              <mesh position={[0, -1.2, 0]} material={pillarMat}><cylinderGeometry args={[0.09, 0.09, 1.5, 12]} /></mesh>
              <mesh position={[0, -0.56, 0]} material={collarMat}><cylinderGeometry args={[0.15, 0.15, 0.08, 12]} /></mesh>
              <mesh position={[0, -1.84, 0]} material={collarMat}><cylinderGeometry args={[0.14, 0.14, 0.07, 12]} /></mesh>
            </group>
          ))}
          <mesh position={[0, -0.52, -0.4]} material={collarMat}><boxGeometry args={[3.4, 0.08, 0.12]} /></mesh>
          <mesh position={[0, -1.3, -0.4]} material={collarMat}><boxGeometry args={[3.2, 0.05, 0.08]} /></mesh>
        </group>
      )}
      {!coarse && (
        <>
          {[[-2.2, -0.8, 0.17], [1.8, -1.4, 0.22], [-0.6, 1.6, 0.14], [2.6, 1, 0.18], [-3.1, 0.9, 0.2], [-1.4, 3.4, 0.16], [1.9, 4.4, 0.2], [-2.4, 5.2, 0.18], [0.6, 6, 0.15]].map(([x, z, r], i) => (<group key={`p${i}`}><mesh position={[x, -3.7, z]} material={o.rust}><cylinderGeometry args={[r, r, 6.4, 14]} /></mesh><mesh position={[x, -1.3, z]} material={o.steel}><cylinderGeometry args={[r * 1.6, r * 1.6, 0.12, 14]} /></mesh><mesh position={[x, -2.9, z]} material={o.steel}><cylinderGeometry args={[r * 1.5, r * 1.5, 0.1, 14]} /></mesh></group>))}
          <mesh position={[0, -2.4, -1]} rotation={[0, 0, Math.PI / 2]} material={o.rust}><cylinderGeometry args={[0.12, 0.12, 6, 12]} /></mesh><mesh position={[1.2, -3.6, 1.5]} rotation={[Math.PI / 2, 0, 0]} material={o.rust}><cylinderGeometry args={[0.12, 0.12, 12, 12]} /></mesh>
          {[-1.8, 1.8].map((x) => <mesh key={x} position={[x, -1.2, 1.5]} material={o.steel}><boxGeometry args={[0.18, 0.5, 12]} /></mesh>)}{[-3, -1, 1, 3, 5, 7].map((z) => <mesh key={z} position={[0, -1.45, z]} material={o.steel}><boxGeometry args={[4.2, 0.25, 0.2]} /></mesh>)}
          <mesh position={[0, -1.6, -0.4]} rotation={[0, 0, Math.PI / 2]} material={o.steel}><cylinderGeometry args={[0.07, 0.07, 3.6, 10]} /></mesh>
          {[-1.7, 1.7].map((x) => (<group key={x} position={[x, -1.6, -0.4]} rotation={[0, Math.PI / 2, 0]}><mesh material={o.rust}><torusGeometry args={[0.9, 0.09, 10, 36]} /></mesh>{Array.from({ length: 8 }, (_, k) => <mesh key={k} rotation={[0, 0, (k / 8) * Math.PI]} material={o.rust}><boxGeometry args={[1.8, 0.05, 0.06]} /></mesh>)}</group>))}
          {o.floorC.map((c, i) => <mesh key={`f${i}`} material={o.cable}><tubeGeometry args={[c, 30, 0.03, 6, false]} /></mesh>)}
          {o.under.map((c, i) => <mesh key={`u${i}`} material={o.cable}><tubeGeometry args={[c, 24, 0.025, 6, false]} /></mesh>)}
          {[[0.39, 0.07], [-0.52, -1.34]].map(([x, z], i) => <mesh key={`r${i}`} position={[x - 1.26, -0.43, z + 0.81]} rotation={[0, -1, 0]} material={o.steel}><boxGeometry args={[0.1, 0.09, 9]} /></mesh>)}
          {Array.from({ length: 11 }, (_, k) => <mesh key={`t${k}`} position={[-0.065 - 0.84 * (k * 0.85 - 2.2), -0.46, -0.635 + 0.54 * (k * 0.85 - 2.2)]} rotation={[0, -1, 0]} material={o.rust}><boxGeometry args={[2.2, 0.06, 0.18]} /></mesh>)}
          {o.cables.map((c, i) => <mesh key={i} material={o.cable}><tubeGeometry args={[c, 24, 0.022, 6, false]} /></mesh>)}
          {[-4.4, -1.4].map((x, i) => <mesh key={i} position={[x, 1.8, -5.5 - i]} material={o.steel}><cylinderGeometry args={[0.3, 0.3, 10, 14]} /></mesh>)}
          <mesh position={[-1.8, 3.9, -5.8]} rotation={[0, 0, Math.PI / 2]} material={o.steel}><cylinderGeometry args={[0.16, 0.16, 5.5, 12]} /></mesh>
        </>
      )}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.4, -0.465, 1.3]} material={o.puddle}><circleGeometry args={[0.9, 32]} /></mesh>
      {!coarse && (
        <>
          <mesh position={[0, 3.1, -0.5]} material={o.steel}><coneGeometry args={[0.38, 0.3, 20, 1, true]} /></mesh>
          <mesh position={[0, 2.95, -0.5]} material={o.bulb}><sphereGeometry args={[0.07, 10, 10]} /></mesh>
          {[0, 1, 2].map((k) => <mesh key={k} ref={(m) => { if (m) steam.current[k] = m }} position={[0.1 * k, 1 + k * 0.4, -0.2]}><planeGeometry args={[1, 1]} /><meshBasicMaterial map={o.tex} color="#8a7a6a" opacity={0.1} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}
        </>
      )}
      <mesh position={[-1.6, -0.34, 1.4]} rotation={[0, 0.5, Math.PI / 2]} material={o.rust}><cylinderGeometry args={[0.18, 0.15, 0.3, 16, 1, true]} /></mesh>
      {!coarse && (
        <>
          {[[-1.1, 1.7], [-0.8, 1.9], [0.9, 2.1]].map(([x, z], i) => <mesh key={i} position={[x, -0.41, z]} rotation={[0, 0, i === 1 ? Math.PI / 2 : 0]} material={o.rust}><cylinderGeometry args={[0.06, 0.06, 0.1, 10]} /></mesh>)}
          <mesh position={[1.9, -0.455, 0.2]} rotation={[0, 0.3, 0.05]} material={o.rust}><cylinderGeometry args={[0.3, 0.3, 0.02, 20]} /></mesh>
        </>
      )}
    </group>
  )
}
export function TombEnv() {
  const fog = useRef<THREE.Mesh[]>([])
  const plat = useRef<THREE.Mesh>(null)
  const cache = useRef<number[]>([NaN, NaN, NaN, NaN, NaN, NaN])
  const { camera, size } = useThree()
  const o = useMemo(() => {
    const blade = new THREE.PlaneGeometry(0.025, 0.4, 1, 3); blade.translate(0, 0.2, 0)
    const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#3a3320', roughness: 1, side: THREE.DoubleSide }), 420), d = new THREE.Object3D()
    for (let i = 0; i < 420; i++) {
      // desktop: original distribution (unchanged). phone: initial placement only; it is replaced
      // every frame below so the grass always sits inside the on-screen sand circle.
      const an = rnd(i, 1) * 6.28
      let x: number, z: number
      if (coarse) { const r = 0.5 + rnd(i, 2) * 1.5; x = Math.cos(an) * r; z = Math.sin(an) * r }
      else { const r = 0.9 + rnd(i, 2) * 2.5; x = Math.cos(an) * r * 0.9; z = Math.sin(an) * r * 2 + 0.3 }
      d.position.set(x, -0.95 + 0.32 * Math.exp(-(x * x + (z / 2.3) * (z / 2.3)) / 1.8), z); d.rotation.set((rnd(i, 3) - 0.5) * 0.7, rnd(i, 4) * 6.28, (rnd(i, 5) - 0.5) * 0.7); d.scale.set(1, 0.5 + rnd(i, 6) * 0.9, 1); d.updateMatrix(); grass.setMatrixAt(i, d.matrix)
    }
    if (coarse) grass.frustumCulled = false
    const tm = dark('#050605', 0, 1), trees = [[-5, -7], [-3.4, -9], [-1.2, -8], [2.4, -9.5], [4.2, -7.5], [5.6, -10]].map(([x, z], i) => ({ x, z, h: 6 + rnd(i, 9) * 2, br: [0, 1, 2].map((k) => V([[x, 3 + k * 0.6, z], [x + (rnd(i * 3 + k, 7) - 0.5) * 1.4, 4 + k * 0.7, z + 0.1], [x + (rnd(i * 3 + k, 8) - 0.5) * 2.4, 5.2 + k * 0.6, z]])) }))
    const rt = dark('#1b120a', 0, 1), under = Array.from({ length: 9 }, (_, i) => V([[(rnd(i, 31) - 0.5) * 1.8, -0.85, 1.1 + rnd(i, 32) * 0.9], [(rnd(i, 33) - 0.5) * 1.6, -2, 1.1 + rnd(i, 34) * 0.9], [(rnd(i, 35) - 0.5) * 1.8, -3.4, 1 + rnd(i, 36)], [(rnd(i, 37) - 0.5) * 1.6, -5.2, 1.1 + rnd(i, 38) * 0.9]]))
    const pg = new THREE.BufferGeometry(), pa = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) { pa[i * 3] = (rnd(i, 41) - 0.5) * 3; pa[i * 3 + 1] = -1 - rnd(i, 42) * 5; pa[i * 3 + 2] = 0.7 + rnd(i, 43) * 1.8 } pg.setAttribute('position', new THREE.BufferAttribute(pa, 3))
    const st = bake(512, 512, (u, v) => { const band = Math.floor((1 - v) * 8 + fbm(u * 3, v * 3, 9) * 2), cols = [[0.05, 0.035, 0.025], [0.1, 0.07, 0.045], [0.07, 0.06, 0.05], [0.13, 0.09, 0.06], [0.06, 0.05, 0.04], [0.1, 0.08, 0.06], [0.05, 0.04, 0.035], [0.08, 0.06, 0.05]], c = cols[band % 8], n = 0.7 + 0.6 * fbm(u * 30, v * 30, 5), stn = sm(0.74, 0.8, fbm(u * 14, v * 14, 6)); return [c[0] * n + 0.06 * stn, c[1] * n + 0.06 * stn, c[2] * n + 0.055 * stn, 1, 0, 0.5 + (n - 1) * 0.5] })
    const ac = document.createElement('canvas'); ac.width = 8; ac.height = 256; const ax = ac.getContext('2d')!; const ag = ax.createLinearGradient(0, 0, 0, 256); ag.addColorStop(0, '#fff'); ag.addColorStop(0.35, '#bbb'); ag.addColorStop(1, '#000'); ax.fillStyle = ag; ax.fillRect(0, 0, 8, 256)
    const wall = new THREE.CylinderGeometry(3.2, 2.9, 4.6, 64, 14, true), wp = wall.attributes.position; for (let i = 0; i < wp.count; i++) { const x = wp.getX(i), z = wp.getZ(i), y = wp.getY(i), f = 1 + 0.06 * (fbm(Math.atan2(z, x) * 3, y * 0.8, 2) - 0.5); wp.setX(i, x * f); wp.setZ(i, z * f) } wall.computeVertexNormals()
    const wm = new THREE.MeshStandardMaterial({ map: st.map, roughnessMap: st.orm, roughness: 1, bumpMap: st.bump, bumpScale: 3, alphaMap: new THREE.CanvasTexture(ac), transparent: true })
    const R = (y: number) => 3.2 - 0.3 * ((-0.85 - y) / 4.6), onWall = (phi: number, y: number, k = 1) => new THREE.Vector3(R(y) * k * Math.sin(phi) * 0.9, y, 0.3 + R(y) * k * Math.cos(phi) * 2.3)
    const wroots = Array.from({ length: 8 }, (_, i) => { const phi = -1.1 + i * 0.3 + (rnd(i, 51) - 0.5) * 0.1; return V([-1.1, -2, -3, -4].map((y, j) => { const p = onWall(phi + (rnd(i * 4 + j, 52) - 0.5) * 0.12, y - (rnd(i, 53)) * 0.3, 1.02); return [p.x, p.y, p.z] })) })
    const stones = Array.from({ length: 7 }, (_, i) => { const p = onWall(-1.2 + i * 0.4 + rnd(i, 61) * 0.15, -1.4 - rnd(i, 62) * 2.8, 0.985); return { p, s: 0.15 + rnd(i, 63) * 0.15 } })
    const planks = [[-0.4, -2.6], [0.6, -3.5]].map(([phi, y], i) => ({ p: onWall(phi, y, 1.0), r: -phi, t: i }))
    // phone sand platform: center vertex + SEG ring vertices, positions rewritten in useFrame
    const ring = new Float32Array((SEG + 1) * 3)
    const platform = new THREE.BufferGeometry()
    platform.setAttribute('position', new THREE.BufferAttribute(ring, 3))
    const nrm = new Float32Array((SEG + 1) * 3); for (let k = 0; k <= SEG; k++) nrm[k * 3 + 1] = 1
    platform.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
    const idx: number[] = []; for (let k = 0; k < SEG; k++) idx.push(0, 1 + k, 1 + ((k + 1) % SEG))
    platform.setIndex(idx)
    const platformMat = dark('#141009', 0, 1); platformMat.side = THREE.DoubleSide
    // phone grass: fixed per-blade angle / distance-from-center / tilt / height
    const bA = new Float32Array(420), bF = new Float32Array(420), bQ: THREE.Quaternion[] = [], bS: THREE.Vector3[] = []
    for (let i = 0; i < 420; i++) {
      bA[i] = (i / 420) * Math.PI * 2 + (rnd(i, 1) - 0.5) * 0.25
      bF[i] = 0.22 + rnd(i, 2) * 0.74
      bQ.push(new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd(i, 3) - 0.5) * 0.7, rnd(i, 4) * 6.28, (rnd(i, 5) - 0.5) * 0.7)))
      bS.push(new THREE.Vector3(1, 0.5 + rnd(i, 6) * 0.9, 1))
    }
    return { grass, tm, trees, tex: soft(), rt, under, pg, wall, wm, wroots, stones, planks, stone: dark('#2a2a28', 0, 1), wood: dark('#1c140d', 0, 1), platform, platformMat, ring, bA, bF, bQ, bS }
  }, [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; o.grass.rotation.z = Math.sin(t * 0.4) * 0.002 * (1 + 5 * (H.i === 1 ? 1 : 0)); o.grass.rotation.x = Math.cos(t * 0.33) * 0.0015 * (1 + 5 * (H.i === 1 ? 1 : 0)); fog.current.forEach((m, k) => { if (m) { m.position.x = Math.sin(t * 0.05 + k * 2) * 0.8; m.rotation.z = t * 0.01 * (k + 1) } })
    // ---- phone only: rebuild sand as an exact on-screen circle ----
    if (!coarse || P.r < 0.3) return
    const m = plat.current, par = m ? m.parent : null
    if (!m || !par) return
    camera.updateMatrixWorld(); par.updateWorldMatrix(true, false)
    camera.getWorldPosition(_so)
    _sc.set(0, PLAT_Y, 0); par.localToWorld(_sc); const gy = _sc.y
    _se.set(SAND_R, PLAT_Y, 0); par.localToWorld(_se)
    _sc.project(camera); _se.project(camera)
    const rx = Math.abs(_se.x - _sc.x), ry = rx * (size.width / size.height)
    const cx = _sc.x, cy = _sc.y - ry * SAND_DROP
    const c = cache.current
    if (Math.abs(c[0] - cx) < 1e-5 && Math.abs(c[1] - cy) < 1e-5 && Math.abs(c[2] - rx) < 1e-5 && Math.abs(c[3] - _so.x) < 1e-5 && Math.abs(c[4] - _so.y) < 1e-5 && Math.abs(c[5] - _so.z) < 1e-5) return
    c[0] = cx; c[1] = cy; c[2] = rx; c[3] = _so.x; c[4] = _so.y; c[5] = _so.z
    const hit = (nx: number, ny: number, out: THREE.Vector3) => {
      _sd.set(nx, ny, 0.5).unproject(camera).sub(_so)
      let k = _sd.y < -1e-6 ? (gy - _so.y) / _sd.y : 100
      if (!(k > 0) || k > 100) k = 100
      out.copy(_so).addScaledVector(_sd, k)
      par.worldToLocal(out)
    }
    const pos = o.ring
    hit(cx, cy, _sp); pos[0] = _sp.x; pos[1] = PLAT_Y; pos[2] = _sp.z
    for (let k = 0; k < SEG; k++) {
      const th = (k / SEG) * Math.PI * 2
      hit(cx + rx * Math.cos(th), cy + ry * Math.sin(th), _sp)
      const j = (k + 1) * 3; pos[j] = _sp.x; pos[j + 1] = PLAT_Y; pos[j + 2] = _sp.z
    }
    ;(m.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    const ccx = pos[0], ccz = pos[2]
    for (let i = 0; i < 420; i++) {
      const kf = ((((o.bA[i] / (Math.PI * 2)) % 1) + 1) % 1) * SEG, k0 = Math.floor(kf) % SEG, f = kf - Math.floor(kf), k1 = (k0 + 1) % SEG
      const ex = pos[(k0 + 1) * 3] * (1 - f) + pos[(k1 + 1) * 3] * f, ez = pos[(k0 + 1) * 3 + 2] * (1 - f) + pos[(k1 + 1) * 3 + 2] * f
      _sq.set(ccx + (ex - ccx) * o.bF[i], PLAT_Y + 0.01, ccz + (ez - ccz) * o.bF[i])
      _sm.compose(_sq, o.bQ[i], o.bS[i]); o.grass.setMatrixAt(i, _sm)
    }
    o.grass.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      {coarse ? (
        <mesh ref={plat} geometry={o.platform} material={o.platformMat} frustumCulled={false} />
      ) : (
        <>
          <mesh geometry={o.wall} material={o.wm} position={[0, -3.15, 0.3]} scale={[0.9, 1, 2.3]} />
          {o.wroots.map((c, i) => <mesh key={`w${i}`} material={o.rt}><tubeGeometry args={[c, 20, 0.05 + (i % 3) * 0.015, 6, false]} /></mesh>)}
          {o.stones.map((q, i) => <mesh key={`s${i}`} position={q.p} scale={[q.s, q.s * 0.7, q.s * 0.8]} rotation={[i, i * 2, 0]} material={o.stone}><icosahedronGeometry args={[1, 1]} /></mesh>)}
          {o.planks.map((q, i) => <mesh key={`k${i}`} position={q.p} rotation={[0.1 * i, q.r, 0.2 - 0.3 * i]} material={o.wood}><boxGeometry args={[0.6, 0.06, 0.16]} /></mesh>)}
        </>
      )}
      <instancedMesh args={[undefined as any, undefined as any, 420]} ref={() => {}} visible={false} />
      <primitive object={o.grass} />
    </group>
  )
}