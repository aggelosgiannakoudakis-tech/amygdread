import * as THREE from 'three'
import { hash } from './math'
export type Layer = 'cortex' | 'cerebellum' | 'deep' | 'tract' | 'vessel' | 'nerve' | 'amygdala' | 'hidden'
export interface Piece { mesh: THREE.Mesh; layer: Layer; home: THREE.Vector3; dir: THREE.Vector3; dist: number; start: number; dur: number; spin: THREE.Vector3; tremble: number; h: number }

export function classify(name: string, mat: string): Layer {
  const n = name.toLowerCase().replace(/_/g, ' '), m = mat.toLowerCase().replace(/_/g, ' ')
  if (m.startsWith('bone') || m === 'cartilage' || /tentorium|falx|dura/.test(n)) return 'hidden'
  if (/amygdal/.test(n)) return 'amygdala'
  if (m === 'artery' || /arter|sinus|vein|plexus|vessel/.test(n)) return 'vessel'
  if (m === 'nerve' || /nerve/.test(n)) return 'nerve'
  if (m === 'cerebellum' || /cerebell|vermis|flocculus|tonsil|medulla oblongata|\bpons\b|peduncle|colliculus/.test(n)) return 'cerebellum'
  if (m.startsWith('nucleus') || /nucle|^hippocamp|thalam|hypothal|putamen|pallid|caudate|ventric|mammillary|pituit|pineal|septum|claustr|substantia/.test(n)) return 'deep'
  if (m === 'white matter' || /tract|radiation|fasciculus|commissure|capsule|callos|fornix|cingulum|lemniscus|corona/.test(n)) return 'tract'
  return 'cortex'
}

// Recenters every mesh on its own pivot (so it can rotate in place) and assigns a deterministic
// separation recipe. The corridor the camera flies through is the local Z axis, so pieces spread radially from it.
export function buildPieces(root: THREE.Object3D) {
  const items: { mesh: THREE.Mesh; layer: Layer; c: THREE.Vector3 }[] = []
  const core = new THREE.Box3()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mm = mesh.material as THREE.Material
    const mat = ((mm?.userData?.name ?? mm?.name) ?? '') as string
    const layer = classify(((mesh.userData.name ?? mesh.name) ?? '') as string, mat) // GLTFLoader sanitises names; the original is in userData.name
    if (layer === 'hidden') { mesh.visible = false; return }
    const g = mesh.geometry
    if (!g.attributes.normal) g.computeVertexNormals()
    g.computeBoundingBox()
    const box = g.boundingBox!
    const c = box.getCenter(new THREE.Vector3())
    if (layer === 'cortex' || layer === 'cerebellum' || layer === 'tract' || layer === 'deep') core.union(box)
    items.push({ mesh, layer, c })
  })
  const center = core.getCenter(new THREE.Vector3())
  const size = Math.max(...core.getSize(new THREE.Vector3()).toArray())
  const pieces: Piece[] = items.map(({ mesh, layer, c }) => {
    const rad = mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).length() / size
    mesh.geometry.translate(-c.x, -c.y, -c.z); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox()
    mesh.position.copy(c); mesh.matrixAutoUpdate = true
    const k = mesh.name
    const h = hash(k, 1), h2 = hash(k, 2), h3 = hash(k, 3), h4 = hash(k, 4), h5 = hash(k, 5), h6 = hash(k, 6)
    const rel = c.clone().sub(center)
    const dir = new THREE.Vector3(rel.x, rel.y, rel.z * 0.2)
    if (Math.hypot(dir.x, dir.y) < size * 0.06) { dir.x = (h > 0.5 ? 1 : -1) * size * 0.1; dir.y = (h2 - 0.3) * size * 0.1 }
    if (layer === 'cerebellum') dir.set(rel.x * 0.6, -size * 0.7, rel.z * 0.4)
    dir.add(new THREE.Vector3(h3 - 0.5, h4 - 0.5, (h5 - 0.5) * 0.3).multiplyScalar(size * 0.3)); if (dir.z > 0) dir.z *= 0.4; dir.normalize() // little motion toward the camera
    let dist = 0, start = 0.4
    const late = (1 - Math.min(1, rad * 4)) * 0.1 // large masses let go first, small ones later
    switch (layer) {
      case 'cortex': dist = 0.2 + 0.4 * h2; start = (h < 0.06 ? 0.34 : 0.42 + 0.18 * h2) + late; break
      case 'cerebellum': dist = 0.35 + 0.25 * h2; start = 0.44 + 0.1 * h + late; break
      case 'tract': dist = 0.15 + 0.3 * h2; start = 0.5 + 0.1 * h; break
      case 'deep': dist = 0.08 + 0.2 * h2; start = 0.55 + 0.08 * h; break
      case 'amygdala': dist = 0.06; start = 0.6; break
      case 'vessel': dist = 0.15 + 0.4 * h2; start = 0.4 + 0.2 * h; break
      case 'nerve': dist = 0.2 + 0.5 * h2; start = 0.42 + 0.2 * h; break
    }
    if (h6 < 0.3 || rad < 0.09) dist *= 0.2 // some pieces barely move
    let d = dist * size * 0.75, dur = 0.3 + 0.15 * h3
    // keep a clear corridor around the Z axis so the camera never meets raw geometry
    const rxy = Math.hypot(rel.x, rel.y), dxy = Math.max(0.35, Math.hypot(dir.x, dir.y)), R = 0.38 * size
    if (rxy < R) { d = Math.min(0.9 * size, Math.max(d, (R - rxy) / dxy)); start = Math.min(start, 0.38 + 0.12 * h); dur = 0.22 }
    const sp = (layer === 'deep' ? 0.4 : layer === 'vessel' || layer === 'nerve' ? 1.0 : 0.7) * 0.6
    return { mesh, layer, home: c.clone(), dir, dist: d, start, dur, spin: new THREE.Vector3((h4 - 0.5) * 2.4 * sp, (h5 - 0.5) * 2.4 * sp, (h6 - 0.5) * 2.4 * sp), tremble: size * 0.003, h }
  })
  return { pieces, center, size }
}
