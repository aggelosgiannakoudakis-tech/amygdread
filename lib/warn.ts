import { P, S } from './progress'
import { sstep, bell } from './math'
// One shared alarm timeline for text, waveform, lab lighting and dust. w runs 0→2 from the brain's ACTUAL state (S.remaining: fragments still in front of the camera),
// then room-phase progress. w<0 = inactive. Deterministic, scrubs both ways.
const rh = (n: number) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }
export const warnW = () => { const prog = P.value > 0.85 ? Math.min(1, Math.max(0, (0.3 - S.remaining) / 0.3)) : 0; return prog > 0.001 ? prog + P.r / 0.22 : -1 }
const KF: [number, number][] = [[0, 0], [0.03, 0.5], [0.07, 1.15], [0.11, 0.5], [0.16, 1.1], [0.21, 0.42], [0.26, 1.05], [0.29, 0.7], [0.32, 1.0], [0.4, 0.86]]
// brightness 0..1.3: on → bright → dim → bright → dim → bright → irregular flicker → settle; second small flicker; a pulse before the exit
export function warnB(w: number) {
  if (w < 0) return 0
  if (P.reduced) return w < 0.4 ? 1 : 0.9
  let b = 0.88 + 0.08 * Math.sin(w * 30)
  if (w < 0.4) { let i = 0; while (i < KF.length - 2 && w > KF[i + 1][0]) i++; const [a0, a1] = KF[i], [b0, b1] = KF[i + 1], t = (w - a0) / (b0 - a0); b = a1 + (b1 - a1) * Math.min(1, Math.max(0, t)); b += (rh(Math.floor(w * 220)) - 0.5) * 0.14 * sstep(0.05, 0.1, w) }
  if (w > 1.15 && w < 1.22) b *= rh(Math.floor(w * 160) + 7) > 0.4 ? 1 : 0.35
  return Math.max(0, b + 0.25 * bell(1.5, 1.56, 1.64, w))
}
export const warnOut = (w: number) => 1 - sstep(1.64, 1.86, w)                    // quick fade after the pre-exit pulse
export const warnArm = (w: number) => (w < 0 ? 0 : sstep(0, 0.15, w) * (1 - sstep(1.5, 2, w))) // how far the lab has "woken"
export const warnResidual = (w: number) => 0.25 * sstep(1.7, 1.78, w) * (1 - sstep(1.82, 1.98, w)) // tiny red glow after the text is gone
