import * as THREE from 'three'

let cachedTex: THREE.CanvasTexture | null = null

// High-frequency anatomical tissue map: mottling + pores + vessels + normals. Baked once, 0 FPS cost.
function getTissueTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (cachedTex) return cachedTex

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'rgb(0, 128, 128)'
  ctx.fillRect(0, 0, size, size)

  let seed = 7741
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const drawWrapped = (fn: (ox: number, oy: number) => void) => {
    for (let ox = -size; ox <= size; ox += size)
      for (let oy = -size; oy <= size; oy += size)
        fn(ox, oy)
  }

  // Dense pia vessels
  const drawVessel = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || width < 0.3) return
    const steps = 16
    const stepLen = len / steps
    let cx = x, cy = y, ca = angle, curv = (rand() - 0.5) * 0.3
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const w = width * (1 - t * 0.3)
      ca += curv + (rand() - 0.5) * 0.35
      curv = curv * 0.7 + (rand() - 0.5) * 0.2
      const nx = cx + Math.cos(ca) * stepLen
      const ny = cy + Math.sin(ca) * stepLen
      drawWrapped((ox, oy) => {
        ctx.lineCap = 'round'
        ctx.strokeStyle = `rgba(200, 90, 80, ${Math.min(0.4, w * 0.08)})`
        ctx.lineWidth = w * 3.4
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke()
        ctx.strokeStyle = `rgba(255, 130, 110, ${Math.min(0.95, 0.5 + w * 0.2)})`
        ctx.lineWidth = w
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke()
      })
      cx = ((nx % size) + size) % size
      cy = ((ny % size) + size) % size
      if ((i === 4 || i === 9 || i === 13) && rand() < 0.85) {
        const dir = rand() < 0.5 ? 1 : -1
        drawVessel(cx, cy, ca + dir * (0.5 + rand() * 0.5), len * 0.62, w * 0.6, depth - 1)
      }
    }
    const dir = rand() < 0.5 ? 1 : -1
    drawVessel(cx, cy, ca + dir * (0.3 + rand() * 0.35), len * 0.7, width * 0.65, depth - 1)
    if (rand() < 0.8) drawVessel(cx, cy, ca - dir * (0.35 + rand() * 0.4), len * 0.6, width * 0.55, depth - 1)
  }

  for (let i = 0; i < 48; i++)
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 110 + rand() * 100, 3.2 + rand() * 2.2, 5)
  for (let i = 0; i < 140; i++)
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 40 + rand() * 50, 1.0 + rand() * 0.9, 3)

  // Strong multi-octave organic mottling + height for normals
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const hMap = new Float32Array(size * size)
  const tau = Math.PI * 2

  for (let y = 0; y < size; y++) {
    const vy = (y / size) * tau
    for (let x = 0; x < size; x++) {
      const ux = (x / size) * tau
      const idx = y * size + x
      const vein = d[idx * 4] / 255

      // Large gyrus-scale blotches
      const macro =
        Math.sin(ux * 1.5 + Math.cos(vy * 1.8)) * 0.40 +
        Math.cos(ux * 2.7 - Math.sin(vy * 2.2)) * 0.30 +
        Math.sin((ux + vy) * 3.5) * 0.20
      // Mid tissue grain
      const mid =
        Math.sin(ux * 7 + Math.cos(vy * 6)) * 0.30 +
        Math.cos(ux * 11 - Math.sin(vy * 9)) * 0.25 +
        Math.sin((ux - vy) * 13) * 0.20
      // Fine cellular / pore noise
      const micro =
        Math.sin(ux * 29 + Math.cos(vy * 31)) * 0.35 +
        Math.cos(ux * 53 - Math.sin(vy * 47)) * 0.28 +
        Math.sin((ux + vy) * 97) * 0.22 +
        Math.cos((ux - vy) * 131) * 0.15

      const mottle = macro * 0.45 + mid * 0.35 + micro * 0.35
      hMap[idx] = mottle * 0.55 + micro * 0.25 + Math.pow(vein, 1.15) * 0.85
      // Alpha = tissue density used heavily in shader color mix
      d[idx * 4 + 3] = Math.max(0, Math.min(255, Math.round(128 + mottle * 140)))
    }
  }

  // Bake normals from height
  const mask = size - 1
  for (let y = 0; y < size; y++) {
    const yn = (y + 1) & mask, yp = (y - 1 + size) & mask
    for (let x = 0; x < size; x++) {
      const xn = (x + 1) & mask, xp = (x - 1 + size) & mask
      const idx = y * size + x
      const dx = (hMap[y * size + xn] - hMap[y * size + xp]) * 0.5
      const dy = (hMap[yn * size + x] - hMap[yp * size + x]) * 0.5
      d[idx * 4 + 1] = Math.max(0, Math.min(255, Math.round(128 + dx * 200)))
      d[idx * 4 + 2] = Math.max(0, Math.min(255, Math.round(128 + dy * 200)))
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 8
  tex.needsUpdate = true
  cachedTex = tex
  return tex
}

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 2.4, amp = 0.45, veins = 1.0): T {
  const tex = getTissueTexture()

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uK = { value: k }
    shader.uniforms.uAmp = { value: amp }
    shader.uniforms.uVeins = { value: veins }
    shader.uniforms.uTissueTex = { value: tex }

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP;
varying vec3 vObjN;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vP = position;
vObjN = normalize(normal);`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP;
varying vec3 vObjN;
uniform float uK;
uniform float uAmp;
uniform float uVeins;
uniform sampler2D uTissueTex;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Tight tri-planar so mottling is small and dense on the cortex (like real tissue grain)
vec3 aw = abs(vObjN);
aw = pow(aw, vec3(4.0));
aw /= (aw.x + aw.y + aw.z + 1e-4);

vec2 uvX = vP.zy * uK + vec2(0.00, 0.00);
vec2 uvY = vP.xz * uK + vec2(0.37, 0.13);
vec2 uvZ = vP.xy * uK + vec2(0.17, 0.59);

vec4 tX = texture2D(uTissueTex, uvX);
vec4 tY = texture2D(uTissueTex, uvY);
vec4 tZ = texture2D(uTissueTex, uvZ);
vec4 t1 = tX * aw.x + tY * aw.y + tZ * aw.z;

// Second octave — fine cellular detail
vec4 tX2 = texture2D(uTissueTex, uvX * 3.1 + 0.21);
vec4 tY2 = texture2D(uTissueTex, uvY * 3.1 + 0.21);
vec4 tZ2 = texture2D(uTissueTex, uvZ * 3.1 + 0.21);
vec4 t2 = tX2 * aw.x + tY2 * aw.y + tZ2 * aw.z;

float n1 = t1.a;           // 0..1 mottling
float n2 = t2.a;
float n  = clamp(n1 * 0.55 + n2 * 0.45, 0.0, 1.0);

// --- REAL TISSUE COLOR BREAKUP (this kills the clay look) ---
vec3 base = diffuseColor.rgb;

// Dark brown sulcus / old blood in folds
vec3 crevice = base * vec3(0.38, 0.28, 0.24);
// Mid cadaveric tan
vec3 flesh   = base * vec3(1.05, 0.92, 0.82);
// Pale creamy pia on gyrus crowns (key to ref image)
vec3 crown   = base * vec3(1.45, 1.28, 1.10);
// Cool grey-pink undertone
vec3 cool    = base * vec3(0.92, 0.90, 0.98);

float crownMask = smoothstep(0.55, 0.92, n);
float darkMask  = 1.0 - smoothstep(0.15, 0.55, n);

vec3 tone = mix(flesh, cool, 0.25 + 0.2 * n2);
tone = mix(tone, crevice, darkMask * 0.85);
tone = mix(tone, crown, crownMask * 0.70);

// Extra high-freq speckles so it never reads as smooth clay
tone *= (0.88 + 0.28 * n2);

diffuseColor.rgb = mix(base, tone, clamp(uAmp * 1.35, 0.0, 1.0));

// Vessels
float vBig = smoothstep(0.20, 0.70, t1.r);
float vCap = smoothstep(0.25, 0.78, t2.r) * 0.7;
float vMask = clamp((vBig * 0.8 + vCap * 0.45) * uVeins, 0.0, 1.0);
vec3 vCol = mix(diffuseColor.rgb * vec3(0.70, 0.22, 0.20), vec3(0.28, 0.04, 0.05), vMask);
diffuseColor.rgb = mix(diffuseColor.rgb, vCol, vMask * 0.72);
`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
// Crowns slightly glossier (wet film), crevices + matte tissue drier — breaks clay shading
float wet = smoothstep(0.45, 0.9, n);
roughnessFactor = clamp(roughnessFactor + (0.55 - n) * 0.22 - vMask * 0.12 - wet * 0.08, 0.42, 0.88);
`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// Strong organic micro-relief (pores + vessel emboss) — kills smooth clay silhouette
vec2 bump = ((t1.gb - 0.5) * 0.85 + (t2.gb - 0.5) * 0.55) * (0.45 * uAmp + 0.25);
normal = normalize(normal + vec3(bump.x, bump.y, 0.0));

// Deep fold AO
float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
float crease = pow(1.0 - ndv, 1.65);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.30, 0.18, 0.14), crease * 0.55 * uVeins);
`
      )
      .replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>
clearcoatNormal = normalize(clearcoatNormal + vec3(bump.x, bump.y, 0.0) * 0.5);
`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// Soft subsurface warmth at terminator (living/preserved tissue cue)
vec3 tot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float lum = dot(tot, vec3(0.299, 0.587, 0.114));
float band = smoothstep(0.02, 0.25, lum) * (1.0 - smoothstep(0.25, 0.75, lum));
reflectedLight.directDiffuse += vec3(0.22, 0.05, 0.03) * diffuseColor.rgb * band * 0.9;
`
      )
  }

  m.customProgramCacheKey = () => `organic-v4-${k}-${amp}-${veins}`
  return m
}