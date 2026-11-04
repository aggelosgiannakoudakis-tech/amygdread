// components/BrainModel.tsx
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { P, S } from '../lib/progress'
import { sstep, bell } from '../lib/math'
import { PieceBuilder, Piece, Layer } from '../lib/pieces'
import { organic } from '../lib/materials'

const TARGET = 2.6

const mk = (o: THREE.MeshPhysicalMaterialParameters) =>
  organic(
    new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide,
      roughness: 0.58,
      metalness: 0,
      clearcoat: 0.20,
      clearcoatRoughness: 0.5,
      specularIntensity: 0.38,
      sheen: 0.35,
      sheenColor: new THREE.Color('#c8a898'),
      sheenRoughness: 0.5,
      envMapIntensity: 0.55,
      transparent: false,
      depthWrite: true,
      opacity: 1,
      ...o,
    }),
    1.4,
    0.60,
    1.0
  )

function makeMaterials() {
  const cortex = [0, 1, 2, 3].map((i) =>
    mk({
      color: new THREE.Color('#9e8272').offsetHSL(0.006 * (i - 1.5), 0.03 * (i - 1.5), 0.02 * (i - 1.5)),
      sheenColor: new THREE.Color('#bfa292'),
    })
  )
  const sulcus = mk({
    color: '#63493c',
    roughness: 0.68,
    clearcoat: 0.12,
  })
  const m: Record<Exclude<Layer, 'hidden' | 'cortex'>, THREE.Material> = {
    cerebellum: mk({ color: '#8c7060', roughness: 0.65 }),
    deep: mk({ color: '#7a5e50', roughness: 0.62 }),
    tract: mk({ color: '#b8a694', roughness: 0.70, clearcoat: 0.08 }),
    vessel: mk({ color: '#7a2224', roughness: 0.42, clearcoat: 0.35 }),
    nerve: mk({ color: '#bfa88c', roughness: 0.68 }),
    amygdala: mk({ color: '#88564c', roughness: 0.62 }),
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

  useEffect(() => {
    builder.current = new PieceBuilder(gltfScene)
    setRig(null)
  }, [gltfScene])

  useFrame(() => {
    const b = builder.current
    if (!b || b.done) return
    if (b.step(6)) {
      const { pieces, center, size } = b.result()
      const coarse = typeof window !== 'undefined' && matchMedia('(pointer:coarse)').matches
      if (coarse) pieces.forEach((p) => { if (p.layer === 'nerve') p.mesh.visible = false })
      pieces.forEach((p) => {
        p.mesh.material =
          p.layer === 'cortex'
            ? /sulc/i.test((p.mesh.userData.name ?? p.mesh.name) as string)
              ? mats.sulcus
              : mats.cortex[Math.floor(p.h * 4) % 4]
            : mats.m[p.layer as keyof typeof mats.m]
      })
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
      allBrainMats.forEach((m) => {
        m.transparent = false
        m.opacity = 1
        m.depthWrite = true
        m.needsUpdate = true
      })
      await gl.compileAsync(canvasScene, warmCam)

      allBrainMats.forEach((m) => {
        m.transparent = true
        m.needsUpdate = true
      })
      await gl.compileAsync(canvasScene, warmCam)
    } catch {
      // ignore
    }

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
    if (warmed.current) {
      onReady()
      return
    }
    warmed.current = true
    compileBoth()
    onReady()
  }, [rig, onReady, gl, canvasScene, mats])

  useEffect(
    () => () => {
      mats.cortex.forEach((m) => m.dispose())
      mats.sulcus.dispose()
      Object.values(mats.m).forEach((m) => m.dispose())
    },
    [mats]
  )

  const allMats = useMemo(
    () => [...mats.cortex, mats.sulcus, ...Object.values(mats.m)] as THREE.Material[],
    [mats]
  )
  const lastFade = useRef(1)
  const lastTrans = useRef(false)
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const fd = useMemo(() => new THREE.Vector3(), [])
  const wp = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const g = group.current
    if (!g || !rig) return
    g.visible = P.r < 0.12
    if (!g.visible) {
      S.remaining = 0
      return
    }

    if (!warming.current) {
      const fade = 1 - sstep(0, 0.1, P.r)
      const isTrans = fade < 0.999
      if (isTrans !== lastTrans.current || Math.abs(fade - lastFade.current) > 0.002) {
        lastTrans.current = isTrans
        lastFade.current = fade
        allMats.forEach((m) => {
          m.transparent = isTrans
          m.opacity = fade
          m.depthWrite = true
        })
      }
    }

    const p = P.value
    const t = state.clock.elapsedTime
    const red = P.reduced
    smooth.current.x += (P.mx - smooth.current.x) * 0.04
    smooth.current.y += (P.my - smooth.current.y) * 0.04
    const settle = sstep(0.3, 0.6, p)
    const live = 1 - settle
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
          if (a > 0)
            tmp.set(
              tmp.x + Math.sin(t * 38 + pc.h * 40) * a,
              tmp.y + Math.sin(t * 41 + pc.h * 70) * a,
              tmp.z + Math.sin(t * 35 + pc.h * 90) * a
            )
        }
        pc.mesh.position.copy(tmp)
        const sp = ease + drift * 0.5
        e.set(pc.spin.x * sp, pc.spin.y * sp, pc.spin.z * sp)
        q.setFromEuler(e)
        pc.mesh.quaternion.copy(q)
      }
      if (doRemain) {
        wp.setFromMatrixPosition(pc.mesh.matrixWorld)
        wp.sub(state.camera.position)
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