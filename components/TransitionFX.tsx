'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { E } from '../lib/enter'

// Screen layers for the physical entry: rusted metal filling the frame (Canteen 66); soil closing in from below + light loss (Dear Mother).
export default function TransitionFX() {
  const metal = useRef<HTMLDivElement>(null), dark = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fn = () => {
      if (metal.current) metal.current.style.opacity = String(E.metal)
      if (dark.current) dark.current.style.opacity = String(E.dark * 0.45)
      document.documentElement.style.setProperty('--soil', String(E.soil))
    }
    gsap.ticker.add(fn); return () => gsap.ticker.remove(fn)
  }, [])
  return (<><div ref={dark} className="fx fx-dark" /><div className="fx fx-soil" /><div ref={metal} className="fx fx-metal" /></>)
}
