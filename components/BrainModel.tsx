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
const mk = (o: THREE.MeshPhysicalMaterialParameters, veins = 1.0) =>
  organic(
    new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide,
      roughness: 0.58,
      clearcoat: 0.38,
      clearcoatRoughness: 0.26,
      ior: 1.4,
      specularIntensity: 0.55,
      specularColor: new THREE.Color('#ffebe8'),
      sheen: 0.45,
      sheenRoughness: 0.5,
      transparent: false,
      depthWrite: true,
      opacity: 1,
      ...o,
    }),
    110,
    0.14,
    veins
  )

function makeMaterials() {
  const cortex = [0, 1, 2, 3].map((i) =>
    mk(
      {
        color: new THREE.Color('#b08279').offsetHSL((i - 1.5) * 0.003, (i - 1.5) * 0.012, (i - 1.5) * 0.008),
        sheenColor: new THREE.Color('#d47a70'),
        sheenRoughness: 0.48,
      },
      1.0
    )
  )
  const sulcus = mk(
    {
      color: '#ab7d74',
      sheenColor: new THREE.Color('#cf746a'),
      sheenRoughness: 0.5,
    },
    1.0
  )
  const m: Record<Exclude<Layer, 'hidden' | 'cortex'>, THREE.Material> = {
    cerebellum: mk({ color: '#9e6e66', roughness: 0.62, sheenColor: new THREE.Color('#c26b62') }, 0.9),
    deep: mk({ color: '#946760', roughness: 0.52, clearcoat: 0.42 }, 0.85),
    tract: mk({ color: '#c7b8a8', roughness: 0.58, clearcoat: 0.22 }, 0.15),
    vessel: mk({ color: '#5e0a14', roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.16, sheenColor: new THREE.Color('#b81828') }, 0.0),
    nerve: mk({ color: '#cfc2a6', roughness: 0.56, clearcoat: 0.2, clearcoatRoughness: 0.35, sheenColor: new THREE.Color('#ede2cc') }, 0.0),
    amygdala: mk({ color: '#964c47', roughness: 0.52, clearcoat: 0.45 }, 1.0),
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
  const warming = useRef(false)

  useEffect(() => { builder.current = new PieceBuilder(gltfScene); setRig(null) }, [gltfScene])

  useFrame(() => {
    const b = builder.current
    if (!b || b.done) return
    if (b.step(6)) {
      const { pieces, center, size } = b.result()
      const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
      if (coarse) pieces.forEach((p) => { if (p.layer === 'nerve') p.mesh.visible = false })
      pieces.forEach((p) => { p.mesh.material = p.layer === 'cortex' ? (/sulc/i.test((p.mesh.userData.name ?? p.mesh.name) as string) ? mats.sulcus : mats.cortex[Math.floor(p.h * 4) % 4]) : mats.m[p.layer as keyof typeof mats.m] })
      setRig({ pieces, center, size })
    }
  })

  const compileBoth = async () => {
    if (warming.current) return
    warming.current = true
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

    try {
      // 1. Warm up opaque pipeline variant
      allBrainMats.forEach((m) => { m.transparent = false; m.opacity = 1; m.depthWrite = true; m.needsUpdate = true })
      await gl.compileAsync(canvasScene, warmCam)

      // 2. Warm up transparent pipeline variant
      allBrainMats.forEach((m) => { m.transparent = true; m.needsUpdate = true })
      await gl.compileAsync(canvasScene, warmCam)
    } catch {
      // ignore
    }

    // Restore clean default opaque state for start
    allBrainMats.forEach((m) => {
      m.transparent = false
      m.opacity = 1
      m.depthWrite = true
      m.needsUpdate = true
    })

    canvasScene.traverse((o) => {
      if (visMap.has(o)) o.visible = visMap.get(o)!
    })

    warming.current = false
  }

  useEffect(() => {
    if (!rig) return
    S.pieces = rig.pieces
    S.norm = { c: rig.center, s: TARGET / rig.size }
    if (warmed.current) { onReady(); return }
    warmed.current = true
    compileBoth()
    onReady()
  }, [rig, onReady, gl, canvasScene, mats])

  useEffect(() => () => { mats.cortex.forEach((m) => m.dispose()); mats.sulcus.dispose(); Object.values(mats.m).forEach((m) => m.dispose()) }, [mats])

  const allMats = useMemo(() => [...mats.cortex, mats.sulcus, ...Object.values(mats.m)] as THREE.Material[], [mats])
  const lastFade = useRef(1)
  const lastTrans = useRef(false)
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const tmp = useMemo(() => new THREE.Vector3(), []), fd = useMemo(() => new THREE.Vector3(), []), wp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const g = group.current; if (!g || !rig) return
    g.visible = P.r < 0.12; if (!g.visible) { S.remaining = 0; return }

    if (!warming.current) {
      const fade = 1 - sstep(0, 0.1, P.r)
      const isTrans = fade < 0.999
      if (isTrans !== lastTrans.current || Math.abs(fade - lastFade.current) > 0.002) {
        lastTrans.current = isTrans
        lastFade.current = fade
        // While fade === 1 (95% of scroll including shatter), transparent = false restores GPU Early-Z culling.
        // When fade < 0.999 (room transition), transparent = true enables smooth opacity fade.
        allMats.forEach((m) => {
          m.transparent = isTrans
          m.opacity = fade
          m.depthWrite = true
        })
      }
    }

    const p = P.value, t = state.clock.elapsedTime, red = P.reduced
    smooth.current.x += (P.mx - smooth.current.x) * 0.04; smooth.current.y += (P.my - smooth.current.y) * 0.04
    const settle = sstep(0.3, 0.6, p), live = 1 - settle
    g.rotation.y = (0.4 - 0.25 * p + (red ? 0 : Math.sin(t * 0.05) * 0.05 + smooth.current.x * 0.03)) * live
    g.rotation.x = (red ? 0 : smooth.current.y * 0.03) * live
    g.position.y = 0.22 * live
    g.scale.setScalar(1 + 0.12 * sstep(0.1, 0.5, p))
    const tremAmp = red ? 0 : bell(0.15, 0.28, 0.46, p)

    const doRemain = p > 0.6
    let n = 0
    if (doRemain) state.camera.getWorldDirection(fd)
    for (const pc of rig.pieces) {
      const active = p >= pc.start - 0.1
      if (active) {
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
      if (doRemain) {
        wp.setFromMatrixPosition(pc.mesh.matrixWorld); wp.sub(state.camera.position)
        const d = wp.length()
        if (d < 12 && d > 0.05 && wp.dot(fd) / d > 0.35) n++
      }
    }
    if (doRemain) S.remaining += (n / rig.pieces.length - S.remaining) * 0.15
    else S.remaining = 1
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