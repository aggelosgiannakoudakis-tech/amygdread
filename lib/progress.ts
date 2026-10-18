import * as THREE from 'three'
import type { Piece } from './pieces'
// Mutable shared state read every frame by the 3D scene + DOM overlay (no React re-renders).
// value = brain sequence 0..1 · r = room-approach sequence 0..1 (overlaps the brain's last ~20%).
export const P = { target: 0, value: 0, rTarget: 0, r: 0, cTarget: 0, c: 0, xTarget: 0, x: 0, mx: 0, my: 0, reduced: false, introStart: 0 }
export const H = { i: -1 } // hovered room (-1 none)
export const FOCUS = new THREE.Vector3() // depth-of-field focal point, driven by CameraRig
export const S: { pieces: Piece[]; norm: { c: THREE.Vector3; s: number } | null; remaining: number } = { pieces: [], norm: null, remaining: 1 } // remaining = share of brain fragments still in front of the camera
export const SPEC = { v: 0 }
export const LENIS: { inst: { scrollTo: (n: number, o?: object) => void; stop?: () => void; start?: () => void } | null } = { inst: null }
export const introT = () => (P.introStart ? (performance.now() - P.introStart) / 1000 : 0)

export const LOAD = { canvas: false, model: false }
