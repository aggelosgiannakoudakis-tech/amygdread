'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { P, LENIS, LOAD } from '../lib/progress'
import { clamp, bell } from '../lib/math'
import Overlay from './Overlay'
import LabelLayer from './LabelLayer'
import CustomCursor from './CustomCursor'
import Booking from './Booking'
import TransitionFX from './TransitionFX'
import ThreatWarning from './ThreatWarning'
import LoadingSequence from './LoadingSequence'
import AudioDirector from './AudioDirector'
import SoundControl from './SoundControl'
import Observation from './Observation'
import ErrorBoundary from './ErrorBoundary'
import { E, leaveRoom } from '../lib/enter'
const BrainScene = dynamic(() => import('./BrainScene'), { ssr: false })

export default function Experience() {
  const timeline = useRef<HTMLDivElement>(null)
    const [started, setStarted] = useState(false), [booking, setBooking] = useState<number | null>(null)
  const onReady = useCallback(() => { LOAD.model = true }, []), onDone = useCallback(() => { P.introStart = performance.now(); setStarted(true); (LENIS.inst as { start?: () => void } | null)?.start?.() }, [])

  useEffect(() => {
    E.setBooking = setBooking
    const pop = () => { if (E.room >= 0) leaveRoom() }, esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && E.room >= 0 && !E.busy) history.state?.room !== undefined ? history.back() : leaveRoom() }
    addEventListener('popstate', pop); addEventListener('keydown', esc)
    return () => { removeEventListener('popstate', pop); removeEventListener('keydown', esc) }
  }, [])
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    P.reduced = reduced
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.08 })
    LENIS.inst = lenis; lenis.stop() // scroll stays locked until the initialization sequence completes
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (_t: number, dtMs: number) => {
      lenis.raf(performance.now())
      const k = reduced ? 1 : 1 - Math.exp(-(dtMs / 1000) * 6)
      P.value += (P.target - P.value) * k; P.r += (P.rTarget - P.r) * k
      document.documentElement.style.setProperty('--tension', String(bell(0.3, 0.5, 0.85, P.value)))
    }
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0)
    const ctx = gsap.context(() => {
      ScrollTrigger.create({ trigger: timeline.current, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { P.target = clamp(s.progress / 0.62); P.rTarget = clamp((s.progress - 0.6) / 0.37) } })
    })
    const move = (e: PointerEvent) => { P.mx = (e.clientX / innerWidth) * 2 - 1; P.my = (e.clientY / innerHeight) * 2 - 1 }
    addEventListener('pointermove', move, { passive: true })
    // Mobile browsers resize the visible viewport as the address bar shows/hides while scrolling, and
    // iOS in particular often does this WITHOUT firing a normal window "resize" event. Lenis/ScrollTrigger
    // calculate the page's total scrollable distance once; if that goes stale, the page can report "end of
    // scroll" before the user has actually reached the real bottom of the content. We correct for this by:
    // 1) listening to the dedicated visualViewport resize event (fires reliably on iOS/Android for this case)
    // 2) forcing a couple of safety re-measurements shortly after load, in case no event fires at all.
    let resizeTimer: ReturnType<typeof setTimeout>
    const refresh = () => { lenis.resize(); ScrollTrigger.refresh() }
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(refresh, 150) }
    addEventListener('resize', onResize); addEventListener('orientationchange', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    const safety1 = setTimeout(refresh, 600), safety2 = setTimeout(refresh, 1800)
    return () => {
      removeEventListener('pointermove', move); removeEventListener('resize', onResize); removeEventListener('orientationchange', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer); clearTimeout(safety1); clearTimeout(safety2)
      gsap.ticker.remove(tick); ctx.revert(); lenis.destroy(); P.target = P.value = P.rTarget = P.r = 0
    }
  }, [])

  return (
    <main>
      <div className="fixed inset-0 z-[2]" style={{ pointerEvents: booking !== null ? 'none' : 'auto' }} aria-label="Interactive 3D human brain">
        <ErrorBoundary>
          <BrainScene onReady={onReady} />
        </ErrorBoundary>
      </div>
      <LabelLayer /><ThreatWarning /><div className="vignette" /><div className="grain" />
      <Overlay ready={started} />
      <div ref={timeline} className="relative z-10 h-[1000vh]" aria-hidden />
      <div id="room-ui" className="pointer-events-none fixed inset-0 z-40" />
      <TransitionFX />
      <Observation /><AudioDirector /><SoundControl /><LoadingSequence onDone={onDone} />
      {booking !== null && <Booking room={booking} onLeave={() => (history.state?.room !== undefined ? history.back() : leaveRoom())} />}
      <CustomCursor />
    </main>
  )
}