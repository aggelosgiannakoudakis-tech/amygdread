// lib/materials.ts
import * as THREE from 'three'

let cachedTex: THREE.CanvasTexture | null = null

// High-resolution anatomical tissue texture with baked mottling, capillaries, and density
function getTissueTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (cachedTex) return cachedTex

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Base neutral tissue color
  ctx.fillStyle = 'rgb(128, 128, 128)'
  ctx.fillRect(0, 0, size, size)

  let seed = 4821
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const drawWrapped = (fn: (ox: number, oy: number) => void) => {
    for (let ox = -size; ox <= size; ox += size)
      for (let oy = -size; oy <= size; oy += size)
        fn(ox, oy)
  }

  // Draw vascular capillaries and pia vessels
  const drawVessel = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || width < 0.3) return
    const steps = 14
    const stepLen = len / steps
    let cx = x, cy = y, ca = angle, curv = (rand() - 0.5) * 0.25
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const w = width * (1 - t * 0.25)
      ca += curv + (rand() - 0.5) * 0.3
      curv = curv * 0.75 + (rand() - 0.5) * 0.18
      const nx = cx + Math.cos(ca) * stepLen
      const ny = cy + Math.sin(ca) * stepLen
      drawWrapped((ox, oy) => {
        ctx.lineCap = 'round'
        ctx.strokeStyle = `rgba(180, 50, 40, ${Math.min(0.5, w * 0.12)})`
        ctx.lineWidth = w * 2.8
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke()
        ctx.strokeStyle = `rgba(220, 80, 70, ${Math.min(0.9, 0.4 + w * 0.25)})`
        ctx.lineWidth = w
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke()
      })
      cx = ((nx % size) + size) % size
      cy = ((ny % size) + size) % size
      if ((i === 4 || i === 9) && rand() < 0.8) {
        const dir = rand() < 0.5 ? 1 : -1
        drawVessel(cx, cy, ca + dir * (0.4 + rand() * 0.4), len * 0.6, w * 0.6, depth - 1)
      }
    }
  }

  for (let i = 0; i < 36; i++)
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 90 + rand() * 80, 2.5 + rand() * 1.8, 4)
  for (let i = 0; i < 90; i++)
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 35 + rand() * 45, 0.9 + rand() * 0.8, 2)

  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const tau = Math.PI * 2

  for (let y = 0; y < size; y++) {
    const vy = (y / size) * tau
    for (let x = 0; x < size; x++) {
      const ux = (x / size) * tau
      const idx = (y * size + x) * 4

      // Smooth multi-scale anatomical noise
      const macro =
        Math.sin(ux * 1.2 + Math.cos(vy * 1.5)) * 0.45 +
        Math.cos(ux * 2.1 - Math.sin(vy * 1.8)) * 0.35 +
        Math.sin((ux + vy) * 2.8) * 0.20
      const mid =
        Math.sin(ux * 5.5 + Math.cos(vy * 4.8)) * 0.35 +
        Math.cos(ux * 8.2 - Math.sin(vy * 7.1)) * 0.30 +
        Math.sin((ux - vy) * 10.5) * 0.25
      const micro =
        Math.sin(ux * 22 + Math.cos(vy * 24)) * 0.40 +
        Math.cos(ux * 41 - Math.sin(vy * 37)) * 0.35 +
        Math.sin((ux + vy) * 73) * 0.25

      const mottle = macro * 0.45 + mid * 0.35 + micro * 0.20

      // Mottling -> Green, micro detail -> Blue, Vessels -> Red
      d[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + mottle * 110)))
      d[idx + 2] = Math.max(0, Math.min(255, Math.round(128 + micro * 100)))
      d[idx + 3] = Math.max(0, Math.min(255, Math.round(128 + (mottle * 0.6 + micro * 0.4) * 120)))
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

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 1.4, amp = 0.5, veins = 1.0): T {
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
// Smooth tri-planar blending based on object normal
vec3 aw = abs(vObjN);
aw = pow(aw, vec3(3.0));
aw /= (aw.x + aw.y + aw.z + 1e-4);

float scale = 0.35 * uK;
vec2 uvX = vP.zy * scale;
vec2 uvY = vP.xz * scale + vec2(0.33, 0.17);
vec2 uvZ = vP.xy * scale + vec2(0.67, 0.53);

vec4 tX = texture2D(uTissueTex, uvX);
vec4 tY = texture2D(uTissueTex, uvY);
vec4 tZ = texture2D(uTissueTex, uvZ);
vec4 t1 = tX * aw.x + tY * aw.y + tZ * aw.z;

// Fine cellular second pass
vec4 tX2 = texture2D(uTissueTex, uvX * 2.8 + 0.15);
vec4 tY2 = texture2D(uTissueTex, uvY * 2.8 + 0.15);
vec4 tZ2 = texture2D(uTissueTex, uvZ * 2.8 + 0.15);
vec4 t2 = tX2 * aw.x + tY2 * aw.y + tZ2 * aw.z;

float mottle = (t1.g - 0.5) * 1.8;
float micro  = (t2.b - 0.5) * 1.5;
float noiseVal = clamp(mottle * 0.6 + micro * 0.4, -1.0, 1.0);

vec3 base = diffuseColor.rgb;

// Organic anatomical color breakup (cadaveric tan/cream/brown)
vec3 creviceColor = base * vec3(0.42, 0.30, 0.25);  // Deep brown in sulci
vec3 fleshColor   = base * vec3(1.05, 0.92, 0.82);  // Main tissue tan
vec3 crownColor   = base * vec3(1.38, 1.22, 1.08);  // Pale cream on gyrus tops
vec3 coolTone     = base * vec3(0.90, 0.88, 0.96);  // Subdermal undertone

float crownMask = smoothstep(0.15, 0.75, noiseVal);
float darkMask  = 1.0 - smoothstep(-0.6, 0.1, noiseVal);

vec3 tone = mix(fleshColor, coolTone, 0.2);
tone = mix(tone, creviceColor, darkMask * 0.8);
tone = mix(tone, crownColor, crownMask * 0.65);

// Apply subtle micro-variation
tone *= (0.92 + 0.20 * micro);

diffuseColor.rgb = mix(base, tone, clamp(uAmp * 1.2, 0.0, 1.0));

// Vascular capillary branches
float vesselMask = clamp(t1.r * 1.8 * uVeins, 0.0, 1.0);
vec3 vesselColor = mix(diffuseColor.rgb * vec3(0.65, 0.20, 0.18), vec3(0.32, 0.06, 0.06), vesselMask);
diffuseColor.rgb = mix(diffuseColor.rgb, vesselColor, vesselMask * 0.65);

// Deep sulcus crevice darkening based on orientation
float sulcusShadow = smoothstep(0.1, 0.85, abs(vObjN.y));
diffuseColor.rgb *= mix(0.6, 1.0, sulcusShadow);
`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
// Gyrus crowns are slightly wetter, crevices matte
float wetness = smoothstep(0.0, 0.8, noiseVal);
roughnessFactor = clamp(roughnessFactor - wetness * 0.12 + (1.0 - sulcusShadow) * 0.15, 0.40, 0.85);
`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// Subsurface scattering warmth at light transitions
vec3 lightTot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float lightLum = dot(lightTot, vec3(0.299, 0.587, 0.114));
float terminator = smoothstep(0.01, 0.20, lightLum) * (1.0 - smoothstep(0.20, 0.70, lightLum));
reflectedLight.directDiffuse += vec3(0.18, 0.04, 0.02) * diffuseColor.rgb * terminator * 0.8;
`
      )
  }

  m.customProgramCacheKey = () => `organic-clean-v5-${k}-${amp}-${veins}`
  return m
}