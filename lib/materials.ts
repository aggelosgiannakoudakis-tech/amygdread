import * as THREE from 'three'

let cachedTex: THREE.CanvasTexture | null = null

// Pre-bakes a 1024x1024 seamless vascular + micro-bump normal + mottling texture ONCE on startup (0 runtime FPS cost)
function getTissueTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (cachedTex) return cachedTex

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Base fill: R = 0 (veins), G = 128 (normal X), B = 128 (normal Y), A = 255
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

  // Recursive meandering anatomical blood vessels (encoded into Red channel)
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
        // Soft perivascular subsurface halo
        ctx.strokeStyle = `rgba(190, 128, 128, ${Math.min(0.32, w * 0.065)})`
        ctx.lineWidth = w * 3.6
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.lineTo(nx + ox, ny + oy)
        ctx.stroke()

        // Crisp vessel lumen
        ctx.strokeStyle = `rgba(255, 128, 128, ${Math.min(0.95, 0.42 + w * 0.18)})`
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.lineTo(nx + ox, ny + oy)
        ctx.stroke()
      })

      cx = ((nx % size) + size) % size
      cy = ((ny % size) + size) % size

      // Side arterioles / venules
      if ((i === 5 || i === 10) && rand() < 0.78) {
        const dir = rand() < 0.5 ? 1 : -1
        drawVessel(cx, cy, ca + dir * (0.42 + rand() * 0.45), len * 0.66, w * 0.64, depth - 1)
      }
    }

    // Terminal bifurcation
    const dir = rand() < 0.5 ? 1 : -1
    drawVessel(cx, cy, ca + dir * (0.28 + rand() * 0.32), len * 0.74, width * 0.68, depth - 1)
    if (rand() < 0.75) {
      drawVessel(cx, cy, ca - dir * (0.32 + rand() * 0.38), len * 0.64, width * 0.58, depth - 1)
    }
  }

  // 1. Primary pia mater vascular trees
  for (let i = 0; i < 38; i++) {
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 130 + rand() * 90, 3.6 + rand() * 1.8, 5)
  }
  // 2. Dense fine capillary bed
  for (let i = 0; i < 95; i++) {
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 55 + rand() * 45, 1.3 + rand() * 0.8, 3)
  }

  // 3. Bake 3D micro-relief normal map (G, B) and organic tissue mottling (A)
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

      // Seamless multi-scale organic cellular grain
      const mottle =
        Math.sin(u * 3 + Math.cos(v * 3)) * 0.35 +
        Math.cos(u * 7 - Math.sin(v * 6)) * 0.25 +
        Math.sin((u + v) * 11) * 0.15
      const pores =
        Math.sin(u * 29 + Math.cos(v * 31)) * 0.35 +
        Math.cos(u * 61 - Math.sin(v * 53)) * 0.25 +
        Math.sin((u - v) * 97) * 0.20

      // Vessels slightly emboss above the cortex; pores create subtle organic dimples
      hMap[idx] = pores * 0.28 + mottle * 0.22 + Math.pow(vein, 1.3) * 0.95
      d[idx * 4 + 3] = Math.max(0, Math.min(255, Math.round(128 + mottle * 110)))
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
      d[idx * 4 + 1] = Math.max(0, Math.min(255, Math.round(128 + dx * 135)))
      d[idx * 4 + 2] = Math.max(0, Math.min(255, Math.round(128 + dy * 135)))
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

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 110, amp = 0.12, veins = 1.0): T {
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
// Seamless bi-planar projection scaled to the brain's physical dimensions
vec3 aw = abs(vObjN);
aw /= (aw.x + aw.y + aw.z + 0.0001);
vec2 uvA = vP.xy * (uK * 0.22) + vP.z * (uK * 0.07);
vec2 uvB = vP.zy * (uK * 0.22) + vP.x * (uK * 0.07) + vec2(0.41, 0.67);
float wA = aw.z + aw.y * 0.5;
float wB = aw.x + aw.y * 0.5;

// Two-octave hardware texture lookup (macro vessels + fine capillary bed, 0 procedural noise cost)
vec4 tMacro = texture2D(uTissueTex, uvA * 0.52) * wA + texture2D(uTissueTex, uvB * 0.52) * wB;
vec4 tMicro = texture2D(uTissueTex, uvA * 1.45 + 0.23) * wA + texture2D(uTissueTex, uvB * 1.45 + 0.23) * wB;

float nz = mix(tMacro.a, tMicro.a, 0.35);

// 1. Living/preserved grey-matter & oxygenated pink-matter tonal variation
vec3 coolGrey = diffuseColor.rgb * vec3(0.94, 0.96, 1.02);
vec3 warmPink = diffuseColor.rgb * vec3(1.10, 0.86, 0.82);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(coolGrey, warmPink, tMacro.a), uVeins * 0.75);
diffuseColor.rgb *= ${(1 - amp * 0.6).toFixed(3)} + ${(amp * 1.2).toFixed(3)} * nz;

// 2. Branching crimson pia-mater blood vessels & fine capillaries
float vBig = smoothstep(0.12, 0.78, tMacro.r);
float vCap = smoothstep(0.16, 0.82, tMicro.r) * (0.45 + 0.55 * tMacro.a);
float veinMask = clamp((vBig * 0.85 + vCap * 0.50) * uVeins, 0.0, 1.0);

vec3 subPialRed = diffuseColor.rgb * vec3(0.52, 0.14, 0.16);
vec3 deepVenous = vec3(0.16, 0.008, 0.015);
vec3 vesselCol = mix(subPialRed, deepVenous, smoothstep(0.25, 0.85, veinMask));
diffuseColor.rgb = mix(diffuseColor.rgb, vesselCol, veinMask * 0.82);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
// Vessels and moist sulci are glossier; tissue crowns have natural organic micro-roughness
roughnessFactor = clamp(roughnessFactor + (0.5 - nz) * 0.18 - veinMask * 0.22, 0.32, 0.88);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// 3. 3D raised vessel & cellular micro-bump normal map
vec2 bump = ((tMacro.gb - 0.5) * 0.65 + (tMicro.gb - 0.5) * 0.45) * (0.15 + 0.28 * uVeins);
normal = normalize(normal + vec3(bump.x, bump.y, 0.0));

// 4. Deep anatomical sulcus/crease darkening (dark crimson pooled blood inside the folds)
float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
float foldCrease = pow(1.0 - ndv, 2.15);
vec3 sulcusShadow = vec3(0.18, 0.025, 0.035);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * sulcusShadow, foldCrease * 0.72 * uVeins);`
      )
      .replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>
// Break up the wet clearcoat layer with micro-texture so it looks like moist tissue, NOT baby oil
clearcoatNormal = normalize(clearcoatNormal + vec3(bump.x, bump.y, 0.0) * 0.85);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// 5. Subsurface Blood Scattering (SSS): warm crimson translucency along light/shadow edges
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