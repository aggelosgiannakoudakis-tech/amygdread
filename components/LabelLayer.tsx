import { LABELS } from '../lib/labels'
const L = 112
const sh = '[text-shadow:0_0_8px_#000,0_0_2px_#000]'
// Anatomical annotation DOM (positions are driven imperatively). prefix 'lbl' = on the real brain; 'sl' = reused by the neural scan reconstruction.
export function LabelItems({ prefix, scan }: { prefix: string; scan?: boolean }) {
  return (<>{LABELS.map((l, i) => {
    const th = ((l.side === 'r' ? l.ang : 180 - l.ang) * Math.PI) / 180, ex = Math.cos(th) * L, ey = Math.sin(th) * L
    return (
      <div id={`${prefix}-${i}`} key={i} className="absolute left-0 top-0 opacity-0 will-change-transform">
        <span className={`absolute -left-[2px] -top-[2px] h-[5px] w-[5px] rounded-full [animation:breathe_2.4s_ease-in-out_infinite] ${scan ? 'bg-[#7dffb0]' : 'bg-bone'}`} />
        <span className={`absolute -left-[7px] -top-[7px] h-[14px] w-[14px] rounded-full border ${scan ? 'border-[#7dffb0]/50' : 'border-bone/40'}`} />
        <span className={`absolute left-0 top-0 h-px ${scan ? 'bg-[#7dffb0]/70' : 'bg-bone/60'}`} style={{ width: L, transformOrigin: '0 50%', transform: `rotate(${(th * 180) / Math.PI}deg) scaleX(var(--d,0))` }} />
        <div className={`absolute ${l.side === 'l' ? 'text-right' : ''} ${sh}`} style={{ left: ex, top: ey, transform: `translate(${l.side === 'r' ? '8px' : 'calc(-100% - 8px)'},-50%)` }}>
          <p className={`whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.3em] ${scan ? 'text-[#9dffc4]' : 'text-bone'}`}>{l.text}</p>
          <p className={`mt-0.5 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.2em] ${scan ? 'text-[#7dffb0]/70' : 'text-bone/70'}`}>{l.role}</p>
          <p data-meta className="mt-1 whitespace-nowrap font-mono text-[8px] tracking-[0.2em] text-bone/45" />
          <p data-status className="mt-0.5 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.25em] text-blood">Status: active · {l.tag}</p>
        </div>
      </div>
    )
  })}</>)
}
export default function LabelLayer() { return <div className="pointer-events-none fixed inset-0 z-[26]" aria-hidden><LabelItems prefix="lbl" /></div> }
