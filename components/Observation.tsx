'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { P, H } from '../lib/progress'
import { E } from '../lib/enter'
import { AUDIO } from '../lib/audio'
import { LABELS } from '../lib/labels'

// "The system is observing you." States: OBSERVATION_INACTIVE · OBSERVATION_ACTIVE · ROOM_HOVER · ROOM_SELECTED. It only ever acts in the brain phase; it reacts rarely,
// after a variable delay, and only when the cursor lingers over the specimen. A tiny marker drifts toward the cursor, locks on, a hairline connects it to the nearest
// anatomical marker, a short indicator appears, then it lets go. Room reactions live in RoomWorlds / Tombstone / audio (hover).
type Obs = 'OBSERVATION_INACTIVE' | 'OBSERVATION_ACTIVE' | 'ROOM_HOVER' | 'ROOM_SELECTED'
export default function Observation() {
  const mark = useRef<HTMLDivElement>(null), tag = useRef<HTMLParagraphElement>(null), ln = useRef<SVGLineElement>(null)
  useEffect(() => {
    const m = { x: innerWidth / 2, y: innerHeight / 2 }, s = { dwell: 0, active: false, t0: 0, until: 0, cool: 0, delay: -1, lx: 0, ly: 0, op: 0 }
    const mv = (e: PointerEvent) => { m.x = e.clientX; m.y = e.clientY }; addEventListener('pointermove', mv, { passive: true })
    let last = performance.now()
    const fn = () => {
      const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000), t = now / 1000; last = now
      const state: Obs = E.room >= 0 ? 'ROOM_SELECTED' : H.i >= 0 ? 'ROOM_HOVER' : s.active ? 'OBSERVATION_ACTIVE' : 'OBSERVATION_INACTIVE'
      const allowed = state !== 'ROOM_SELECTED' && state !== 'ROOM_HOVER' && !E.booked && P.value > 0.03 && P.value < 0.4 && P.r < 0.001
      const inside = Math.hypot(m.x - innerWidth / 2, m.y - innerHeight * 0.45) < innerHeight * 0.3
      if (allowed && inside) {
        s.dwell += dt
        if (!s.active && t > s.cool && s.dwell > 1.8) { if (s.delay < 0) s.delay = t + 0.2 + Math.random() * 1.4; if (t > s.delay) { s.active = true; s.t0 = t; s.until = t + 2.4 + Math.random() * 1.2; s.cool = t + 14 + Math.random() * 8; s.lx = m.x + 60; s.ly = m.y + 40; if (tag.current) tag.current.textContent = Math.random() > 0.5 ? 'Observation active' : 'Tracking active'; AUDIO.blip() } }
      } else { s.dwell = 0; s.delay = -1; if (s.active) s.until = Math.min(s.until, t + 0.15) }
      if (s.active && t > s.until) s.active = false
      s.op += ((s.active ? 1 : 0) - s.op) * Math.min(1, dt * (s.active ? 3 : 6))
      if (s.op < 0.01) { if (mark.current && mark.current.style.opacity !== '0') { mark.current.style.opacity = '0'; if (tag.current) tag.current.style.opacity = '0'; if (ln.current) ln.current.style.opacity = '0' } return }
      const k = 0.8 + 2.5 * Math.min(1, Math.max(0, (t - s.t0) / 1.2)); s.lx += (m.x - s.lx) * Math.min(1, dt * k); s.ly += (m.y - s.ly) * Math.min(1, dt * k)
      if (mark.current) { mark.current.style.opacity = String(0.8 * s.op); mark.current.style.transform = `translate(${s.lx - 6}px,${s.ly - 6}px)` }
      if (tag.current) { tag.current.style.opacity = String(0.7 * s.op); tag.current.style.transform = `translate(${s.lx + 12}px,${s.ly - 4}px)` }
      let best: DOMRect | null = null, bd = 1e9
      for (let i = 0; i < LABELS.length; i++) { const el = document.getElementById('lbl-' + i); if (!el || parseFloat(el.style.opacity || '0') < 0.2) continue; const r = el.getBoundingClientRect(), d = Math.hypot(r.left - s.lx, r.top - s.ly); if (d < bd) { bd = d; best = r } }
      if (ln.current) { if (best) { ln.current.setAttribute('x1', String(best.left)); ln.current.setAttribute('y1', String(best.top)); ln.current.setAttribute('x2', String(s.lx)); ln.current.setAttribute('y2', String(s.ly)); ln.current.style.opacity = String(0.25 * s.op) } else ln.current.style.opacity = '0' }
    }
    gsap.ticker.add(fn); return () => { gsap.ticker.remove(fn); removeEventListener('pointermove', mv) }
  }, [])
  return (
    <div className="pointer-events-none fixed inset-0 z-[27]" aria-hidden>
      <svg className="absolute inset-0 h-full w-full" stroke="#e9e4dc" strokeWidth="1"><line ref={ln} style={{ opacity: 0 }} /></svg>
      <div ref={mark} className="absolute left-0 top-0 h-3 w-3 border border-bone/70 opacity-0"><i className="absolute left-1/2 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone" /></div>
      <p ref={tag} className="absolute left-0 top-0 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.3em] text-bone opacity-0" />
    </div>
  )
}
