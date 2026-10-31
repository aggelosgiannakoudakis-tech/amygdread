'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'

// Precision-UI cursor: hairline ring + dot. States: default, interactive (ring grows), room (ring grows + label).
export default function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), label = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (matchMedia('(pointer:coarse)').matches || !dot.current || !ring.current || !label.current) return
    document.documentElement.classList.add('has-cursor')
    const dx = gsap.quickTo(dot.current, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot.current, 'y', { duration: 0.08 })
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.7, ease: 'power3' }), ry = gsap.quickTo(ring.current, 'y', { duration: 0.7, ease: 'power3' })
    let mag: HTMLElement | null = null, state = ''
    const move = (e: PointerEvent) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY)
      const el = e.target as HTMLElement
      const room = el.closest<HTMLElement>('[data-cursor]'), t = el.closest<HTMLElement>('a,button,[data-magnetic]')
      const next = t ? 'link' : room ? 'room' : ''
      if (next !== state) {
        state = next
        gsap.to(ring.current, { scale: next === 'room' ? 3.4 : next === 'link' ? 1.8 : 1, duration: 0.9, ease: 'power3.out' })
        gsap.to(label.current, { opacity: next === 'room' ? 1 : 0, duration: 0.6 }); if (room) label.current!.textContent = room.dataset.cursor ?? ''
        gsap.to(dot.current, { scale: next === 'room' ? 0 : 1, duration: 0.5 })
      }
      // slight enlarge on the magnetic element itself while hovered, in addition to the
      // existing magnetic pull — composes with the x/y tween below via GSAP's own transform
      // management, so it doesn't fight with it.
      if (mag && mag !== t) gsap.to(mag, { x: 0, y: 0, scale: 1, duration: 1, ease: 'power3.out' })
      mag = t?.hasAttribute('data-magnetic') ? t : null
      if (mag) { const r = mag.getBoundingClientRect(); gsap.to(mag, { x: (e.clientX - (r.left + r.width / 2)) * 0.2, y: (e.clientY - (r.top + r.height / 2)) * 0.2, scale: 1.12, duration: 0.6, ease: 'power3.out' }) }
    }
    addEventListener('pointermove', move, { passive: true })
    return () => { removeEventListener('pointermove', move); document.documentElement.classList.remove('has-cursor') }
  }, [])
  return (<>
    <div ref={ring} className="pointer-events-none fixed left-0 top-0 z-[60] -ml-[11px] -mt-[11px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-bone/60 mix-blend-difference"><span ref={label} className="font-mono text-[3px] uppercase tracking-[0.3em] text-bone opacity-0" /></div>
    <div ref={dot} className="pointer-events-none fixed left-0 top-0 z-[60] -ml-[1.5px] -mt-[1.5px] h-[3px] w-[3px] rounded-full bg-bone" />
  </>)
}