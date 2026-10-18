'use client'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { P } from '../lib/progress'
import { warnW, warnArm, warnB } from '../lib/warn'
const RED = new THREE.Color('#ff4050'), BASE = new THREE.Color('#cbbfb5')

export default function Dust({ count = 320 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null), mat = useRef<THREE.PointsMaterial>(null)
  const geo = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) { a[i * 3] = (Math.random() - 0.5) * 14; a[i * 3 + 1] = (Math.random() - 0.5) * 8; a[i * 3 + 2] = 8 - Math.random() * 50 }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return g
  }, [count])
  useFrame(({ clock }) => { const w = warnW(), c = Math.min(1, warnArm(w) * warnB(w)); if (mat.current) { mat.current.opacity = 0.28 + 0.35 * c; mat.current.color.copy(BASE).lerp(RED, c) } if (ref.current && !P.reduced) { ref.current.rotation.y = clock.elapsedTime * 0.008; ref.current.position.y = Math.sin(clock.elapsedTime * 0.1) * 0.15 } })
  return <points ref={ref} geometry={geo}><pointsMaterial ref={mat} size={0.018} sizeAttenuation transparent opacity={0.28} color="#cbbfb5" depthWrite={false} /></points>
}
