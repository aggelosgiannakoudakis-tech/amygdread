'use client'
import { useEffect } from 'react'
import gsap from 'gsap'
import { P, H } from '../lib/progress'
import { E } from '../lib/enter'
import { AUDIO } from '../lib/audio'
import { warnW, warnB } from '../lib/warn'
import { sstep } from '../lib/math'

// Feeds the state of the experience to the single audio engine every frame. The context only starts after a user gesture (browser autoplay rules).
export default function AudioDirector() {
  useEffect(() => {
    AUDIO.init()
    const go = () => AUDIO.resume(), ev = ['pointerdown', 'keydown', 'touchend']
    ev.forEach((e) => addEventListener(e, go, { passive: true }))
    let pp = 0, pr = 0
    const fn = () => {
      const p = P.value, r = P.r, w = warnW()
      AUDIO.update({ started: P.introStart > 0, p, r, w, B: warnB(w), rev0: sstep(0.34, 0.78, r), rev1: sstep(0.4, 0.86, r), hover: H.i, room: E.room, booked: E.booked, d: E.d, k: E.k })
      if ((pp < 0.72 && p >= 0.72) || (pr < 0.015 && r >= 0.015 && p > 0.95) || (pr < 0.55 && r >= 0.55)) AUDIO.whoosh('air', 1.2) // camera: toward the opening, out of the brain, toward the rooms
      pp = p; pr = r
    }
    gsap.ticker.add(fn)
    return () => { gsap.ticker.remove(fn); ev.forEach((e) => removeEventListener(e, go)); AUDIO.dispose() }
  }, [])
  return null
}
