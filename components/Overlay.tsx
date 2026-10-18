'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { P, LENIS } from '../lib/progress'
import { clamp, sstep } from '../lib/math'
import { overlay } from '../lib/content'

const SIZE = { xl: 'text-[clamp(3.6rem,14vw,15rem)] leading-[0.86]', lg: 'text-[clamp(2.6rem,8vw,8rem)] leading-[0.92]', md: 'text-[clamp(1.6rem,3.6vw,3.6rem)] leading-[1.05]', sm: 'text-[clamp(1.1rem,1.7vw,1.7rem)] leading-[1.15]', xs: 'font-mono !not-italic !font-normal !tracking-[0.4em] text-[10px] uppercase leading-[2.2]' }
const ease = (x: number) => 1 - Math.pow(1 - x, 3)

const go = (f: number) => LENIS.inst?.scrollTo(f * (document.documentElement.scrollHeight - innerHeight))
export default function Overlay({ ready }: { ready: boolean }) {
  const credit = useRef<HTMLParagraphElement>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const head = useRef<HTMLElement>(null), nav = useRef<HTMLElement>(null), bar = useRef<HTMLDivElement>(null)
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
      if (head.current) head.current.style.opacity = String(sstep(0.08, 0.16, p))
      if (nav.current) nav.current.style.opacity = String(sstep(0.9, 0.97, p))
      if (credit.current) credit.current.style.opacity = String(sstep(0.9, 1, P.r))
      if (bar.current) bar.current.style.transform = `scaleY(${p})`
    }
    gsap.ticker.add(fn); return () => gsap.ticker.remove(fn)
  }, [])
  return (
    <div className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-[2000ms] delay-[1200ms]" style={{ opacity: ready ? 1 : 0 }}>
      <header ref={head} style={{ opacity: 0 }} className="absolute left-0 right-0 top-0 flex items-start justify-between px-[3.5vw] pt-6 font-mono text-[10px] uppercase tracking-[0.5em] text-bone/80">
        <a href="#top" className="pointer-events-auto" data-magnetic>Amygdread</a>
        <nav ref={nav} className="pointer-events-auto flex gap-8 opacity-0"><button data-magnetic onClick={() => go(1)}>Rooms</button></nav>
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
      <p ref={credit} style={{ opacity: 0 }} className="site-credit absolute bottom-3 left-[3.5vw] max-w-[60ch] font-mono text-[8px] uppercase leading-relaxed tracking-[0.2em] text-bone/30">© Amygdread · Brain model brain.glb, github.com/itayinbarr/brainproject, CC BY-SA 4.0, modified</p>
      <div className="absolute bottom-0 right-[2vw] top-0 hidden w-px bg-bone/10 md:block"><div ref={bar} className="h-full origin-top bg-blood" style={{ transform: 'scaleY(0)' }} /></div>
    </div>
  )
}