import * as THREE from 'three'
const hs = (x: number, y: number, s: number) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
const vn = (x: number, y: number, s: number) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hs(xi, yi, s), b = hs(xi + 1, yi, s), c = hs(xi, yi + 1, s), d = hs(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v }
export const fbm = (x: number, y: number, s = 0, o = 4) => { let a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { t += a * vn(x * f, y * f, s + i * 17); f *= 2; a *= 0.5 } return t / (1 - Math.pow(0.5, o)) }
export const rnd = (i: number, s = 0) => hs(i, i * 7 + 3, s)
type Fn = (u: number, v: number, x: number, y: number) => number[] // r,g,b,rough,metal,bump (0..1)
// Bakes colour / roughness-metalness / bump maps from one procedural function (no image assets).
export function bake(w: number, h: number, fn: Fn, post?: (ctx: CanvasRenderingContext2D, which: 'map' | 'bump') => void) {
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!; return { c, x, d: x.createImageData(w, h) } }
  const A = mk(), B = mk(), C = mk()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = fn(x / w, 1 - y / h, x, y), i = (y * w + x) * 4, q = (v: number) => Math.max(0, Math.min(255, v * 255))
    A.d.data[i] = q(o[0]); A.d.data[i + 1] = q(o[1]); A.d.data[i + 2] = q(o[2]); A.d.data[i + 3] = 255
    B.d.data[i] = 255; B.d.data[i + 1] = q(o[3]); B.d.data[i + 2] = q(o[4]); B.d.data[i + 3] = 255
    C.d.data[i] = C.d.data[i + 1] = C.d.data[i + 2] = q(o[5]); C.d.data[i + 3] = 255
  }
  A.x.putImageData(A.d, 0, 0); B.x.putImageData(B.d, 0, 0); C.x.putImageData(C.d, 0, 0)
  post?.(A.x, 'map'); post?.(C.x, 'bump')
  const t = (c: HTMLCanvasElement, srgb: boolean) => { const tx = new THREE.CanvasTexture(c); tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; tx.anisotropy = 4; return tx }
  return { map: t(A.c, true), orm: t(B.c, false), bump: t(C.c, false) }
}
