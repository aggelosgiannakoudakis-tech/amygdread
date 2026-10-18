'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { sstep } from '../lib/math'
import { warnW, warnB, warnOut, warnArm, warnResidual } from '../lib/warn'

// THREAT RESPONSE DETECTED — typography unchanged. Entry: a thin red trace draws, the text forms with a 96→100% scale-up, fast fade-in and a bright pulse; then irregular
// intensity pulses; a pulse before a quick exit that leaves a tiny residual glow.
export default function ThreatWarning() {
  const root = useRef<HTMLDivElement>(null), text = useRef<HTMLDivElement>(null), glow = useRef<HTMLDivElement>(null), tiny = useRef<HTMLDivElement>(null)
  const r1 = useRef<HTMLDivElement>(null), r2 = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = () => {
      const el = root.current; if (!el) return; const w = warnW(), on = w >= 0 && w < 2.05
      el.style.display = on ? '' : 'none'; if (!on) return
      const B = warnB(w), arm = warnArm(w), out = warnOut(w), entry = sstep(0, 0.05, w)
      if (text.current) { text.current.style.opacity = String(Math.min(1, B) * out * entry); text.current.style.transform = `scale(${0.96 + 0.04 * (1 - Math.pow(1 - sstep(0, 0.12, w), 3))})`; text.current.style.setProperty('--glow', String(0.6 + B * 0.6)) }
      if (r1.current && r2.current) { const sx = sstep(0, 0.08, w); r1.current.style.transform = r2.current.style.transform = `scaleX(${sx})`; r1.current.style.opacity = r2.current.style.opacity = String(out * Math.min(1, B)) }
      if (glow.current) glow.current.style.opacity = String(Math.min(1, 0.32 * B * arm * out + warnResidual(w))) // red light spill + the residual afterglow
      const tn = sstep(0, 0.2, w) * (1 - sstep(1.7, 2, w)); if (tiny.current) tiny.current.style.opacity = String(tn)
    }
    gsap.ticker.add(fn); return () => gsap.ticker.remove(fn)
  }, [])
  return (
    <div ref={root} style={{ display: 'none' }} className="pointer-events-none fixed inset-0 z-[26] font-mono" aria-hidden>
      <div ref={glow} className="absolute inset-0 opacity-0" style={{ background: 'radial-gradient(40% 32% at 50% 50%,rgba(190,15,30,.35),transparent 70%)' }} />
      <div ref={tiny} className="absolute inset-0 text-[9px] uppercase tracking-[0.3em] text-bone/40 opacity-0">
        <p className="absolute bottom-[6vh] left-[4.5vw]">X 0.037 · Y 1.597 · Z 0.016</p>
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div ref={r1} className="mx-auto mb-6 h-px w-[min(46rem,80vw)] origin-center bg-[#b5121f]/70" style={{ transform: 'scaleX(0)' }} />
          <div ref={text} className="opacity-0">
            <p className="text-[clamp(2.2rem,7vw,7.5rem)] uppercase leading-[0.95] tracking-[0.1em] text-[#b5121f] [text-shadow:0_0_calc(18px*var(--glow,1))_rgba(200,20,35,0.5),0_0_2px_rgba(255,70,80,0.6)]">Threat response<br />detected</p>
            <p className="mt-6 text-[10px] uppercase tracking-[0.5em] text-[#9a1520]/80">Amygdala · signal elevated</p>
          </div>
          <div ref={r2} className="mx-auto mt-6 h-px w-[min(46rem,80vw)] origin-center bg-[#b5121f]/70" style={{ transform: 'scaleX(0)' }} />
        </div>
      </div>
    </div>
  )
}