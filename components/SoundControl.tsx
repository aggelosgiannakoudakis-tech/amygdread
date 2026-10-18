'use client'
import { useEffect, useState } from 'react'
import { AUDIO } from '../lib/audio'
export default function SoundControl() {
  const [st, setSt] = useState({ running: false, muted: false })
  useEffect(() => { const id = setInterval(() => setSt(AUDIO.status()), 400); return () => clearInterval(id) }, [])
  const label = !st.running ? 'Enable sound' : st.muted ? 'Sound off' : 'Sound on'
  return <button onClick={() => { if (!st.running) { AUDIO.setMuted(false); AUDIO.resume() } else AUDIO.setMuted(!st.muted); setSt(AUDIO.status()) }} aria-label="Toggle sound" className="fixed bottom-[3vh] right-[3.5vw] z-[80] font-mono text-[9px] uppercase tracking-[0.4em] text-bone/45 transition-colors hover:text-bone">{label}</button>
}
