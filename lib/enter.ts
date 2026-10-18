import * as THREE from 'three'
import gsap from 'gsap'
import { H, LENIS } from './progress'
import { AUDIO } from './audio'

// State for the cinematic "enter room" sequences. Mutable + read per frame by CameraRig / RoomWorlds / TransitionFX (no React state).
const V = THREE.Vector3
export const E = {
  room: -1, busy: false,
  k: 0, k2: 0, d: 0, fov: 0, shake: 0, quiet: 0, dark: 0, soil: 0, metal: 0,
  sp: new V(), sl: new V(), cur: { a: new V(), b: new V() },
  anchors: [null, null] as (THREE.Object3D | null)[],
  booked: false,
  setBooking: (_: number | null) => {},
}
const AC = new V(), F1 = new V(), F2 = new V(), D = new V(), T = new V()
export const EF = new V() // depth-of-field focus during the sequence
const c01 = (x: number) => Math.min(1, Math.max(0, x))

// Camera override: the CAMERA moves (the world and brain never rotate).
export function enterCam(a: THREE.Vector3, b: THREE.Vector3, t: number) {
  const anc = E.anchors[E.room]; if (!anc) return false
  anc.updateWorldMatrix(true, false); AC.setFromMatrixPosition(anc.matrixWorld)
  const front = (d: number, o: THREE.Vector3) => o.set(0, 0, d).applyMatrix4(anc.matrixWorld)
  if (E.room === 0) { // CANTEEN 66: pull back, then a hard rush at the casing's stencilled side, then rusted metal fills the frame
    front(3.2, F1); front(0.7, F2)
    a.lerpVectors(E.sp, F1, E.k); if (E.k2 > 0) a.lerp(F2, E.k2)
    b.lerpVectors(E.sl, AC, c01(E.k))
    a.x += Math.sin(t * 70) * 0.02 * E.shake; a.y += Math.cos(t * 83) * 0.015 * E.shake
    D.copy(b).sub(a).normalize(); T.copy(a).addScaledVector(D, 0.3); EF.lerpVectors(AC, T, E.k2)
  } else { // DEAR MOTHER: slow, accelerating approach, stop square to the carved words, hold, then descend in front of the grave
    front(1.35, F1); a.lerpVectors(E.sp, F1, E.k); b.lerpVectors(E.sl, AC, c01(E.k))
    D.copy(AC).sub(F1)
    if (E.d > 0) { a.y = F1.y - 4 * E.d; b.copy(a).add(D) }
    if (E.k >= 1) { a.x += Math.sin(t * 0.9) * 0.004; a.y += Math.sin(t * 1.3) * 0.003 }
    T.copy(a).addScaledVector(D.clone().normalize(), 0.9); EF.lerpVectors(AC, T, E.d)
  }
  return true
}

const lock = (on: boolean) => { document.documentElement.classList.toggle('entering', on); on ? (LENIS.inst as any)?.stop() : (LENIS.inst as any)?.start() }
export function enterRoom(i: number) {
  if (E.busy || E.room >= 0) return // no double triggers, no second room
  E.busy = true; E.room = i; H.i = -1; E.sp.copy(E.cur.a); E.sl.copy(E.cur.b); lock(true); AUDIO.enter(i)
  const tl = gsap.timeline({ onComplete: () => { E.busy = false } })
  if (i === 0) { // CANTEEN 66 — decision, 0.25s coil, hard launch, impact, metal fills frame, booking powers on (~2.0s)
    tl.to(E, { quiet: 1, duration: 0.6, ease: 'power2.out' }, 0)
      .to(E, { k: -0.03, duration: 0.25, ease: 'power2.out' }, 0.1)
      .to(E, { k: 1, duration: 0.7, ease: 'power4.in' }, 0.35)
      .to(E, { fov: 1, duration: 0.55, ease: 'power2.in' }, 0.4).to(E, { fov: 0, duration: 0.3, ease: 'power2.out' }, 1.05)
      .fromTo(E, { shake: 1 }, { shake: 0, duration: 0.45, ease: 'power3.out' }, 1.05)
      .to(E, { k2: 1, duration: 0.65, ease: 'power3.inOut' }, 1.05)
      .to(E, { metal: 1, duration: 0.5, ease: 'power2.in' }, 1.3)
      .call(() => { E.booked = true; E.setBooking(0); history.pushState({ room: 0 }, '', '#canteen-66') }, [], 1.85)
  } else { // DEAR MOTHER — accelerating run, short stop square to the words, immediate descent into soil (~4.2s)
    tl.to(E, { quiet: 1, duration: 0.8, ease: 'power2.out' }, 0)
      .to(E, { k: 0.5, duration: 0.9, ease: 'power2.in' }, 0.1)
      .to(E, { k: 1, duration: 0.45, ease: 'power3.out' }, 1.0)
      .to(E, { d: 1, duration: 2, ease: 'power1.inOut' }, 1.95)
      .to(E, { soil: 1, duration: 1.6, ease: 'power1.in' }, 2.3).to(E, { dark: 1, duration: 1.8, ease: 'power1.in' }, 2.5)
      .call(() => { E.booked = true; E.setBooking(1); history.pushState({ room: 1 }, '', '#dear-mother') }, [], 3.9)
  }
}
// Reverse: canteen booking → camera reverses out; grave booking → light returns, camera rises back through the soil.
export function leaveRoom() {
  if (E.room < 0 || E.busy) return
  E.busy = true; E.booked = false; AUDIO.leave(); E.setBooking(null)
  gsap.timeline({ onComplete: () => { E.room = -1; E.busy = false; lock(false) } })
    .to(E, { metal: 0, soil: 0, dark: 0, duration: 1.1, ease: 'power2.inOut' }, 0)
    .to(E, { d: 0, k2: 0, duration: 1.5, ease: 'power2.inOut' }, 0.15)
    .to(E, { k: 0, quiet: 0, fov: 0, shake: 0, duration: 1.4, ease: 'power2.inOut' }, 0.8)
}

