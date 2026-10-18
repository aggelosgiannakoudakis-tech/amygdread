// Centralised Web Audio engine — fully procedural (no audio assets, nothing to download). One AudioContext, one set of persistent beds crossfaded by state,
// plus one-shot SFX. State machine: LOADING · LAB · BRAIN · DISINTEGRATION · WARNING · VOID · ROOM_DISCOVERY · CANTEEN · DEAR_MOTHER · BOOKING.
// Autoplay-safe: the context is only resumed after a user gesture; a tiny control shows until then.
export type AState = 'LOADING' | 'LAB' | 'BRAIN' | 'DISINTEGRATION' | 'WARNING' | 'VOID' | 'ROOM_DISCOVERY' | 'CANTEEN' | 'DEAR_MOTHER' | 'BOOKING'
export type AIn = { started: boolean; p: number; r: number; w: number; B: number; rev0: number; rev1: number; hover: number; room: number; booked: boolean; d: number; k: number }
const cl = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x)), rnd = (a: number, b: number) => a + Math.random() * (b - a)
const VOL = 0.55

class Engine {
  ctx: AudioContext | null = null; master!: GainNode; bus!: GainNode; momLP!: BiquadFilterNode; warnOsc!: OscillatorNode
  g: Record<string, GainNode> = {}; nodes: AudioScheduledSourceNode[] = []; buf!: Record<'white' | 'pink' | 'brown', AudioBuffer>
  muted = false; state: AState = 'LOADING'; next: Record<string, number> = {}; prevB = 0; lastAlarm = 0; warned = false

  init() {
    if (this.ctx || typeof window === 'undefined') return
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return
    const c: AudioContext = (this.ctx = new AC())
    this.master = c.createGain(); this.master.gain.value = 0; const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4; this.master.connect(comp); comp.connect(c.destination)
    this.bus = c.createGain(); this.bus.gain.value = 0.8; this.bus.connect(this.master)
    const mk = (f: (i: number) => number) => { const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = f(i); return b }
    let b0 = 0, b1 = 0, b2 = 0, last = 0
    this.buf = { white: mk(() => Math.random() * 2 - 1), pink: mk(() => { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; return (b0 + b1 + b2 + w * 0.1848) * 0.2 }), brown: mk(() => { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; return last * 3.5 }) }
    const osc = (t: OscillatorType, f: number) => { const o = c.createOscillator(); o.type = t; o.frequency.value = f; o.start(); this.nodes.push(o); return o }
    const noise = (k: 'white' | 'pink' | 'brown') => { const s = c.createBufferSource(); s.buffer = this.buf[k]; s.loop = true; s.start(); this.nodes.push(s); return s }
    const gain = (v: number) => { const g = c.createGain(); g.gain.value = v; return g }
    const bq = (t: BiquadFilterType, f: number, q = 1) => { const b = c.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = q; return b }
    const lfo = (f: number, depth: number, p: AudioParam) => { const o = osc('sine', f), g = gain(depth); o.connect(g); g.connect(p) }
    const voice = (n: string, pan = 0) => { const g = gain(0); this.g[n] = g; if (pan) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.master) } else g.connect(this.master); return g }
    // LAB bed: old clinical facility — mains hum, distant ventilation, room tone
    { const o = voice('hum'), f = bq('lowpass', 400); f.connect(o); [50, 100.3, 150.6].forEach((fr, i) => { const s = osc('sine', fr), g = gain(0.5 / (i + 1)); s.connect(g); g.connect(f) }) }
    { const o = voice('vent'), f = bq('bandpass', 350, 0.6); noise('pink').connect(f); f.connect(o); lfo(0.07, 120, f.frequency) }
    { const o = voice('room'), f = bq('lowpass', 500); noise('brown').connect(f); f.connect(o) }
    // BRAIN: very quiet low organic resonance + faint wet texture
    { const o = voice('brain'), t = gain(0.6); [55, 57.3].forEach((fr) => { const s = osc('sine', fr); s.connect(t) }); lfo(0.13, 0.3, t.gain); t.connect(o); const f = bq('bandpass', 900, 2), n = gain(0.08); noise('pink').connect(f); f.connect(n); n.connect(o); lfo(0.21, 300, f.frequency) }
    { const o = voice('pressure'); const s = osc('sine', 38), f = bq('lowpass', 90); s.connect(o); noise('brown').connect(f); f.connect(o) }
    // WARNING tone (rising electrical tone → unstable drone)
    { const o = voice('warn'); this.warnOsc = osc('sawtooth', 220); const f = bq('lowpass', 1200); this.warnOsc.connect(f); f.connect(o) }
    // CANTEEN bed: distant machinery, electrical buzz, wind through structure (left)
    { const o = voice('can', -0.5), m = osc('sawtooth', 55), f = bq('lowpass', 150), ag = gain(0.6); m.connect(f); f.connect(ag); ag.connect(o); lfo(0.5, 0.3, ag.gain); const h = osc('sine', 120), hg = gain(0.1); h.connect(hg); hg.connect(o); const w = bq('bandpass', 500, 1.2); noise('pink').connect(w); w.connect(o); lfo(0.05, 200, w.frequency) }
    // DEAR MOTHER bed: wind, leaves, earth (right) — through a low-pass used for the muffled underground
    { const o = voice('mom', 0.5); this.momLP = bq('lowpass', 700); this.momLP.connect(o); const w = bq('lowpass', 700), gg = gain(0.6); noise('pink').connect(w); w.connect(gg); gg.connect(this.momLP); lfo(0.06, 0.4, gg.gain)
      const lh = bq('highpass', 3500), lg = gain(0.04); noise('white').connect(lh); lh.connect(lg); lg.connect(this.momLP); lfo(0.9, 0.02, lg.gain); lfo(2.3, 0.015, lg.gain); const e = osc('sine', 44), eg = gain(0.5); e.connect(eg); eg.connect(this.momLP) }
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; document.hidden ? this.ctx.suspend() : this.ctx.resume() })
  }
  resume() { this.init(); const c = this.ctx; if (c && c.state !== 'running') c.resume().catch(() => {}) }
  setMuted(m: boolean) { this.muted = m }
  status() { return { running: this.ctx?.state === 'running', muted: this.muted } }
  dispose() { this.nodes.forEach((n) => { try { n.stop() } catch {} }); this.nodes = []; this.ctx?.close().catch(() => {}); this.ctx = null; this.g = {} }

  private curve(k: number) { const n = 256, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)) } return c }
  // one-shots
  private burst(kind: 'white' | 'pink' | 'brown', dur: number, vol: number, ft: BiquadFilterType, f0: number, f1: number, q = 1, delay = 0, dist = 0) {
    const c = this.ctx; if (!c || c.state !== 'running') return; const t = c.currentTime + delay, s = c.createBufferSource(); s.buffer = this.buf[kind]; s.loop = true
    const f = c.createBiquadFilter(); f.type = ft; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    let n: AudioNode = f; s.connect(f); if (dist) { const w = c.createWaveShaper(); w.curve = this.curve(dist); f.connect(w); n = w } n.connect(g); g.connect(this.bus); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05)
  }
  private tone(fr: number, dur: number, vol: number, type: OscillatorType = 'sine', to = fr, delay = 0, dist = 0) {
    const c = this.ctx; if (!c || c.state !== 'running') return; const t = c.currentTime + delay, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    let n: AudioNode = o; if (dist) { const w = c.createWaveShaper(); w.curve = this.curve(dist); o.connect(w); n = w } n.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + 0.05)
  }
  click(v = 0.05) { this.burst('white', 0.012, v, 'highpass', 2500, 4000) }
  relay() { this.click(0.04); this.tone(2200, 0.02, 0.02) }
  blip() { this.tone(1800, 0.05, 0.025); this.click(0.02) }
  metal(v = 0.04) { [420, 613, 1180].forEach((f, i) => this.tone(f * rnd(0.97, 1.03), 1.8 - i * 0.4, v / (i + 1))) }
  creak(v = 0.08) { this.burst('white', rnd(0.4, 0.9), v, 'bandpass', rnd(280, 380), rnd(110, 180), 12) }
  crackle(v = 0.05) { this.burst('white', 0.08, v, 'bandpass', rnd(1500, 3000), 800, 3, 0, 8) }
  thump(v = 0.2) { this.burst('brown', 0.5, v, 'lowpass', 160, 50); this.tone(90, 0.45, v * 0.6, 'sine', 40) }
  drip() { this.tone(900, 0.07, 0.03, 'sine', 480) }
  alarm() { this.tone(920, 0.11, 0.07, 'sine', 920, 0, 2); this.tone(1380, 0.11, 0.025, 'triangle') }
  surge() { this.thump(0.3); this.burst('white', 0.18, 0.09, 'bandpass', 2000, 900, 2, 0, 20) }
  whoosh(kind: 'air' | 'metal' | 'earth', dur = 1) { kind === 'air' ? this.burst('pink', dur, 0.1, 'bandpass', 900, 200, 0.8) : kind === 'metal' ? (this.burst('pink', dur, 0.3, 'bandpass', 400, 3800, 0.9), this.burst('white', dur, 0.06, 'highpass', 1500, 5000)) : this.burst('brown', dur, 0.3, 'lowpass', 600, 70) }
  // room entry, synchronised with the camera timelines in lib/enter.ts
  enter(i: number) {
    if (i === 0) { this.burst('pink', 0.5, 0.12, 'bandpass', 120, 600, 1, 0.1); this.whoosh('metal', 0.75); this.burst('pink', 0.75, 0.3, 'bandpass', 400, 3800, 0.9, 0.35); this.burst('white', 0.08, 0.35, 'highpass', 1500, 3000, 1, 1.05); [180, 420, 613].forEach((f, k) => this.tone(f, 0.9, 0.12 / (k + 1), 'sine', f, 1.05)); this.burst('brown', 0.45, 0.35, 'lowpass', 150, 50, 1, 1.05) }
    else { this.burst('brown', 0.9, 0.2, 'lowpass', 300, 900, 1, 0.1); this.burst('pink', 0.45, 0.2, 'bandpass', 200, 1200, 1, 1.0); this.burst('brown', 2, 0.35, 'lowpass', 600, 70, 1, 1.95); this.tone(40, 2, 0.12, 'sine', 40, 1.95); for (let k = 0; k < 5; k++) this.burst('white', 0.1, 0.03, 'bandpass', 400, 250, 2, 2.2 + k * 0.35 + Math.random() * 0.2) }
  }
  leave() { this.burst('pink', 1.2, 0.12, 'bandpass', 1500, 300, 0.8) }

  stateOf(s: AIn): AState {
    if (!s.started) return 'LOADING'
    if (s.room >= 0) return s.booked ? 'BOOKING' : s.room === 0 ? 'CANTEEN' : 'DEAR_MOTHER'
    if (s.w >= 0 && s.w < 2.05) return 'WARNING'
    if (s.p < 0.12) return 'LAB'
    if (s.p < 0.32) return 'BRAIN'
    if (s.r >= 0.3) return 'ROOM_DISCOVERY'
    return s.w >= 2.05 ? 'VOID' : 'DISINTEGRATION'
  }
  private every(k: string, now: number, a: number, b: number, fn: () => void) { if (now > (this.next[k] ?? 0)) { if (this.next[k]) fn(); this.next[k] = now + rnd(a, b) } }
  update(s: AIn) {
    const c = this.ctx; if (!c || c.state !== 'running') return; const now = c.currentTime, st = (this.state = this.stateOf(s))
    const T = (n: string, v: number, tc = 0.7) => this.g[n]?.gain.setTargetAtTime(v, now, tc)
    let hum = 0, vent = 0, room = 0, brain = 0, press = 0, can = 0, mom = 0, momF = 700, q = 0
    switch (st) {
      case 'LOADING': hum = 0.25; room = 0.15; break
      case 'LAB': hum = 0.3; vent = 0.35; room = 0.3; break
      case 'BRAIN': hum = 0.25; vent = 0.25; room = 0.25; brain = 0.35; break
      case 'DISINTEGRATION': q = cl((s.p - 0.3) / 0.65); hum = 0.2; vent = 0.15 * (1 - q); room = 0.2; brain = 0.3 * (1 - 0.5 * q); press = 0.15 + 0.5 * q; break
      case 'WARNING': { const late = cl((s.w - 1.45) / 0.3); hum = 0.35 * cl(s.B) * (1 - late); press = 0.3 * (1 - late); room = 0.1 * (1 - late); break } // everything falls away: silence
      case 'VOID': break
      case 'ROOM_DISCOVERY': { const bc = cl((s.r - 0.25) / 0.1) * 0.12; can = Math.max(bc, s.rev0 * (0.42 + (s.hover === 0 ? 0.28 : 0)) * (s.hover === 1 ? 0.7 : 1)); mom = Math.max(bc, s.rev1 * (0.42 + (s.hover === 1 ? 0.28 : 0)) * (s.hover === 0 ? 0.7 : 1)); break }
      case 'CANTEEN': can = 0.5; hum = 0.12; break
      case 'DEAR_MOTHER': mom = 0.45; momF = 700 - 600 * s.d; break
      case 'BOOKING': if (s.room === 0) { can = 0.28; hum = 0.1 } else { mom = 0.22; momF = 250 } break
    }
    T('hum', hum); T('vent', vent); T('room', room); T('brain', brain); T('pressure', press); T('can', can); T('mom', mom); this.momLP?.frequency.setTargetAtTime(momF, now, 0.4)
    this.master.gain.setTargetAtTime(this.muted ? 0 : VOL, now, 0.5)
    // warning: tiny rising electrical tone → clinical alarm pulses locked to the flashes → instability → silence
    if (s.w >= 0) { const rise = cl(s.w / 0.1); this.warnOsc.frequency.setTargetAtTime(220 + 700 * rise + (s.w > 0.1 ? Math.sin(now * 9) * 30 : 0), now, 0.05); T('warn', s.w > 1.64 ? 0 : s.w < 0.1 ? 0.12 * rise : 0.05 * cl(s.B), 0.08)
      if (!this.warned && s.B > 0.9) { this.warned = true; this.surge() } if (s.B > 0.9 && this.prevB <= 0.9 && now - this.lastAlarm > 0.2 && s.w < 1.7) { this.alarm(); this.lastAlarm = now } this.prevB = s.B } else { T('warn', 0, 0.1); this.warned = false; this.prevB = 0 }
    // sparse one-shots: silence matters, small sounds mean something
    if (st === 'LOADING' || st === 'LAB' || st === 'BRAIN') { this.every('click', now, 6, 18, () => this.click(0.05)); this.every('metal', now, 20, 45, () => this.metal(0.035)) }
    if (st === 'DISINTEGRATION') { this.every('creak', now, 6 - 4.8 * q, 8 - 5.5 * q, () => { this.creak(0.05 + 0.1 * q); if (q > 0.3) this.crackle(0.04 * q) }); this.every('metal', now, 12, 25, () => this.metal(0.05)) }
    if (can > 0.2) { this.every('ccreak', now, 9, 22, () => (Math.random() > 0.5 ? this.creak(0.05) : this.metal(0.04))); this.every('crelay', now, 5, 12, () => this.click(0.035)) }
    if (mom > 0.2) { this.every('mcreak', now, 12, 28, () => this.creak(0.035)); this.every('mthump', now, 25, 50, () => this.thump(0.05)); if (st === 'BOOKING') this.every('drip', now, 4, 9, () => this.drip()) }
  }
}
export const AUDIO = new Engine()
