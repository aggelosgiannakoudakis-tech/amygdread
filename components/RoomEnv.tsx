'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { bake, fbm, rnd } from '../lib/procTex'
import { sstep as sm } from '../lib/math'
import { H } from '../lib/progress'

function isCompactViewport() {
  if (typeof window === 'undefined') return false
  return matchMedia('(pointer:coarse)').matches || window.innerWidth / window.innerHeight < 1
}

const soft = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!; const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c) }
const dark = (c = '#0a0a0a', m = 0.8, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r })
const V = (a: number[][]) => new THREE.CatmullRomCurve3(a.map((q) => new THREE.Vector3(q[0], q[1], q[2])))
const tombMound = (x: number, z: number) => 0.32 * Math.exp(-(x * x + z * z) / 1.8)

export function CanteenEnv() {
  const coarse = isCompactViewport()
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

    const bc = document.createElement('canvas'); bc.width = 128; bc.height = 320
    const bx = bc.getContext('2d')!
    const hg = bx.createLinearGradient(0, 0, 128, 0)
    hg.addColorStop(0, 'rgba(180,40,10,0)')
    hg.addColorStop(0.5, 'rgba(255,100,20,1)')
    hg.addColorStop(1, 'rgba(180,40,10,0)')
    bx.fillStyle = hg
    bx.fillRect(0, 0, 128, 320)
    bx.globalCompositeOperation = 'destination-in'
    const vg = bx.createLinearGradient(0, 0, 0, 320)
    vg.addColorStop(0, 'rgba(255,255,255,0)')
    vg.addColorStop(0.38, 'rgba(255,255,255,0)')
    vg.addColorStop(0.6, 'rgba(255,255,255,0.32)')
    vg.addColorStop(0.85, 'rgba(255,255,255,0.95)')
    vg.addColorStop(0.94, 'rgba(255,255,255,1)')
    vg.addColorStop(1, 'rgba(255,255,255,0)')
    bx.fillStyle = vg
    bx.fillRect(0, 0, 128, 320)
    const beamTex = new THREE.CanvasTexture(bc)
    beamTex.wrapS = beamTex.wrapT = THREE.ClampToEdgeWrapping
    beamTex.generateMipmaps = false
    beamTex.minFilter = THREE.LinearFilter
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })

    return { floorC: [[0.3, 0.6], [-0.9, 0.2], [1.1, -0.3]].map(([x, z]) => V([[x, -0.44, z], [x + 0.2, -0.44, z + 2], [x - 0.1, -0.44, z + 4], [x + 0.3, -0.44, z + 6]])), under: ud, floor: new THREE.MeshStandardMaterial({ map: fl.map, roughnessMap: fl.orm, roughness: 1, bumpMap: fl.bump, bumpScale: 2, alphaMap: new THREE.CanvasTexture(gc), transparent: true }), steel: dark('#101010', 0.8, 0.6), cable: dark('#060606', 0, 0.8), rust: dark('#2a1a10', 0.5, 0.8), puddle: dark('#030303', 0.7, 0.04), bulb: new THREE.MeshBasicMaterial({ color: '#ffc98a' }), tex: soft(), beamMat, cables: [V([[-1.8, 4.5, -0.6], [-1.7, 3.3, -0.5], [-1.95, 2.2, -0.4], [-1.85, 1.5, -0.3]]), V([[2.1, 4.5, -1.2], [2.2, 3.4, -1.1], [1.95, 2.4, -1], [2.05, 1.9, -0.9]]), V([[0.4, 4.5, -2], [0.3, 3.5, -2.1], [0.55, 2.9, -2.1]])] }
  }, [])
  useFrame(({ clock }) => { const t = clock.elapsedTime; steam.current.forEach((m, k) => { if (!m) return; const c = (t * 0.07 + k * 0.33) % 1; m.position.y = 0.9 + c * 1.5; m.scale.setScalar(0.8 + c * 1.4) }) })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={coarse ? [0, -0.47, -0.3] : [0, -0.47, 1.6]} material={o.floor}><planeGeometry args={coarse ? [3.4, 3.6] : [6.4, 10]} /></mesh>
      {coarse && (
        <group>
          {[-1.55, 1.55].map((x, i) => (
            <mesh key={`beam${i}`} position={[x, 0.2, -0.55]} material={o.beamMat}><planeGeometry args={[0.55, 4.2]} /></mesh>
          ))}
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
  const coarse = isCompactViewport()
  const fog = useRef<THREE.Mesh[]>([])
  const o = useMemo(() => {
    const blade = new THREE.PlaneGeometry(0.025, 0.4, 1, 3); blade.translate(0, 0.2, 0)
    const grass = new THREE.InstancedMesh(blade, new THREE.MeshStandardMaterial({ color: '#3a3320', roughness: 1, side: THREE.DoubleSide }), 420), d = new THREE.Object3D()
    for (let i = 0; i < 420; i++) {
      const an = rnd(i, 1) * 6.28
      const r = 0.9 + rnd(i, 2) * 2.5
      const x = Math.cos(an) * r * 0.9
      const z = Math.sin(an) * r * 2 + 0.3
      d.position.set(x, -0.95 + 0.32 * Math.exp(-(x * x + (z / 2.3) * (z / 2.3)) / 1.8), z)
      d.rotation.set((rnd(i, 3) - 0.5) * 0.7, rnd(i, 4) * 6.28, (rnd(i, 5) - 0.5) * 0.7)
      d.scale.set(1, 0.5 + rnd(i, 6) * 0.9, 1)
      d.updateMatrix()
      grass.setMatrixAt(i, d.matrix)
    }

    const PLATFORM_RAW_R = 3.2
    const PLATFORM_SCALE = 0.9
    const PLATFORM_R = PLATFORM_RAW_R * PLATFORM_SCALE
    const PLATFORM_Y = -0.97
    const PLATFORM_Z = 0.3

    const phoneBlade = new THREE.PlaneGeometry(0.022, 0.28, 1, 2)
    phoneBlade.translate(0, 0.14, 0)
    const phoneGrassMat = new THREE.MeshBasicMaterial({ color: '#0b0907', side: THREE.DoubleSide })

    const PHONE_MAX = 1400
    const phoneGrass = new THREE.InstancedMesh(phoneBlade, phoneGrassMat, PHONE_MAX)
    const pd = new THREE.Object3D()
    let gi = 0
    for (let i = 0; i < PHONE_MAX; i++) {
      const an = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * PLATFORM_R * 0.93
      const x = Math.cos(an) * r
      const z = PLATFORM_Z + Math.sin(an) * r

      const cdx = x, cdz = z - (PLATFORM_Z + 0.05)
      if (Math.sqrt(cdx * cdx + cdz * cdz) < 0.42) continue

      const gx = x / PLATFORM_SCALE
      const gy = (PLATFORM_Z - z) / PLATFORM_SCALE
      const surf = tombMound(gx, gy) + 0.05 * fbm(gx * 2, gy * 2, 3)

      const sc = 0.4 + Math.random() * 0.7

      pd.position.set(x, PLATFORM_Y + surf + 0.006, z)
      pd.rotation.set((Math.random() - 0.5) * 0.32, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.32)
      const s = Math.max(0.28, sc)
      pd.scale.set(s, s, s)
      pd.updateMatrix()
      phoneGrass.setMatrixAt(gi, pd.matrix)
      gi++
    }
    phoneGrass.count = gi
    phoneGrass.instanceMatrix.needsUpdate = true

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

    const platform = new THREE.CircleGeometry(PLATFORM_RAW_R, 64)
    const pp = platform.attributes.position
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i)
      const y = pp.getY(i)
      pp.setZ(i, tombMound(x, y) + 0.05 * fbm(x * 2, y * 2, 3))
    }
    platform.computeVertexNormals()

    const gb = bake(512, 512, (u, v) => {
      const a = fbm(u * 10, v * 10, 1)
      const b = fbm(u * 40, v * 40, 2, 3)
      const m = sm(0.55, 0.75, fbm(u * 6, v * 6, 3))
      const l = sm(0.7, 0.8, b)
      return [0.06 + 0.05 * a + 0.05 * l - 0.02 * m, 0.045 + 0.04 * a + 0.03 * l + 0.03 * m, 0.03 + 0.03 * a + 0.01 * l, 1, 0, 0.5 + (b - 0.5) * 0.5]
    })
    const platformMat = new THREE.MeshStandardMaterial({ map: gb.map, roughnessMap: gb.orm, roughness: 1, bumpMap: gb.bump, bumpScale: 3 })

    return { grass, phoneGrass, tm, trees, tex: soft(), rt, under, pg, wall, wm, wroots, stones, planks, stone: dark('#2a2a28', 0, 1), wood: dark('#1c140d', 0, 1), platform, platformMat, platformPos: [0, PLATFORM_Y, PLATFORM_Z] as [number, number, number], platformScale: PLATFORM_SCALE }
  }, [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!coarse) {
      o.grass.rotation.z = Math.sin(t * 0.4) * 0.002 * (1 + 5 * (H.i === 1 ? 1 : 0))
      o.grass.rotation.x = Math.cos(t * 0.33) * 0.0015 * (1 + 5 * (H.i === 1 ? 1 : 0))
    }
    fog.current.forEach((m, k) => { if (m) { m.position.x = Math.sin(t * 0.05 + k * 2) * 0.8; m.rotation.z = t * 0.01 * (k + 1) } })
  })

  return (
    <group>
      {coarse ? (
        <group rotation={[0.14, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={o.platformPos} scale={[o.platformScale, o.platformScale, 1]} geometry={o.platform} material={o.platformMat} />
          <primitive object={o.phoneGrass} />
        </group>
      ) : (
        <>
          <mesh geometry={o.wall} material={o.wm} position={[0, -3.15, 0.3]} scale={[0.9, 1, 2.3]} />
          {o.wroots.map((c, i) => <mesh key={`w${i}`} material={o.rt}><tubeGeometry args={[c, 20, 0.05 + (i % 3) * 0.015, 6, false]} /></mesh>)}
          {o.stones.map((q, i) => <mesh key={`s${i}`} position={q.p} scale={[q.s, q.s * 0.7, q.s * 0.8]} rotation={[i, i * 2, 0]} material={o.stone}><icosahedronGeometry args={[1, 1]} /></mesh>)}
          {o.planks.map((q, i) => <mesh key={`k${i}`} position={q.p} rotation={[0.1 * i, q.r, 0.2 - 0.3 * i]} material={o.wood}><boxGeometry args={[0.6, 0.06, 0.16]} /></mesh>)}
          <primitive object={o.grass} />
        </>
      )}
      {!coarse && o.under.map((c, i) => <mesh key={i} material={o.rt}><tubeGeometry args={[c, 28, 0.03 + (i % 3) * 0.015, 6, false]} /></mesh>)}
      {!coarse && <points geometry={o.pg}><pointsMaterial size={0.03} color="#3a2a1c" sizeAttenuation transparent opacity={0.8} depthWrite={false} /></points>}
      {!coarse && o.trees.map((t, i) => <group key={i}><mesh position={[t.x, t.h / 2 - 1, t.z]} material={o.tm}><cylinderGeometry args={[0.1, 0.22, t.h, 7]} /></mesh>{t.br.map((c, k) => <mesh key={k} material={o.tm}><tubeGeometry args={[c, 12, 0.05, 5, false]} /></mesh>)}</group>)}
      {!coarse && [0, 1, 2].map((k) => <mesh key={k} ref={(m) => { if (m) fog.current[k] = m }} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.78 + k * 0.12, 0.3 - k]}><planeGeometry args={[7, 7]} /><meshBasicMaterial map={o.tex} color="#4a4636" opacity={0.13} transparent blending={THREE.AdditiveBlending} depthWrite={false} /></mesh>)}
    </group>
  )
}