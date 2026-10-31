'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { P, LENIS } from '../lib/progress'
import { clamp, sstep } from '../lib/math'
import { overlay } from '../lib/content'

const SIZE = { xl: 'text-[clamp(3.6rem,14vw,15rem)] leading-[0.86]', lg: 'text-[clamp(2.6rem,8vw,8rem)] leading-[0.92]', md: 'text-[clamp(1.6rem,3.6vw,3.6rem)] leading-[1.05]', sm: 'text-[clamp(1.1rem,1.7vw,1.7rem)] leading-[1.15]', xs: 'font-mono !not-italic !font-normal !tracking-[0.4em] text-[10px] uppercase leading-[2.2]' }
const ease = (x: number) => 1 - Math.pow(1 - x, 3)

const go = (f: number) => LENIS.inst?.scrollTo(f * (document.documentElement.scrollHeight - innerHeight))
const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches

export default function Overlay({ ready }: { ready: boolean }) {
  const credit = useRef<HTMLParagraphElement>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const head = useRef<HTMLElement>(null), nav = useRef<HTMLElement>(null), bar = useRef<HTMLDivElement>(null)
  const amygRef = useRef<HTMLAnchorElement>(null)
  const roomsRef = useRef<HTMLButtonElement>(null)
  const cue = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const els = refs.current.map((el) => (el ? Array.from(el.querySelectorAll<HTMLElement>('.inner')) : []))
    const fn = () => {
      const p = P.value
      overlay.forEach((it, i) => {
        const el = refs.current[i]; if (!el) return
        const q = it.r ? P.r : p
        const fin = it.from === 0 ? 1 : sstep(it.from, it.from + 0.035, q), fout = 1 - sstep(it.to - 0.035, it.to, q)
        const o = Math.min(fin, fout)
        el.style.opacity = String(o); el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
        if (o < 0.01) return
        const n = els[i].length
        els[i].forEach((inner, j) => {
          const local = clamp(fin * (1 + 0.4 * (n - 1)) - j * 0.4)
          const y = fout < 1 ? -105 * (1 - fout) : 105 * (1 - ease(local))
          inner.style.transform = `translate3d(0,${y}%,0)`
        })
      })
      if (head.current) head.current.style.opacity = '1'
      if (nav.current) nav.current.style.opacity = '1'
      if (credit.current) credit.current.style.opacity = String(sstep(0.9, 1, P.r))
      if (bar.current) bar.current.style.transform = `scaleY(${p})`
      // Scroll cue: slow opacity breathing loop, fades out as soon as real scrolling begins
      // (before the brain pieces start trembling/shattering), reappears if scrolled back to 0.
      if (cue.current) {
        const t = performance.now() / 1000
        const pulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.6))
        const visible = 1 - sstep(0.02, 0.08, p)
        const o = pulse * visible
        cue.current.style.opacity = String(o)
        cue.current.style.visibility = o < 0.01 ? 'hidden' : 'visible'
      }
    }
    gsap.ticker.add(fn); return () => gsap.ticker.remove(fn)
  }, [])

  // The 3D Canvas (BrainScene.tsx) listens for pointer events via a raw native listener
  // attached directly to document.body, and synthesizes its own "click" from pointerdown/
  // pointerup pairs rather than relying on the browser's native click event. React's own
  // onClick/stopPropagation runs through a separate, higher-level delegated listener that
  // only fires after that raw bubble has already passed through (and been caught by)
  // document.body — too late to stop it. Attaching plain native listeners directly on these
  // two elements intercepts pointerdown/pointerup/click before they ever reach document.body.
  // pointermove is deliberately left alone — blocking it broke CustomCursor's hover/magnetic
  // tracking for these two links. This does not change room click-anywhere behavior anywhere else.
  useEffect(() => {
    const amyg = amygRef.current, rm = roomsRef.current
    if (!amyg || !rm) return
    const stopAll = (e: Event) => e.stopPropagation()
    const onRoomsClick = (e: Event) => { e.stopPropagation(); go(1) }
    const types: (keyof DocumentEventMap)[] = ['pointerdown', 'pointerup', 'click']
    types.forEach((t) => amyg.addEventListener(t, stopAll))
    types.forEach((t) => rm.addEventListener(t, stopAll))
    rm.addEventListener('click', onRoomsClick)
    return () => {
      types.forEach((t) => amyg.removeEventListener(t, stopAll))
      types.forEach((t) => rm.removeEventListener(t, stopAll))
      rm.removeEventListener('click', onRoomsClick)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-[2000ms] delay-[1200ms]" style={{ opacity: ready ? 1 : 0 }}>
      <header ref={head} style={{ opacity: 1 }} className="absolute left-0 right-0 top-0 flex items-start justify-between px-[3.5vw] pt-6 font-mono text-[12px] uppercase tracking-[0.5em] text-bone/80">
        <a ref={amygRef} href="#top" className="pointer-events-auto" data-magnetic>Amygdread</a>
        <nav ref={nav} className="pointer-events-auto flex gap-8" style={{ opacity: 1 }}><button ref={roomsRef} data-magnetic>Rooms</button></nav>
      </header>
      {overlay.map((it, i) => (
        <div key={i} ref={(el) => { refs.current[i] = el }} className={`absolute ${it.pos} ${it.align ?? ''}`} style={{ opacity: 0, visibility: 'hidden' }}>
          {it.kicker && <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.4em] text-bone/50">{it.kicker}</p>}
          {it.lines.map((l, j) => (
            <span key={j} className="block overflow-hidden py-[0.05em] -my-[0.05em]">
              <span className={`inner block font-display font-light italic tracking-[-0.03em] will-change-transform ${SIZE[it.size]} ${it.redFrom !== undefined && j >= it.redFrom ? 'text-blood' : 'text-bone'}`}>{l}</span>
            </span>
          ))}
        </div>
      ))}
      {/* Explicit high z-index: this is an absolutely-positioned sibling of the overlay text
          blocks above (including the big AMYGDREAD wordmark), which otherwise paint over it
          purely due to DOM order since none of these siblings set a z-index. */}
      <div ref={cue} className="pointer-events-none absolute bottom-[16%] left-1/2 flex -translate-x-1/2 flex-col items-center gap-4" style={{ opacity: 0, visibility: 'hidden', zIndex: 50 }}>
        <svg width="26" height="40" viewBox="0 0 14 22" fill="none" className={coarse ? 'rotate-180' : ''} style={{ color: '#7dd3fc', filter: 'drop-shadow(0 0 6px rgba(125,211,252,0.7))' }}>
          <path d="M7 0V20M7 20L1 14M7 20L13 14" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.5em] text-bone" style={{ textShadow: '0 0 10px rgba(255,255,255,0.4)' }}>{coarse ? 'Swipe Up' : 'Scroll Down'}</p>
      </div>
      <p ref={credit} style={{ opacity: 0 }} className="site-credit absolute bottom-3 left-[3.5vw] max-w-[60ch] font-mono text-[8px] uppercase leading-relaxed tracking-[0.2em] text-bone/30">© Amygdread · Brain model brain.glb, github.com/itayinbarr/brainproject, CC BY-SA 4.0, modified</p>
      <div className="absolute bottom-0 right-[2vw] top-0 hidden w-px bg-bone/10 md:block"><div ref={bar} className="h-full origin-top bg-blood" style={{ transform: 'scaleY(0)' }} /></div>
    </div>
  )
}