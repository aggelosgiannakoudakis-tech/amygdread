import * as THREE from 'three'

let cachedTex: THREE.CanvasTexture | null = null

// Generates a 512x512 seamless vascular + micro-bump texture ONCE on startup (0 runtime FPS cost)
function getTissueTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  if (cachedTex) return cachedTex

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // 1. Neutral base: R = vein mask (0), G = normal X (128), B = normal Y (128)
  ctx.fillStyle = 'rgb(0, 128, 128)'
  ctx.fillRect(0, 0, size, size)

  // Deterministic PRNG so the veins look identical every load
  let seed = 1337
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  // Helper to draw seamlessly across all 512x512 tile edges
  const drawWrapped = (fn: (ox: number, oy: number) => void) => {
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) {
        fn(ox, oy)
      }
    }
  }

  // 2. Recursive branching anatomical vessels & capillaries (encoded in Red channel)
  const drawVessel = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || width < 0.35) return
    const steps = 10
    const stepLen = len / steps
    let cx = x
    let cy = y
    let ca = angle

    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const w = width * (1 - t * 0.32)
      const nx = cx + Math.cos(ca) * stepLen
      const ny = cy + Math.sin(ca) * stepLen
      ca += (rand() - 0.5) * 0.42

      drawWrapped((ox, oy) => {
        ctx.lineCap = 'round'
        // Soft subsurface vessel halo
        ctx.strokeStyle = `rgba(170, 128, 128, ${Math.min(0.28, w * 0.09)})`
        ctx.lineWidth = w * 3.2
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.lineTo(nx + ox, ny + oy)
        ctx.stroke()

        // Sharp capillary core
        ctx.strokeStyle = `rgba(255, 128, 128, ${Math.min(0.85, 0.35 + w * 0.22)})`
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.moveTo(cx + ox, cy + oy)
        ctx.lineTo(nx + ox, ny + oy)
        ctx.stroke()
      })

      cx = ((nx % size) + size) % size
      cy = ((ny % size) + size) % size

      // Natural arterial branching
      if (i === Math.floor(steps * 0.55) && rand() < 0.75) {
        const dir = rand() < 0.5 ? 1 : -1
        drawVessel(cx, cy, ca + dir * (0.45 + rand() * 0.35), len * 0.68, w * 0.65, depth - 1)
      }
    }
    // Terminal fork
    const dir = rand() < 0.5 ? 1 : -1
    drawVessel(cx, cy, ca + dir * (0.3 + rand() * 0.3), len * 0.72, width * 0.68, depth - 1)
    if (rand() < 0.65) {
      drawVessel(cx, cy, ca - dir * (0.35 + rand() * 0.35), len * 0.62, width * 0.58, depth - 1)
    }
  }

  // Spawn primary pia mater vessel trees across the tile
  for (let i = 0; i < 28; i++) {
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 75 + rand() * 55, 2.2 + rand() * 1.1, 4)
  }
  // Fine capillary bed twigs
  for (let i = 0; i < 45; i++) {
    drawVessel(rand() * size, rand() * size, rand() * Math.PI * 2, 35 + rand() * 25, 0.9 + rand() * 0.5, 2)
  }

  // 3. Compute seamless organic micro-bump normals into Green & Blue channels
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  const hMap = new Float32Array(size * size)

  // Fast seamless multi-frequency organic cellular heightmap
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x
      const vein = d[idx * 4] / 255
      const u = (x / size) * Math.PI * 2
      const v = (y / size) * Math.PI * 2
      const cell =
        Math.sin(u * 16 + Math.cos(v * 16)) * 0.35 +
        Math.sin(u * 37 - Math.sin(v * 31)) * 0.25 +
        Math.cos((u + v) * 64) * 0.15
      hMap[idx] = cell * 0.35 - vein * 0.65
    }
  }

  for (let y = 0; y < size; y++) {
    const yn = (y + 1) & (size - 1)
    const yp = (y - 1 + size) & (size - 1)
    for (let x = 0; x < size; x++) {
      const xn = (x + 1) & (size - 1)
      const xp = (x - 1 + size) & (size - 1)
      const idx = y * size + x
      const dx = (hMap[y * size + xn] - hMap[y * size + xp]) * 0.5
      const dy = (hMap[yn * size + x] - hMap[yp * size + x]) * 0.5
      d[idx * 4 + 1] = Math.max(0, Math.min(255, Math.round(128 + dx * 95)))
      d[idx * 4 + 2] = Math.max(0, Math.min(255, Math.round(128 + dy * 95)))
    }
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  cachedTex = tex
  return tex
}

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 110, amp = 0.12): T {
  const tex = getTissueTexture()

  m.onBeforeCompile = (s) => {
    s.uniforms.uK = { value: k }
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
uniform sampler2D uTissueTex;

float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// 1. Low-cost macro tonal variation (1 noise lookup)
float nz = vn(vP * (uK * 0.45));
diffuseColor.rgb *= ${(1 - amp / 2).toFixed(3)} + ${amp.toFixed(3)} * nz;

// 2. Fast hardware-mipmapped capillary & tissue lookup (zero lag)
vec3 aw = abs(vObjN);
aw /= (aw.x + aw.y + aw.z + 0.0001);
vec2 uvXY = vP.xy * (uK * 0.22);
vec2 uvZY = vP.zy * (uK * 0.22) + vec2(0.37, 0.61);
vec3 tSample = texture2D(uTissueTex, uvXY).rgb * (aw.z + aw.y * 0.5) + texture2D(uTissueTex, uvZY).rgb * (aw.x + aw.y * 0.5);

// Apply capillaries only to pink/grey brain tissue, not yellow nerves
float isTissue = smoothstep(0.02, 0.10, diffuseColor.r - diffuseColor.g) * smoothstep(0.45, 0.20, diffuseColor.r - diffuseColor.g);
float vein = tSample.r * isTissue;

// Sub-pial crimson veins
vec3 veinColor = mix(diffuseColor.rgb * vec3(0.58, 0.22, 0.24), vec3(0.22, 0.02, 0.03), smoothstep(0.25, 0.85, vein));
diffuseColor.rgb = mix(diffuseColor.rgb, veinColor, vein * 0.65);

// 3. Natural anatomical crease darkening inside the folds
float viewCrease = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
float foldShadow = smoothstep(0.42, 0.92, viewCrease) * isTissue;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.28, 0.28), foldShadow * 0.48);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec2 bump = (tSample.gb - 0.5) * 0.16;
normal = normalize(normal + vec3(bump.x, bump.y, 0.0));`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (nz - 0.5) * 0.16 - vein * 0.10, 0.45, 0.92);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
totalEmissiveRadiance += vec3(0.09, 0.028, 0.024) * fres * 0.32;`
      )
  }
  m.customProgramCacheKey = () => `organic-fast-${k}-${amp}`
  return m
}