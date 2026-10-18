'use client'
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { P, S } from '../lib/progress'
import { sstep, clamp, bell } from '../lib/math'
import { LABELS } from '../lib/labels'
import type { Piece } from '../lib/pieces'

// Projects the real mesh centres to screen space each frame and moves the DOM labels (no React state).
export default function LabelDriver() {
  const v = useMemo(() => new THREE.Vector3(), []), w = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => ({ els: [] as (HTMLElement | null)[], cands: [] as Piece[][], pick: [] as number[], pos: [] as { x: number; y: number }[] }), [])
  useFrame(({ camera, size, clock }) => {
    if (!S.pieces.length) return
    const p = P.value
    LABELS.forEach((L, i) => {
      const el = (c.els[i] ??= document.getElementById('lbl-' + i)); if (!el) return
      const win = sstep(L.from, L.from + 0.04, p) * (1 - sstep(L.to - 0.04, L.to, p))
      if (win < 0.003) { if (el.style.opacity !== '0') el.style.opacity = '0'; return }
      const cands = (c.cands[i] ??= S.pieces.filter((pc) => L.re.test((pc.mesh.userData.name ?? pc.mesh.name) as string))); if (!cands.length) return
      let best = -9, bi = 0
      cands.forEach((pc, j) => { pc.mesh.getWorldPosition(v); w.copy(camera.position).sub(v).normalize(); const f = v.normalize().dot(w); if (f > best) { best = f; bi = j } })
      const pc = cands[bi]
      if (L.derive !== undefined) { v.set(0, 0, pc.mesh.geometry.boundingBox!.max.z + L.derive); pc.mesh.localToWorld(v) } else pc.mesh.getWorldPosition(v)
      let a = win * (1 - sstep(0, 0.35, clamp((p - pc.start) / pc.dur)))
      if (L.facing) a *= sstep(0.1, 0.4, best)
      v.project(camera)
      if (v.z > 1 || a < 0.003) { el.style.opacity = '0'; return }
      const tx = (v.x * 0.5 + 0.5) * size.width, ty = (-v.y * 0.5 + 0.5) * size.height, q = (c.pos[i] ??= { x: tx, y: ty }), k = 0.35 - 0.28 * bell(0.3, 0.4, 0.5, p) // labels lag behind as the anatomy destabilises
      q.x += (tx - q.x) * k; q.y += (ty - q.y) * k
      const ins = P.reduced ? 0 : bell(0.28, 0.36, 0.46, p), t = clock.elapsedTime // the tracking system destabilises as the anatomy separates
      el.style.transform = `translate3d(${q.x + Math.sin(t * 9 + i * 3) * 9 * ins}px,${q.y + Math.cos(t * 7 + i * 2) * 7 * ins}px,0)`
      const fl = P.reduced ? 0 : 0.07 * Math.max(0, Math.sin(clock.elapsedTime * 13 + i * 5)) * (Math.sin(clock.elapsedTime * 0.7 + i) > 0.92 ? 1 : 0) // rare tiny data flicker
      el.style.setProperty('--d', String(sstep(0, 0.8, win) * (1 - 0.4 * ins * (0.5 + 0.5 * Math.sin(t * 3 + i))))); el.style.opacity = String(a * (1 - fl))
      const stEl = el.querySelector('[data-status]'); if (stEl) { const tx = p > 0.33 ? L.lost : `Status: active · ${L.tag}`; if (stEl.textContent !== tx) stEl.textContent = tx }
      if (c.pick[i] !== bi) { c.pick[i] = bi; const m = el.querySelector('[data-meta]'); if (m) m.textContent = `${L.approx ? '≈ ' : ''}A-0${i + 1} · XYZ ${(pc.home.x * 1000).toFixed(0)} ${(pc.home.y * 1000).toFixed(0)} ${(pc.home.z * 1000).toFixed(0)}` }
    })
  })
  return null
}
