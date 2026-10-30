'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { P, S } from '../lib/progress'
import { sstep, bell } from '../lib/math'
import { PieceBuilder, Piece, Layer } from '../lib/pieces'
import { organic } from '../lib/materials'

const TARGET = 2.6 // world-space size of the brain
const mk = (o: THREE.MeshPhysicalMaterialParameters) => organic(new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, roughness: 0.66, clearcoat: 0.1, clearcoatRoughness: 0.5, specularIntensity: 0.45, sheen: 0.2, ...o }))
function makeMaterials() {
  const cortex = [0, 1, 2, 3].map((i) => mk({ color: new THREE.Color('#977872').offsetHSL(0, 0, (i - 1.5) * 0.006), sheenColor: new THREE.Color('#a8837b'), sheenRoughness: 0.7 }))
  const sulcus = mk({ color: '#86665f', sheenColor: new THREE.Color('#8f6b64'), sheenRoughness: 0.8 })
  const m: Record<Exclude<Layer, 'hidden' | 'cortex'>, THREE.Material> = {
    cerebellum: mk({ color: '#8a6c64', roughness: 0.74 }),
    deep: mk({ color: '#836a63', roughness: 0.55, clearcoat: 0.2 }),
    tract: mk({ color: '#b5a899', roughness: 0.7 }),
    vessel: mk({ color: '#5a1520', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 }),
    nerve: mk({ color: '#b8ad90', roughness: 0.65 }),
    amygdala: mk({ color: '#8a5650', roughness: 0.6 }),
  }
  return { cortex, sulcus, m }
}

type Rig = { pieces: Piece[]; center: THREE.Vector3; size: number }

export default function BrainModel({ onReady }: { onReady: () => void }) {
  const { scene: gltfScene } = useGLTF('/models/brain.glb', '/draco/')
  const { gl, scene: canvasScene } = useThree()
  const group = useRef<THREE.Group>(null)
  const smooth = useRef({ x: 0, y: 0 })
  const mats = useMemo(makeMaterials, [])
  const [rig, setRig] = useState<Rig | null>(null)
  const builder = useRef<PieceBuilder | null>(null)
  const warmed = useRef(false)
  const warmed2 = useRef(false)

  useEffect(() => { builder.current = new PieceBuilder(gltfScene); setRig(null) }, [gltfScene])

  useFrame(() => {
    const b = builder.current
    if (!b || b.done) return
    if (b.step(6)) {
      const { pieces, center, size } = b.result()
      const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
      if (coarse) pieces.forEach((p) => { if (p.layer === 'nerve') p.mesh.visible = false })
      pieces.forEach((p) => { p.mesh.material = p.layer === 'cortex' ? (/sulc/i.test((p.mesh.userData.name ?? p.mesh.name) as string) ? mats.sulcus : mats.cortex[Math.floor(p.h * 4) % 4]) : mats.m[p.layer as keyof typeof mats.m]; p.mesh.frustumCulled = false })
      setRig({ pieces, center, size })
    }
  })

  // Dual-pass predictive warmup: compiles both the opaque AND transparent shader
  // variant of every material in the real canvas scene, ahead of when they're
  // actually needed. Uses compileAsync (NOT compile) deliberately - the sync
  // gl.compile() forces the driver to finish + link-check every program
  // immediately, blocking the main thread for the whole pass (this itself was
  // measured as a ~450ms Long Task when WARMUP2 fired near Threat Response).
  // compileAsync uses the parallel-shader-compile path and does not block the
  // same way, while still warming the same two shader variants.
  const compileBoth = async (tag: string) => {
    const warmCam = new THREE.PerspectiveCamera(175, 1, 0.001, 10000)
    warmCam.position.set(0, 0, 25)
    warmCam.lookAt(0, 0, 0)
    warmCam.updateMatrixWorld()

    const visMap = new Map<THREE.Object3D, boolean>()
    canvasScene.traverse((o) => {
      visMap.set(o, o.visible)
      o.visible = true
    })

    const allBrainMats = [...mats.cortex, mats.sulcus, ...Object.values(mats.m)] as any[]
    const snap = allBrainMats.map((m) => ({ transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite }))

    try {
      await gl.compileAsync(canvasScene, warmCam) // opaque variant
      allBrainMats.forEach((m) => { m.transparent = true; m.needsUpdate = true })
      await gl.compileAsync(canvasScene, warmCam) // transparent variant
    } catch {
      // ignore
    }

    allBrainMats.forEach((m, i) => {
      m.transparent = snap[i].transparent
      m.opacity = snap[i].opacity
      m.depthWrite = snap[i].depthWrite
      m.needsUpdate = true
    })

    canvasScene.traverse((o) => {
      if (visMap.has(o)) o.visible = visMap.get(o)!
    })

    console.log(`[${tag}] programs after compile:`, (gl.info as any)?.programs?.length)
  }

  useEffect(() => {
    if (!rig) return
    S.pieces = rig.pieces
    S.norm = { c: rig.center, s: TARGET / rig.size }
    if (warmed.current) { onReady(); return }
    warmed.current = true
    compileBoth('WARMUP DONE')
    onReady()
  }, [rig, onReady, gl, canvasScene, mats])

  // Second, predictive re-warm: refires the same dual-variant compile much closer to
  // the moment it's actually needed (the brain-return fade near the Threat Response
  // zone), since the very-early page-load warmup appears to not "stick" long enough.
  // This fires once, well before P.r actually starts moving.
  useFrame(() => {
    if (warmed2.current || !rig || !warmed.current) return
    if (P.value > 0.78) {
      warmed2.current = true
      compileBoth('WARMUP2 DONE')
    }
  })

  useEffect(() => () => { mats.cortex.forEach((m) => m.dispose()); mats.sulcus.dispose(); Object.values(mats.m).forEach((m) => m.dispose()) }, [mats])

  const allMats = useMemo(() => [...mats.cortex, mats.sulcus, ...Object.values(mats.m)] as THREE.Material[], [mats]), lastFade = useRef(1)
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const tmp = useMemo(() => new THREE.Vector3(), []), fd = useMemo(() => new THREE.Vector3(), []), wp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const g = group.current; if (!g || !rig) return
    g.visible = P.r < 0.12; if (!g.visible) { S.remaining = 0; return }
    const fade = 1 - sstep(0, 0.1, P.r); if (Math.abs(fade - lastFade.current) > 0.002) { lastFade.current = fade; allMats.forEach((m) => { m.transparent = fade < 0.999; m.opacity = fade; m.depthWrite = fade >= 0.999 }); console.log('[FADE FLIP]', performance.now().toFixed(0) + 'ms', 'fade=', fade.toFixed(3)) }
    const p = P.value, t = state.clock.elapsedTime, red = P.reduced
    if (p > 0.6) { let n = 0; state.camera.getWorldDirection(fd); for (const pc of rig.pieces) { pc.mesh.getWorldPosition(wp); wp.sub(state.camera.position); const d = wp.length(); if (d < 12 && d > 0.05 && wp.dot(fd) / d > 0.35) n++ } S.remaining += (n / rig.pieces.length - S.remaining) * 0.15 } else S.remaining = 1
    smooth.current.x += (P.mx - smooth.current.x) * 0.04; smooth.current.y += (P.my - smooth.current.y) * 0.04
    const settle = sstep(0.3, 0.6, p), live = 1 - settle
    g.rotation.y = (0.4 - 0.25 * p + (red ? 0 : Math.sin(t * 0.05) * 0.05 + smooth.current.x * 0.03)) * live
    g.rotation.x = (red ? 0 : smooth.current.y * 0.03) * live
    g.position.y = 0.22 * live
    g.scale.setScalar(1 + 0.12 * sstep(0.1, 0.5, p))
    const tremAmp = red ? 0 : bell(0.15, 0.28, 0.46, p)
    for (const pc of rig.pieces) {
      const u = Math.min(1, Math.max(0, (p - pc.start) / pc.dur))
      const ease = u * u * u * (u * (6 * u - 15) + 10)
      const drift = Math.max(0, p - pc.start - pc.dur) * 0.5
      tmp.copy(pc.dir).multiplyScalar(pc.dist * (ease + drift)).add(pc.home)
      if (!red) {
        const pre = sstep(pc.start - 0.1, pc.start, p) * (1 - sstep(pc.start, pc.start + 0.02, p))
        const a = pc.tremble * (tremAmp * 0.5 + pre * 1.5)
        if (a > 0) tmp.set(tmp.x + Math.sin(t * 38 + pc.h * 40) * a, tmp.y + Math.sin(t * 41 + pc.h * 70) * a, tmp.z + Math.sin(t * 35 + pc.h * 90) * a)
      }
      pc.mesh.position.copy(tmp)
      const sp = ease + drift * 0.5
      e.set(pc.spin.x * sp, pc.spin.y * sp, pc.spin.z * sp); q.setFromEuler(e); pc.mesh.quaternion.copy(q)
    }
  })

  if (!rig) return null
  const s = TARGET / rig.size
  return (
    <group ref={group}>
      <group scale={s} position={[-rig.center.x * s, -rig.center.y * s, -rig.center.z * s]}>
        <primitive object={gltfScene} />
      </group>
    </group>
  )
}