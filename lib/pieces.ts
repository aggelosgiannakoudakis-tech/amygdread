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

type ClassifiedItem = { mesh: THREE.Mesh; layer: Layer; c: THREE.Vector3 }

// Builds the exact same piece data as before (same classification, same bounding-box math, same
// placement formulas) but lets the caller spread the work across many small time-budgeted steps
// instead of doing it all in one blocking burst. The one-time setup for ~436 meshes was previously a
// single ~10 second uninterrupted task — confirmed via Lighthouse as the single biggest cost on phone.
// Running it in small timed chunks keeps every individual task short, which is what eliminates the
// "frozen tab" feeling and lowers Total Blocking Time, while producing pixel-identical results since
// the math itself never changes, only its pacing.
export class PieceBuilder {
  private raw: THREE.Mesh[] = []
  private classified: ClassifiedItem[] = []
  private core = new THREE.Box3()
  private center = new THREE.Vector3()
  private size = 1
  private phase: 'collect' | 'place' | 'done' = 'collect'
  private idx = 0
  pieces: Piece[] = []

  constructor(root: THREE.Object3D) {
    root.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh) this.raw.push(mesh) })
  }

  get done() { return this.phase === 'done' }

  // Does as much work as fits in `budgetMs` milliseconds, then returns. Call this repeatedly
  // (e.g. once per rendered frame) until it returns true.
  step(budgetMs: number): boolean {
    const start = performance.now()
    while (performance.now() - start < budgetMs) {
      if (this.phase === 'collect') {
        if (this.idx >= this.raw.length) {
          this.core.getCenter(this.center)
          this.size = Math.max(...this.core.getSize(new THREE.Vector3()).toArray())
          this.phase = 'place'; this.idx = 0
          continue
        }
        const mesh = this.raw[this.idx]; this.idx++
        const mm = mesh.material as THREE.Material
        const mat = ((mm?.userData?.name ?? mm?.name) ?? '') as string
        const layer = classify(((mesh.userData.name ?? mesh.name) ?? '') as string, mat)
        if (layer === 'hidden') { mesh.visible = false; continue }
        const g = mesh.geometry
        if (!g.attributes.normal) g.computeVertexNormals()
        g.computeBoundingBox()
        const box = g.boundingBox!
        const c = box.getCenter(new THREE.Vector3())
        if (layer === 'cortex' || layer === 'cerebellum' || layer === 'tract' || layer === 'deep') this.core.union(box)
        this.classified.push({ mesh, layer, c })
        continue
      }
      if (this.phase === 'place') {
        if (this.idx >= this.classified.length) { this.phase = 'done'; return true }
        const { mesh, layer, c } = this.classified[this.idx]; this.idx++
        const size = this.size, center = this.center
        const rad = mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).length() / size
        mesh.geometry.translate(-c.x, -c.y, -c.z); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox()
        // Pad the culling sphere generously (invisible, only affects the frustum-cull test below,
        // never rendering) so a piece never gets culled until it's comfortably off-screen — avoids
        // any risk of a visible "pop" at the frustum edge while still letting pieces that have
        // genuinely flown far out of view get skipped by the GPU.
        mesh.geometry.boundingSphere!.radius *= 2
        mesh.position.copy(c); mesh.matrixAutoUpdate = true
        const k = mesh.name
        const h = hash(k, 1), h2 = hash(k, 2), h3 = hash(k, 3), h4 = hash(k, 4), h5 = hash(k, 5), h6 = hash(k, 6)
        const rel = c.clone().sub(center)
        const dir = new THREE.Vector3(rel.x, rel.y, rel.z * 0.2)
        if (Math.hypot(dir.x, dir.y) < size * 0.06) { dir.x = (h > 0.5 ? 1 : -1) * size * 0.1; dir.y = (h2 - 0.3) * size * 0.1 }
        if (layer === 'cerebellum') dir.set(rel.x * 0.6, -size * 0.7, rel.z * 0.4)
        dir.add(new THREE.Vector3(h3 - 0.5, h4 - 0.5, (h5 - 0.5) * 0.3).multiplyScalar(size * 0.3)); if (dir.z > 0) dir.z *= 0.4; dir.normalize()
        let dist = 0, start2 = 0.4
        const late = (1 - Math.min(1, rad * 4)) * 0.1
        switch (layer) {
          case 'cortex': dist = 0.2 + 0.4 * h2; start2 = (h < 0.06 ? 0.34 : 0.42 + 0.18 * h2) + late; break
          case 'cerebellum': dist = 0.35 + 0.25 * h2; start2 = 0.44 + 0.1 * h + late; break
          case 'tract': dist = 0.15 + 0.3 * h2; start2 = 0.5 + 0.1 * h; break
          case 'deep': dist = 0.08 + 0.2 * h2; start2 = 0.55 + 0.08 * h; break
          case 'amygdala': dist = 0.06; start2 = 0.6; break
          case 'vessel': dist = 0.15 + 0.4 * h2; start2 = 0.4 + 0.2 * h; break
          case 'nerve': dist = 0.2 + 0.5 * h2; start2 = 0.42 + 0.2 * h; break
        }
        if (h6 < 0.3 || rad < 0.09) dist *= 0.2
        let d = dist * size * 0.75, dur = 0.3 + 0.15 * h3
        const rxy = Math.hypot(rel.x, rel.y), dxy = Math.max(0.35, Math.hypot(dir.x, dir.y)), R = 0.38 * size
        if (rxy < R) { d = Math.min(0.9 * size, Math.max(d, (R - rxy) / dxy)); start2 = Math.min(start2, 0.38 + 0.12 * h); dur = 0.22 }
        const sp = (layer === 'deep' ? 0.4 : layer === 'vessel' || layer === 'nerve' ? 1.0 : 0.7) * 0.6
        this.pieces.push({ mesh, layer, home: c.clone(), dir, dist: d, start: start2, dur, spin: new THREE.Vector3((h4 - 0.5) * 2.4 * sp, (h5 - 0.5) * 2.4 * sp, (h6 - 0.5) * 2.4 * sp), tremble: size * 0.003, h })
        continue
      }
      return true
    }
    return this.phase === 'done'
  }

  result() { return { pieces: this.pieces, center: this.center, size: this.size } }
}

// One-shot version kept for compatibility: identical output to PieceBuilder, just computed all at once
// instead of spread across frames. Not used by BrainModel anymore, kept in case anything else imports it.
export function buildPieces(root: THREE.Object3D) {
  const b = new PieceBuilder(root)
  while (!b.step(1e9)) {}
  return b.result()
}