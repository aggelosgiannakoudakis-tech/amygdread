import * as THREE from 'three'

let cachedTex: THREE.CanvasTexture | null = null

// Pre-bakes a 1024x1024 anatomical tissue + micro-bump normal + gyrus mottling texture ONCE on startup (0 runtime FPS cost)
function getTissueTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (cachedTex) return cachedTex

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Base fill: R = veins/mottle, G = 128 (normal X), B = 128 (normal Y), A = tissue density
  ctx.fillStyle = 'rgb(0, 128, 128)'
  ctx.fillRect(0, 0, size, size)

  // Deterministic PRNG
  let seed = 4219
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const drawWrapped = (fn: (ox: number, oy: number) => void) => {
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        fn(ox, oy)
      }
    }
  }

  // Meandering anatomical pia-mater blood vessels
  const drawVessel = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || width < 0.35) return
    const steps = 14
    const stepLen = len / steps
    let cx = x
    let cy = y
    let ca = angle
    let curv = (rand() - 0.5) * 0.25

    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const w = width * (1 - t * 0.28)
      ca += curv + (rand() - 0.5) * 0.32
      curv = curv * 0.75 + (rand() - 0.5) * 0.18
      const nx = cx + Math.cos(ca) * stepLen
      const ny = cy + Math.sin(ca) * stepLen

      drawWrapped((ox, oy) => {
        ctx.lineCap = 'round'
        ctx.strokeStyle = `rgba(180, 100, 90, ${Math.min(0.35, w * 0.07)})`
        ctx.lineWidth = w * 3.2
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.lineTo(nx + ox, ny + oy)
        ctx.stroke()

        ctx.strokeStyle = `rgba(255, 120, 110, ${Math.min(0.95, 0.45 + w * 0.2)})`
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.lineTo(nx + ox, ny + oy)
        ctx.stroke()
      })

      cx = ((nx % size) + size) % size
      cy = ((ny % size) + size) % size

      if ((i === 5 || i === 10) && rand() < 0.78) {
        const dir = rand() < 0.5 ? 1 : -1
        drawVessel(cx, cy, ca + dir * (0.42 + rand() * 0.45), len * 0.66, w * 0.64, depth - 1)
      }
    }

    const dir = rand() < 0.5 ? 1 : -1
    drawVessel(cx, cy, ca + dir * (0.28 + rand() * 0.32), len * 0.74, width * 0.68, depth - 1)
    if (rand() < 0.75) {
      drawVessel(cx, cy, ca - dir * (0.32 + rand() * 0.38), len * 0.64, width * 0.58, depth - 1)
    }
  }

  for (let i = 0; i < 38; i++) {
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 130 + rand() * 90, 3.6 + rand() * 1.8, 5)
  }
  for (let i = 0; i < 95; i++) {
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 55 + rand() * 45, 1.3 + rand() * 0.8, 3)
  }

  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const hMap = new Float32Array(size * size)
  const tau = Math.PI * 2

  for (let y = 0; y < size; y++) {
    const v = (y / size) * tau
    for (let x = 0; x < size; x++) {
      const u = (x / size) * tau
      const idx = y * size + x
      const vein = d[idx * 4] / 255

      // Multi-scale anatomical cellular grain and gyrus tissue mottling
      const mottle =
        Math.sin(u * 2 + Math.cos(v * 2.5)) * 0.35 +
        Math.cos(u * 5 - Math.sin(v * 4.5)) * 0.28 +
        Math.sin((u + v) * 8) * 0.18 +
        Math.cos((u - v) * 14) * 0.12
      const pores =
        Math.sin(u * 23 + Math.cos(v * 27)) * 0.35 +
        Math.cos(u * 47 - Math.sin(v * 41)) * 0.25 +
        Math.sin((u - v) * 79) * 0.20

      hMap[idx] = pores * 0.22 + mottle * 0.35 + Math.pow(vein, 1.2) * 0.8
      d[idx * 4 + 3] = Math.max(0, Math.min(255, Math.round(128 + mottle * 115)))
    }
  }

  const mask = size - 1
  for (let y = 0; y < size; y++) {
    const yn = (y + 1) & mask
    const yp = (y - 1 + size) & mask
    for (let x = 0; x < size; x++) {
      const xn = (x + 1) & mask
      const xp = (x - 1 + size) & mask
      const idx = y * size + x
      const dx = (hMap[y * size + xn] - hMap[y * size + xp]) * 0.5
      const dy = (hMap[yn * size + x] - hMap[yp * size + x]) * 0.5
      d[idx * 4 + 1] = Math.max(0, Math.min(255, Math.round(128 + dx * 160)))
      d[idx * 4 + 2] = Math.max(0, Math.min(255, Math.round(128 + dy * 160)))
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 4
  tex.needsUpdate = true
  cachedTex = tex
  return tex
}

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 1.2, amp = 0.22, veins = 1.0): T {
  const tex = getTissueTexture()

  m.onBeforeCompile = (s) => {
    s.uniforms.uK = { value: k }
    s.uniforms.uVeins = { value: veins }
    s.uniforms.uTissueTex = { value: tex }

    s.vertexShader = s.vertexShader
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

    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP;
varying vec3 vObjN;
uniform float uK;
uniform float uVeins;
uniform sampler2D uTissueTex;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Seamless tri-planar projection scaled to the brain's physical dimensions
vec3 aw = abs(vObjN);
aw = pow(aw, vec3(2.0));
aw /= (aw.x + aw.y + aw.z + 0.0001);

vec2 uvA = vP.xy * (uK * 0.35) + vP.z * (uK * 0.12);
vec2 uvB = vP.zy * (uK * 0.35) + vP.x * (uK * 0.12) + vec2(0.41, 0.67);
vec2 uvC = vP.xz * (uK * 0.35) + vP.y * (uK * 0.12) + vec2(0.19, 0.83);

vec4 tA = texture2D(uTissueTex, uvA);
vec4 tB = texture2D(uTissueTex, uvB);
vec4 tC = texture2D(uTissueTex, uvC);
vec4 tMacro = tA * aw.z + tB * aw.x + tC * aw.y;

vec4 tA_micro = texture2D(uTissueTex, uvA * 2.8 + 0.31);
vec4 tB_micro = texture2D(uTissueTex, uvB * 2.8 + 0.31);
vec4 tC_micro = texture2D(uTissueTex, uvC * 2.8 + 0.31);
vec4 tMicro = tA_micro * aw.z + tB_micro * aw.x + tC_micro * aw.y;

float nz = mix(tMacro.a, tMicro.a, 0.4);

// Preserved anatomical tissue coloration: warm specimen brown/tan base with creamy pial highlights
vec3 baseCol = diffuseColor.rgb;
vec3 darkGrain = baseCol * vec3(0.55, 0.45, 0.40);
vec3 warmTan = baseCol * vec3(1.25, 1.10, 0.95);
vec3 creamCrown = baseCol * vec3(1.45, 1.30, 1.15);

float mettleNoise = smoothstep(0.15, 0.85, nz);
vec3 tissueTone = mix(darkGrain, warmTan, mettleNoise);
tissueTone = mix(tissueTone, creamCrown, pow(nz, 2.2) * 0.45);

diffuseColor.rgb = mix(baseCol, tissueTone, uVeins * 0.90);

// Branching crimson pia-mater blood vessels & fine capillaries
float vBig = smoothstep(0.22, 0.75, tMacro.r);
float vCap = smoothstep(0.25, 0.80, tMicro.r) * (0.35 + 0.65 * tMacro.a);
float veinMask = clamp((vBig * 0.75 + vCap * 0.40) * uVeins, 0.0, 1.0);

vec3 subPialRed = diffuseColor.rgb * vec3(0.65, 0.22, 0.20);
vec3 deepVenous = vec3(0.25, 0.04, 0.04);
vec3 vesselCol = mix(subPialRed, deepVenous, smoothstep(0.3, 0.85, veinMask));
diffuseColor.rgb = mix(diffuseColor.rgb, vesselCol, veinMask * 0.65);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
// Natural preserved organic tissue roughness (satin finish, soft highlights over gyri)
roughnessFactor = clamp(roughnessFactor + (0.5 - nz) * 0.15 - veinMask * 0.10, 0.55, 0.82);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// Micro-bump normal map giving realistic anatomical depth to gyrus surface folds
vec2 bump = ((tMacro.gb - 0.5) * 0.6 + (tMicro.gb - 0.5) * 0.35) * (0.25 + 0.3 * uVeins);
normal = normalize(normal + vec3(bump.x, bump.y, 0.0));

// Subtle crevice ambient occlusion
float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
float foldCrease = pow(1.0 - ndv, 2.0);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45, foldCrease * 0.45 * uVeins);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// Subsurface Blood Scattering (SSS): warm crimson translucency along light/shadow edges
vec3 totLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float lum = dot(totLight, vec3(0.299, 0.587, 0.114));
float sssBand = smoothstep(0.01, 0.22, lum) * (1.0 - smoothstep(0.22, 0.85, lum));
reflectedLight.directDiffuse += vec3(0.26, 0.032, 0.025) * diffuseColor.rgb * sssBand * (0.35 + 0.65 * uVeins);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.2);
totalEmissiveRadiance += vec3(0.08, 0.022, 0.02) * fres * 0.30;`
      )
  }
  m.customProgramCacheKey = () => `organic-real-${k}-${amp}-${veins}`
  return m
}