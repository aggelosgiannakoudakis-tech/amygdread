// lib/materials.ts
import * as THREE from 'three'

let cachedTex: THREE.CanvasTexture | null = null

function getTissueTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (cachedTex) return cachedTex

  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = 'rgb(128, 128, 128)'
  ctx.fillRect(0, 0, size, size)

  let seed = 9182
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  const drawWrapped = (fn: (ox: number, oy: number) => void) => {
    for (let ox = -size; ox <= size; ox += size)
      for (let oy = -size; oy <= size; oy += size)
        fn(ox, oy)
  }

  const drawVessel = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || width < 0.3) return
    const steps = 16
    const stepLen = len / steps
    let cx = x, cy = y, ca = angle, curv = (rand() - 0.5) * 0.28
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const w = width * (1 - t * 0.25)
      ca += curv + (rand() - 0.5) * 0.32
      curv = curv * 0.72 + (rand() - 0.5) * 0.18
      const nx = cx + Math.cos(ca) * stepLen
      const ny = cy + Math.sin(ca) * stepLen
      drawWrapped((ox, oy) => {
        ctx.lineCap = 'round'
        ctx.strokeStyle = `rgba(220, 40, 35, ${Math.min(0.6, w * 0.15)})`
        ctx.lineWidth = w * 3.2
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke()
        ctx.strokeStyle = `rgba(255, 80, 70, ${Math.min(0.95, 0.5 + w * 0.3)})`
        ctx.lineWidth = w
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy); ctx.lineTo(nx + ox, ny + oy); ctx.stroke()
      })
      cx = ((nx % size) + size) % size
      cy = ((ny % size) + size) % size
      if ((i === 4 || i === 9 || i === 13) && rand() < 0.82) {
        const dir = rand() < 0.5 ? 1 : -1
        drawVessel(cx, cy, ca + dir * (0.45 + rand() * 0.45), len * 0.62, w * 0.62, depth - 1)
      }
    }
  }

  for (let i = 0; i < 42; i++)
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 100 + rand() * 90, 2.8 + rand() * 2.0, 4)
  for (let i = 0; i < 110; i++)
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 40 + rand() * 50, 1.0 + rand() * 0.9, 2)

  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const tau = Math.PI * 2

  for (let y = 0; y < size; y++) {
    const vy = (y / size) * tau
    for (let x = 0; x < size; x++) {
      const ux = (x / size) * tau
      const idx = (y * size + x) * 4

      const macro =
        Math.sin(ux * 1.8 + Math.cos(vy * 2.1)) * 0.45 +
        Math.cos(ux * 3.2 - Math.sin(vy * 2.6)) * 0.35 +
        Math.sin((ux + vy) * 4.1) * 0.20
      const mid =
        Math.sin(ux * 8.5 + Math.cos(vy * 7.2)) * 0.35 +
        Math.cos(ux * 13.1 - Math.sin(vy * 11.4)) * 0.30 +
        Math.sin((ux - vy) * 15.8) * 0.25
      const micro =
        Math.sin(ux * 33 + Math.cos(vy * 37)) * 0.40 +
        Math.cos(ux * 59 - Math.sin(vy * 53)) * 0.35 +
        Math.sin((ux + vy) * 107) * 0.25

      const mottle = macro * 0.45 + mid * 0.35 + micro * 0.20

      d[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + mottle * 125)))
      d[idx + 2] = Math.max(0, Math.min(255, Math.round(128 + micro * 115)))
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

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 1.8, amp = 0.65, veins = 1.0): T {
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
vec3 aw = abs(vObjN);
aw = pow(aw, vec3(4.0));
aw /= (aw.x + aw.y + aw.z + 1e-4);

float scale = 0.45 * uK;
vec2 uvX = vP.zy * scale;
vec2 uvY = vP.xz * scale + vec2(0.33, 0.17);
vec2 uvZ = vP.xy * scale + vec2(0.67, 0.53);

vec4 tX = texture2D(uTissueTex, uvX);
vec4 tY = texture2D(uTissueTex, uvY);
vec4 tZ = texture2D(uTissueTex, uvZ);
vec4 t1 = tX * aw.x + tY * aw.y + tZ * aw.z;

vec4 tX2 = texture2D(uTissueTex, uvX * 3.2 + 0.19);
vec4 tY2 = texture2D(uTissueTex, uvY * 3.2 + 0.19);
vec4 tZ2 = texture2D(uTissueTex, uvZ * 3.2 + 0.19);
vec4 t2 = tX2 * aw.x + tY2 * aw.y + tZ2 * aw.z;

float mottle = (t1.g - 0.5) * 2.0;
float micro  = (t2.b - 0.5) * 1.6;
float noiseVal = clamp(mottle * 0.6 + micro * 0.4, -1.0, 1.0);

vec3 base = diffuseColor.rgb;

// Organic grain modulation preserving individual layer colors (black cortex vs vivid red nerves)
float grain = 0.82 + 0.36 * (noiseVal * 0.5 + 0.5);

// Sulcus fold shadow
float sulcusShadow = smoothstep(0.05, 0.80, abs(vObjN.y));

// Apply grain modulation onto base layer color
diffuseColor.rgb = base * grain;

// Deep crevice ambient occlusion
diffuseColor.rgb *= mix(0.35, 1.0, sulcusShadow);
`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float wetness = smoothstep(0.1, 0.85, noiseVal);
roughnessFactor = clamp(roughnessFactor - wetness * 0.22 + (1.0 - sulcusShadow) * 0.15, 0.25, 0.85);
`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
vec3 lightTot = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float lightLum = dot(lightTot, vec3(0.299, 0.587, 0.114));
float terminator = smoothstep(0.01, 0.22, lightLum) * (1.0 - smoothstep(0.22, 0.68, lightLum));
reflectedLight.directDiffuse += vec3(0.25, 0.04, 0.03) * diffuseColor.rgb * terminator * 0.8;
`
      )
  }

  m.customProgramCacheKey = () => `organic-black-red-v2-${k}-${amp}-${veins}`
  return m
}