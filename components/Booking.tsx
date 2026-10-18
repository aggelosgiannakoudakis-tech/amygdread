'use client'
import { useCallback, useEffect, useState } from 'react'
import { SLOTS, getAvailability, submitBooking } from '../lib/booking'
import { rooms } from '../lib/content'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DAYS = () => Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return { iso: iso(d), wd: d.toLocaleDateString('en', { weekday: 'short' }).toUpperCase(), n: String(d.getDate()).padStart(2, '0') } })

function useForm(room: string) {
  const [date, setDate] = useState(iso(new Date())), [time, setTime] = useState(''), [people, setPeople] = useState(2), [name, setName] = useState(''), [email, setEmail] = useState('')
  const [slots, setSlots] = useState<string[]>([]), [avail, setAvail] = useState<'checking' | 'done'>('checking'), [done, setDone] = useState(false), [busy, setBusy] = useState(false)
  const check = useCallback(async () => { setAvail('checking'); setTime(''); const s = await getAvailability(room, date); setSlots(s); setAvail('done') }, [room, date])
  useEffect(() => { check() }, [check])
  const valid = avail === 'done' && !!time && !!name.trim() && /\S+@\S+\.\S+/.test(email)
  const submit = async () => { if (!valid || busy) return; setBusy(true); const r = await submitBooking({ room, date, time, people, name, email }); setBusy(false); setDone(r.ok) }
  return { date, setDate, time, setTime, people, setPeople, name, setName, email, setEmail, slots, avail, check, done, busy, valid, submit, days: DAYS() }
}
type F = ReturnType<typeof useForm>
const status = (f: F) => (f.avail === 'checking' ? 'CHECKING…' : `${f.slots.length} SLOT${f.slots.length === 1 ? '' : 'S'} OPEN`)
const dl = (n: number) => ({ animationDelay: `${n * 0.16}s` })

// CANTEEN 66 — an abandoned service station powering back on: riveted steel, stencilled controls with lamps, a mechanical group counter, flickering start-up.
function Canteen({ onLeave }: { onLeave: () => void }) {
  const f = useForm(rooms[0].name)
  return (
    <div
      className="bk cn-bg fixed inset-0 z-[90] overflow-y-auto overscroll-contain pointer-events-auto"
      role="dialog"
      aria-label="Canteen 66 entry log"
      data-lenis-prevent="true"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      <span className="cn-stencil" aria-hidden>66</span>
      <button onClick={onLeave} className="cn-exit po" style={dl(1)}>Exit ✕</button>
      <div className="relative mx-auto grid min-h-full max-w-6xl gap-14 px-[5vw] py-[11vh] md:grid-cols-[0.85fr_1.25fr]">
        <div>
          <p className="po cn-k" style={dl(1)}>Field kitchen unit 66</p>
          <h2 className="po cn-title" style={dl(2)}>Entry<br />log</h2>
          <dl className="po cn-dl mt-10" style={dl(4)}><dt>Location status</dt><dd>Closed</dd><dt>Access</dt><dd>By reservation</dd><dt>Group</dt><dd>2–6</dd><dt>Duration</dt><dd>60 min</dd></dl>
        </div>
        {f.done ? (
          <div className="po self-center" style={dl(1)}><p className="cn-title !text-[3.4rem]">Logged</p><p className="cn-k mt-4">{f.date} · {f.time} · {f.people} persons — confirmation to follow</p></div>
        ) : (
          <div className="grid gap-9">
            <section className="po" style={dl(3)}><h3 className="cn-sec">01 · Date</h3>
              <div className="flex flex-wrap gap-2">{f.days.map((d) => <button key={d.iso} onClick={() => f.setDate(d.iso)} className={`cn-tab ${f.date === d.iso ? 'on' : ''}`}><i className="lamp" /><span>{d.wd}</span><b>{d.n}</b></button>)}</div>
              <input aria-label="Other date" className="cn-in mt-3 !w-auto" type="date" min={iso(new Date())} value={f.date} onChange={(e) => f.setDate(e.target.value)} />
            </section>
            <section className="po" style={dl(5)}><h3 className="cn-sec">02 · Time <em>{status(f)}</em></h3>
              <div className="flex flex-wrap gap-2">{SLOTS.map((s) => <button key={s} disabled={!f.slots.includes(s)} onClick={() => f.setTime(s)} className={`cn-tab ${f.time === s ? 'on' : ''}`}><i className="lamp" /><b>{s}</b></button>)}</div>
              <button onClick={f.check} className="cn-btn mt-3">Check availability</button>
            </section>
            <section className="po" style={dl(7)}><h3 className="cn-sec">03 · Group</h3>
              <div className="flex items-stretch gap-3"><button className="cn-btn !px-5 !text-lg" aria-label="Fewer" onClick={() => f.setPeople((p) => Math.max(2, p - 1))}>−</button><div className="cn-dial" aria-live="polite">{f.people}</div><button className="cn-btn !px-5 !text-lg" aria-label="More" onClick={() => f.setPeople((p) => Math.min(6, p + 1))}>+</button></div>
            </section>
            <section className="po grid gap-5 sm:grid-cols-2" style={dl(9)}>
              <label><span className="cn-sec">Name</span><input className="cn-in" value={f.name} onChange={(e) => f.setName(e.target.value)} autoComplete="name" /></label>
              <label><span className="cn-sec">Email</span><input className="cn-in" type="email" value={f.email} onChange={(e) => f.setEmail(e.target.value)} autoComplete="email" /></label>
            </section>
            <button onClick={f.submit} disabled={!f.valid || f.busy} className="po cn-reserve" style={dl(11)}>{f.busy ? 'Logging…' : 'Reserve'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

// DEAR MOTHER — buried: soil, roots framing the edges, the last light draining away, controls that resolve slowly out of the dark like something uncovered.
function Mother({ onLeave }: { onLeave: () => void }) {
  const f = useForm(rooms[1].name)
  return (
    <div
      className="bk dm-bg fixed inset-0 z-[90] overflow-y-auto overscroll-contain pointer-events-auto"
      role="dialog"
      aria-label="Dear Mother reservation"
      data-lenis-prevent="true"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" fill="none" stroke="#1d130b" strokeLinecap="round" aria-hidden>
        {['M0,0 C90,220 10,420 130,720 S60,900 110,1000', 'M1000,0 C900,260 990,460 860,720 S940,900 890,1000', 'M0,300 C120,330 160,420 260,430 S300,520 360,560', 'M1000,520 C880,560 840,640 760,650 S700,740 640,760', 'M300,0 C320,60 280,120 330,170 S380,230 420,250', 'M700,1000 C690,930 740,880 700,820', 'M110,720 C200,700 230,760 320,790'].map((d, i) => <path key={i} d={d} strokeWidth={i < 2 ? 11 : i < 5 ? 5 : 3} className="root" style={{ animationDelay: `${i * 0.5}s` }} />)}
      </svg>
      {Array.from({ length: 22 }, (_, i) => <i key={i} className="pointer-events-none absolute rounded-full bg-[#4a3826]" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, width: 2 + (i % 3), height: 2 + (i % 3), opacity: 0.5, animation: `drift ${9 + (i % 5)}s ease-in-out ${i * 0.4}s infinite` }} />)}
      <div className="dm-dim" />
      <button onClick={onLeave} className="dm-in fixed right-[4vw] top-6 z-10 font-mono text-[10px] uppercase tracking-[0.5em] text-bone/55 hover:text-bone" style={dl(10)}>↑ Return</button>
      <div className="relative mx-auto grid min-h-full max-w-5xl gap-12 px-[6vw] py-[12vh] md:grid-cols-[1fr_1fr]">
        <div>
          <p className="dm-in font-mono text-[10px] uppercase tracking-[0.5em] text-[#7f98a6]" style={dl(5)}>Site status: undocumented</p>
          <h2 className="dm-in dm-title mt-6" style={dl(7)}>Dear<br />Mother</h2>
          <p className="dm-in mt-8 font-mono text-[10px] uppercase leading-[2.1] tracking-[0.3em] text-bone/45" style={dl(9)}>Depth −3.4 m<br />Access by reservation<br />Group 2–6 · 75 min</p>
        </div>
        {f.done ? (
          <div className="dm-in self-center" style={dl(1)}><p className="dm-title !text-5xl">Recorded.</p><p className="mt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-bone/55">{f.date} · {f.time} · {f.people} persons</p></div>
        ) : (
          <div className="grid gap-9 self-center font-mono text-[11px] uppercase tracking-[0.3em]">
            <section className="dm-in" style={dl(9)}><h3 className="dm-sec">Date</h3>
              <div className="flex flex-wrap gap-x-5 gap-y-2">{f.days.map((d) => <button key={d.iso} onClick={() => f.setDate(d.iso)} className={`dm-opt ${f.date === d.iso ? 'on' : ''}`}>{d.wd} {d.n}</button>)}</div>
            </section>
            <section className="dm-in" style={dl(11)}><h3 className="dm-sec">Time <em>{status(f)}</em></h3>
              <div className="flex flex-wrap gap-x-6 gap-y-2">{SLOTS.map((s) => <button key={s} disabled={!f.slots.includes(s)} onClick={() => f.setTime(s)} className={`dm-opt ${f.time === s ? 'on' : ''}`}>{s}</button>)}</div>
              <button onClick={f.check} className="dm-opt mt-3 !text-[9px]">Check availability</button>
            </section>
            <section className="dm-in" style={dl(13)}><h3 className="dm-sec">Group</h3>
              <div className="flex items-center gap-7"><button className="dm-opt !text-xl" aria-label="Fewer" onClick={() => f.setPeople((p) => Math.max(2, p - 1))}>−</button><span className="font-display text-5xl font-light not-italic text-bone" aria-live="polite">{f.people}</span><button className="dm-opt !text-xl" aria-label="More" onClick={() => f.setPeople((p) => Math.min(6, p + 1))}>+</button></div>
            </section>
            <section className="dm-in grid gap-5" style={dl(15)}>
              <label><span className="dm-sec">Name</span><input className="dm-in-field" value={f.name} onChange={(e) => f.setName(e.target.value)} autoComplete="name" /></label>
              <label><span className="dm-sec">Email</span><input className="dm-in-field" type="email" value={f.email} onChange={(e) => f.setEmail(e.target.value)} autoComplete="email" /></label>
            </section>
            <button onClick={f.submit} disabled={!f.valid || f.busy} className="dm-in dm-go" style={dl(17)}>{f.busy ? '…' : 'Reserve'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
export default function Booking({ room, onLeave }: { room: number; onLeave: () => void }) { return room === 0 ? <Canteen onLeave={onLeave} /> : <Mother onLeave={onLeave} /> }