export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const bell = (a: number, b: number, c: number, x: number) => sstep(a, b, x) * (1 - sstep(b, c, x))
export function hash(str: string, seed = 0) { let h = 2166136261 ^ seed; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296 }
