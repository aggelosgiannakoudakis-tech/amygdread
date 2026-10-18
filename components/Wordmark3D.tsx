'use client'
import { useRef } from 'react'
import { Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { P, introT } from '../lib/progress'
import { sstep } from '../lib/math'

const rh = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
// Whole word, centred beneath the brain and partly behind it (the brain and its vessels occlude it). Rare, deterministic micro-instability: a sub-second tremor in ~1 of every 3 seven-second epochs.
export default function Wordmark3D() {
  const ref = useRef<any>(null)
  const { size } = useThree()
  const fs = (size.width / size.height) * 0.56
  useFrame(({ clock }) => {
    const m = ref.current; if (!m) return
    const p = P.value, t = clock.elapsedTime, big = sstep(0.1, 0.3, p)
    const ep = Math.floor(t / 7), ph = (t / 7 - ep) * 7, on = rh(ep) > 0.66 && ph > 1 && ph < 1.5, env = P.reduced || !on ? 0 : Math.sin(((ph - 1) / 0.5) * Math.PI)
    const jit = env * (Math.sin(t * 41) * 0.011 + Math.sin(t * 17.3) * 0.006)
    m.fillOpacity = (0.9 - 0.14 * env * Math.abs(Math.sin(t * 29))) * sstep(0.3, 3, introT()) * (1 - sstep(0.2, 0.34, p)); m.visible = m.fillOpacity > 0.004
    m.position.set((P.reduced ? 0 : Math.sin(t * 0.31) * 0.004) + jit, -1.25 + 1 * big, -1.5 - 1.5 * big)
    const ls = 0.1 + env * 0.006 * Math.sin(t * 19); if (Math.abs(ls - (m.letterSpacing ?? 0.1)) > 0.0015) { m.letterSpacing = ls; m.sync?.() }
    m.scale.set((1 + 4 * big) * (1 + 0.006 * env * Math.sin(t * 23)), (1 + 4 * big) * (1 - 0.004 * env), 1)
  })
  return <Text ref={ref} font="/fonts/cg-500.woff" characters="AMYGDREAD" fontSize={fs} anchorX="center" anchorY="middle" letterSpacing={0.1} color="#d8d0c6" material-toneMapped={false} fillOpacity={0}>AMYGDREAD</Text>
}
