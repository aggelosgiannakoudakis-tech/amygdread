'use client'
import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import gsap from 'gsap'
import { LOAD, S, SPEC } from '../lib/progress'
import { AUDIO } from '../lib/audio'

const LINES = [{ t: 'Initializing optics', ok: 'OK', f: () => LOAD.canvas }, { t: 'Anatomical data', ok: 'OK', f: () => LOAD.model, prog: true }, { t: 'Specimen', ok: 'FOUND', f: () => LOAD.model && S.pieces.length > 0 }, { t: 'Environment', ok: 'READY', f: () => SPEC.v > 0 }]

export default function LoadingSequence({ onDone }: { onDone: () => void }) {
  const { progress } = useProgress(), pr = useRef(0), root = useRef<HTMLDivElement>(null), rows = useRef<(HTMLDivElement | null)[]>([]), val = useRef<(HTMLSpanElement | null)[]>([]), mark = useRef<HTMLParagraphElement>(null)
  const [gone, setGone] = useState(false)
  const smooth = useRef(0)
  pr.current = progress

  useEffect(() => {
    const st = { rev: [] as number[], done: [] as number[], fin: 0, modelT: 0, over: false }, t0 = performance.now() / 1000
    const fn = () => {
      const t = performance.now() / 1000; if (st.over) return
      if (LOAD.model && !st.modelT) st.modelT = t

      // synthetic ramp: guarantees visible movement even if real progress jumps in big steps
      const synthetic = Math.min(96, (t - t0) * 35)
      const target = LOAD.model ? 100 : Math.max(pr.current, synthetic)
      smooth.current += (target - smooth.current) * 0.08
      if (LOAD.model && smooth.current > 98) smooth.current = 100

      LINES.forEach((l, i) => {
        const el = rows.current[i], v = val.current[i]; if (!el || !v) return
        if (st.rev[i] === undefined && (i === 0 ? t - t0 > 0.35 : st.done[i - 1] !== undefined && t - st.done[i - 1] > 0.15)) { st.rev[i] = t; AUDIO.relay() }
        if (st.rev[i] === undefined) return; el.style.opacity = '1'
        const timeout = i === 3 && st.modelT && t - st.modelT > 8
        if (st.done[i] === undefined && (l.f() || timeout) && t - st.rev[i] > 0.3) { st.done[i] = t; AUDIO.relay() }
        v.textContent = st.done[i] !== undefined ? l.ok : l.prog ? `${Math.round(smooth.current)}%` : '…'
      })

      if (st.done.length === LINES.length && st.done.every((d) => d !== undefined) && !st.fin) {
        st.fin = t; if (mark.current) { mark.current.style.opacity = '1'; mark.current.style.letterSpacing = '0.7em' }
        gsap.delayedCall(0.8, () => { st.over = true; onDone(); gsap.to(root.current, { opacity: 0, duration: 1.2, ease: 'power2.inOut', onComplete: () => setGone(true) }) })
      }
    }
    gsap.ticker.add(fn); return () => gsap.ticker.remove(fn)
  }, [onDone])

  if (gone) return null
  return (
    <div ref={root} className="fixed inset-0 z-[70] grid place-items-center bg-black font-mono">
      <div className="w-[min(24rem,84vw)] text-[10px] uppercase leading-[2.4] tracking-[0.3em] text-bone/60">
        <p ref={mark} className="mb-8 font-display text-[22px] font-medium normal-case tracking-[0.5em] text-bone/70 transition-all duration-[900ms]" style={{ opacity: 0.55 }}>AMYGDREAD</p>
        {LINES.map((l, i) => (<div key={l.t} ref={(e) => { rows.current[i] = e }} className="flex items-baseline gap-3 opacity-0 transition-opacity duration-500"><span>{l.t}</span><i className="mb-[3px] flex-1 border-b border-dotted border-bone/20" /><span ref={(e) => { val.current[i] = e }} className="text-bone" /></div>))}
      </div>
    </div>
  )
}