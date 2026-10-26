'use client'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { P, FOCUS, H } from '../lib/progress'
import { E, EF, enterCam } from '../lib/enter'
import { sstep, bell } from '../lib/math'

// 11 evenly spaced keyframes (every 10% of scroll). Spacing between points sets the pace; Catmull-Rom keeps it fluid.
const K: [number[], number[]][] = [
  [[0, 0.1, 6.0], [0, 0, 0]], [[-0.2, 0.15, 5.6], [0, 0, 0]], [[0.3, 0.25, 4.8], [0, 0, 0]], [[0.55, 0.2, 4.0], [0.4, 0, 0]],
  [[-0.4, 0.4, 3.7], [0.2, 0, 0]], [[-0.15, 0.3, 3.4], [0, 0, 0]], [[0.1, 0.1, 2.8], [0, 0, -0.5]], [[0, 0, 1.7], [0, 0, -1.5]],
  [[0, 0, 0.2], [0, 0, -2.5]], [[0, 0, -1.8], [0, 0, -5]], [[0, 0.1, -5.5], [0, 0.1, -10]],
]
const posC = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k[0])), false, 'centripetal')
const lookC = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal')
const a = new THREE.Vector3(), b = new THREE.Vector3(), RL = new THREE.Vector3(0, 0.1, -30), hx = { v: 0 }
const dirV = new THREE.Vector3() // reused each frame to avoid allocating a new Vector3 via .clone() every tick

export default function CameraRig() {
  useFrame((state) => {
    const { camera, size, clock, scene } = state, p = P.value, t = clock.elapsedTime, red = P.reduced
    posC.getPoint(p, a); lookC.getPoint(p, b)
    const aspect = size.width / size.height
    if (aspect < 1.1 && a.z > 0) a.z *= 1 + (1.1 - aspect) * (1 - sstep(0.5, 0.65, p)) // keep brain framed on portrait screens
    const w = 1 - 0.85 * sstep(0.55, 0.75, p)
    const r = P.r
    const mouseGate = 1 - sstep(0, 0.08, r) // fades mouse parallax to 0 once rooms view engages
    if (!red) { a.x += P.mx * 0.22 * w * mouseGate + Math.sin(t * 0.2) * 0.03; a.y += -P.my * 0.14 * w * mouseGate + Math.cos(t * 0.17) * 0.02; b.x += P.mx * 0.05 * mouseGate }
    if (r > 0) { const u = Math.min(1, Math.max(0, (r - 0.25) / 0.75)), zt = 2 * sstep(0, 0.25, r) + 13.5 * u * (2 - u), sw = -0.9 * bell(0.6, 0.7, 0.8, r) + 0.9 * bell(0.75, 0.85, 0.95, r), dr = sstep(0, 0.1, r) * (1 - sstep(0.15, 0.25, r)); a.z -= zt; a.x += sw + Math.sin(r * 14) * 0.1 * dr; a.y += 0.6 * sstep(0.6, 1, r); hx.v += ((H.i < 0 ? 0 : H.i ? 0.5 : -0.5) - hx.v) * 0.04; b.lerp(RL, sstep(0.25, 0.6, r)); b.x += hx.v * sstep(0.9, 1, r) + sw * 0.7 }
    if (E.room < 0) { E.cur.a.copy(a); E.cur.b.copy(b) } else enterCam(a, b, t)
    const roll = red ? 0 : bell(0.68, 0.78, 0.9, p) * 0.12
    camera.up.set(Math.sin(roll), Math.cos(roll), 0)
    camera.position.copy(a); camera.lookAt(b)
    const dir = dirV.copy(b).sub(a).normalize(), into = sstep(0.58, 0.72, p), d = a.length() * (1 - into) + (2.2 + 4 * sstep(0.88, 1, p)) * into
    FOCUS.copy(a).addScaledVector(dir, d)
    if (r > 0) FOCUS.lerp(RL, sstep(0.25, 0.6, r))
    if (E.room >= 0) FOCUS.copy(EF)
    const fv = 38 + 16 * E.fov; const pc = camera as THREE.PerspectiveCamera; if (Math.abs(pc.fov - fv) > 0.01) { pc.fov = fv; pc.updateProjectionMatrix() }
    const fog = scene.fog as THREE.FogExp2 | null
    if (fog) fog.density = (0.035 + 0.2 * bell(0.68, 0.82, 0.95, p)) * (1 - 0.6 * sstep(0.3, 0.7, r)) + E.dark * 0.6
  })
  return null
}