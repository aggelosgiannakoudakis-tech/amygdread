'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { bake, fbm, rnd } from '../lib/procTex'
import { sstep as sm } from '../lib/math'
import { E } from '../lib/enter'
import { H } from '../lib/progress'
import { useFrame } from '@react-three/fiber'

const mix = (a: number, b: number, t: number) => a + (b - a) * t
const coarse =
  typeof window !== 'undefined' &&
  matchMedia('(pointer:coarse)').matches
const LEAF = ['#2a3a1c', '#3a4a22', '#4a3b1c', '#33261a'], mound = (x: number, z: number) => 0.32 * Math.exp(-(x * x + z * z) / 1.8)
// MOTHER — a heavy, leaning, partly buried grave marker: dense displaced slab (irregular edges, broken corner), weathering maps with the lettering carved into colour + bump (eroded, moss over some letters), earth mound, roots, vines and leaves as real geometry.
export default function Tombstone() {
  const o = useMemo(() => {
    const W = 1024, tc = document.createElement('canvas'); tc.width = tc.height = W
    const t = tc.getContext('2d')!; t.filter = 'blur(1.2px)'; t.fillStyle = '#fff'; t.textAlign = 'center'; t.textBaseline = 'middle'
    t.font = '600 150px "Cormorant Garamond", Georgia, serif'; (t as any).letterSpacing = '14px'; t.fillText('MOTHER', W / 2, W * 0.42)
    const tm = t.getImageData(0, 0, W, W).data
    const stone = bake(W, W, (u, v, x, y) => {
      const a = fbm(u * 5, v * 18, 1), b = fbm(u * 24, v * 24, 2, 3), c = fbm(u * 4, v * 4, 3), base = 0.15 + 0.1 * b + 0.05 * c, stain = sm(0.5, 0.8, a) * 0.5
      const moss = sm(0.5, 0.72, fbm(u * 8, v * 8, 4, 3) * 0.8 + (1 - v) * 0.55 + Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.2)
      const carve = (tm[(y * W + x) * 4 + 3] / 255) * (1 - 0.3 * sm(0.45, 0.68, fbm(u * 30, v * 30, 6))), k = Math.max(0.12, (1 - stain * 0.5) * (1 - 0.85 * carve)), m = moss * 0.55, mb = 0.6 + 0.8 * b
      return [mix(base * 1.04 * k, 0.06 * mb, m), mix(base * k, 0.095 * mb, m), mix(base * 0.88 * k, 0.03 * mb, m), 0.9, 0, 0.5 + (b - 0.5) * 0.4 - carve * 0.75 * (1 - m) + m * 0.1]
    }, (ctx, which) => { for (let i = 0; i < 6; i++) { ctx.strokeStyle = which === 'map' ? 'rgba(0,0,0,.55)' : 'rgba(0,0,0,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); let x = rnd(i, 1) * W, y = rnd(i, 2) * W * 0.5 + 100; ctx.moveTo(x, y); for (let j = 0; j < 14; j++) { x += (rnd(i * 20 + j, 3) - 0.5) * 70; y += 18 + rnd(i * 20 + j, 4) * 50; ctx.lineTo(x, y) } ctx.stroke() } })
    const emissiveTex = new THREE.CanvasTexture(tc) // faint, stone-toned sheen on the letters — reads as light catching the carving, not a separate glow source
    const mat = new THREE.MeshStandardMaterial({ map: stone.map, roughnessMap: stone.orm, roughness: 1, bumpMap: stone.bump, bumpScale: 6, emissiveMap: emissiveTex, emissive: new THREE.Color('#9a9484'), emissiveIntensity: 0.1 })
    const geo = new THREE.BoxGeometry(1.9, 2.4, 0.4, 64, 80, 12), p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      if (y > 0.5) x *= Math.sqrt(1 - Math.min(0.98, ((y - 0.5) / 0.7) ** 2))
      const n = fbm(x * 3 + z * 2, y * 3 + z * 1.7, 8, 3) - 0.5, n2 = fbm(x * 9, y * 9 + z * 5, 9, 3) - 0.5, chip = sm(0.3, 0.75, x) * sm(0.55, 0.95, y)
      x += n * 0.05 + n2 * 0.02 - chip * 0.2; y += n * 0.04 - chip * 0.16; z += n2 * 0.04 + n * 0.03; x *= 1 - 0.04 * ((y + 1.2) / 2.4)
      p.setXYZ(i, x, y, z)
    }
    geo.computeVertexNormals()
    const gb = bake(512, 512, (u, v) => { const a = fbm(u * 10, v * 10, 1), b = fbm(u * 40, v * 40, 2, 3), m = sm(0.55, 0.75, fbm(u * 6, v * 6, 3)), l = sm(0.7, 0.8, b); return [0.06 + 0.05 * a + 0.05 * l - 0.02 * m, 0.045 + 0.04 * a + 0.03 * l + 0.03 * m, 0.03 + 0.03 * a + 0.01 * l, 1, 0, 0.5 + (b - 0.5) * 0.5] })
    const ground = new THREE.CircleGeometry(3.2, 64), gp = ground.attributes.position
    for (let i = 0; i < gp.count; i++) gp.setZ(i, mound(gp.getX(i), gp.getY(i)) + 0.05 * fbm(gp.getX(i) * 2, gp.getY(i) * 2, 3))
    ground.computeVertexNormals()
    const V = (v: number[][]) => new THREE.CatmullRomCurve3(v.map((q) => new THREE.Vector3(q[0], q[1], q[2])))
    // LEFT & RIGHT VINES — rerouted to hug the outer edges the whole way up (zigzag, not straight), climbing well clear of the text's x-range so they never dip back in front of the letters, continuing up to near the top of the stone
    const vines = [
      V([[-0.8, -0.75, 0.25], [-0.78, -0.42, 0.23], [-0.6, -0.1, 0.225], [-0.8, 0.22, 0.23], [-0.58, 0.52, 0.225], [-0.78, 0.8, 0.23], [-0.6, 1.02, 0.22]]),
      V([[0.85, -0.75, 0.25], [0.82, -0.42, 0.23], [0.64, -0.1, 0.225], [0.84, 0.22, 0.23], [0.6, 0.52, 0.225], [0.82, 0.8, 0.23], [0.62, 1.02, 0.22]]),
      V([[-0.45, -0.3, 0.235], [-0.1, -0.2, 0.23], [0.2, -0.28, 0.235], [0.5, -0.2, 0.23]])
    ]
    // GARLAND FRAME — a vine that arcs up and over the text, then down the far side, like a wreath draped around "MOTHER" without ever crossing it
    const frame = V([[-0.95, -0.25, 0.24], [-0.88, 0.1, 0.235], [-0.68, 0.4, 0.23], [-0.3, 0.56, 0.225], [0.3, 0.56, 0.225], [0.68, 0.4, 0.23], [0.88, 0.1, 0.235], [0.95, -0.25, 0.24]])
    const Y = -0.95, roots = [V([[0.5, -0.75, 0.3], [0.9, Y + 0.08, 0.8], [1.5, Y + 0.02, 1.3], [2, Y, 1.5]]), V([[-0.6, -0.75, 0.3], [-1, Y + 0.08, 0.7], [-1.6, Y + 0.02, 1.1], [-2.1, Y, 1.2]]), V([[0, -0.78, 0.35], [0.1, Y + 0.06, 1], [-0.2, Y + 0.02, 1.6]]), V([[-0.9, -0.7, 0], [-1.5, Y + 0.05, -0.5], [-2, Y, -0.9]])]
    const leaf = new THREE.Shape(); leaf.moveTo(0, -0.5); leaf.bezierCurveTo(0.6, -0.2, 0.6, 0.3, 0, 0.5); leaf.bezierCurveTo(-0.6, 0.3, -0.6, -0.2, 0, -0.5)
    const lg = new THREE.ShapeGeometry(leaf); lg.scale(0.16, 0.16, 0.16)
    const place = (n: number, fn: (i: number) => { p: THREE.Vector3; e: THREE.Euler; s: number; c: string }) => { const m = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide }), n), d = new THREE.Object3D(); for (let i = 0; i < n; i++) { const r = fn(i); d.position.copy(r.p); d.rotation.copy(r.e); d.scale.setScalar(r.s); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, new THREE.Color(r.c)) } m.instanceMatrix.needsUpdate = true; return m }
    const vineLeaves = place(170, (i) => {
      if (i < 90) { // dense leaves along the garland — safe anywhere since the frame curve itself never crosses the text
        const tt = rnd(i, 11)
        return { p: frame.getPointAt(tt).add(new THREE.Vector3((rnd(i, 12) - 0.5) * 0.12, (rnd(i, 13) - 0.5) * 0.12, 0.02)), e: new THREE.Euler((rnd(i, 14) - 0.5) * 0.9, (rnd(i, 15) - 0.5) * 0.9, rnd(i, 16) * 6.28), s: 0.65 + rnd(i, 17) * 0.9, c: LEAF[Math.floor(rnd(i, 18) * 4)] }
      }
      const j = i - 90, idx = j % 3
      // vines 0 & 1 now hug the stone's edges their whole length — safe everywhere. vine 2 (low horizontal) still kept clear of the text band.
      const tt = idx === 2 ? (j % 2 === 0 ? rnd(j, 11) * 0.22 : 0.82 + rnd(j, 11) * 0.18) : rnd(j, 11)
      return { p: vines[idx].getPointAt(tt).add(new THREE.Vector3((rnd(j, 12) - 0.5) * 0.1, (rnd(j, 13) - 0.5) * 0.1, 0.02)), e: new THREE.Euler((rnd(j, 14) - 0.5) * 0.9, (rnd(j, 15) - 0.5) * 0.9, rnd(j, 16) * 6.28), s: 0.6 + rnd(j, 17) * 0.9, c: LEAF[Math.floor(rnd(j, 18) * 4)] }
    })
    const litter = place(60, (i) => { const an = rnd(i, 21) * 6.28, r = 0.8 + rnd(i, 22) * 1.8, x = Math.cos(an) * r, z = Math.sin(an) * r * 0.9 + 0.3; return { p: new THREE.Vector3(x, Y + mound(x, z) + 0.015, z), e: new THREE.Euler(-Math.PI / 2 + (rnd(i, 23) - 0.5) * 0.3, 0, rnd(i, 24) * 6.28), s: 0.7 + rnd(i, 25) * 0.8, c: ['#3a2a18', '#4a3a1c', '#2a1f12', '#33261a'][Math.floor(rnd(i, 26) * 4)] } })
    return { mat, geo, ground, gmat: new THREE.MeshStandardMaterial({ map: gb.map, roughnessMap: gb.orm, roughness: 1, bumpMap: gb.bump, bumpScale: 3 }), vines: [...vines, frame], roots, vineLeaves, litter, soil: new THREE.MeshStandardMaterial({ color: '#241a10', roughness: 1 }), vm: new THREE.MeshStandardMaterial({ color: '#2d2a1a', roughness: 1 }) }
  }, [])
  useFrame(({ clock }) => { o.vineLeaves.rotation.z = Math.sin(clock.elapsedTime * 0.5) * 0.004 * (1 + 3 * (H.i === 1 ? 1 : 0)) })
  return (
    <group position={[0, 0.1, 0]} rotation={[0.02, 0.14, 0.05]}>
      <mesh geometry={o.geo} material={o.mat} />
      <object3D ref={(a) => { E.anchors[1] = a }} position={[0, 0.1, 0.2]} />
      <mesh
  geometry={o.ground}
  material={o.gmat}
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, -0.95, 0.3]}
  scale={coarse ? [0.9, 0.9, 1] : [0.9, 2.3, 1]}
  visible={!coarse}
/>
      {o.vines.map((c, i) => <mesh key={i} material={o.vm}><tubeGeometry args={[c, 40, 0.018 + i * 0.004, 6, false]} /></mesh>)}
      {!coarse && o.roots.map((c, i) => <mesh key={i} material={o.soil}><tubeGeometry args={[c, 30, 0.045, 7, false]} /></mesh>)}
      {!coarse && <primitive object={o.vineLeaves} />}
      {!coarse && <primitive object={o.litter} />}
    </group>
  )
}