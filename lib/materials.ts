// lib/materials.ts
import * as THREE from 'three'

let cachedAlbedoTex: THREE.Texture | null = null

function getAlbedoTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture()
  if (cachedAlbedoTex) return cachedAlbedoTex

  const loader = new THREE.TextureLoader()
  const tex = loader.load(
    '/textures/brain_albedo.jpg',
    (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.needsUpdate = true
    },
    undefined,
    () => {
      // Graceful fallback if image is loading or missing
    }
  )
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  cachedAlbedoTex = tex
  return tex
}

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 2.4, amp = 0.45, veins = 1.0): T {
  const tex = getAlbedoTexture()

  m.onBeforeCompile = (shader) => {
    shader.uniforms.uK = { value: k }
    shader.uniforms.uAmp = { value: amp }
    shader.uniforms.uAlbedoTex = { value: tex }

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
uniform float uK;
uniform float uAmp;
uniform sampler2D uAlbedoTex;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Tri-planar photo texture projection across all shattered pieces
vec3 aw = abs(vWorldNormal);
aw = pow(aw, vec3(4.0));
aw /= (aw.x + aw.y + aw.z + 1e-4);

float texScale = 0.28 * uK;
vec2 uvX = vWorldPos.zy * texScale;
vec2 uvY = vWorldPos.xz * texScale;
vec2 uvZ = vWorldPos.xy * texScale;

vec4 colX = texture2D(uAlbedoTex, uvX);
vec4 colY = texture2D(uAlbedoTex, uvY);
vec4 colZ = texture2D(uAlbedoTex, uvZ);

vec3 photoColor = colX.rgb * aw.x + colY.rgb * aw.y + colZ.rgb * aw.z;

// Multiply photo texture color into diffuse
if (length(photoColor) > 0.05) {
  diffuseColor.rgb = photoColor * diffuseColor.rgb * 1.35;
}

// Biological sulcus shading in crevices
float sulcus = smoothstep(0.08, 0.85, abs(vWorldNormal.y));
diffuseColor.rgb *= mix(0.55, 1.0, sulcus);
`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float photoLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
roughnessFactor = clamp(roughnessFactor * mix(0.75, 1.15, photoLum), 0.35, 0.85);
`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// Surface bumps derived from the photo texture
float hX = texture2D(uAlbedoTex, uvX + vec2(0.004, 0.0)).r - texture2D(uAlbedoTex, uvX - vec2(0.004, 0.0)).r;
float hY = texture2D(uAlbedoTex, uvY + vec2(0.004, 0.0)).r - texture2D(uAlbedoTex, uvY - vec2(0.004, 0.0)).r;
float hZ = texture2D(uAlbedoTex, uvZ + vec2(0.004, 0.0)).r - texture2D(uAlbedoTex, uvZ - vec2(0.004, 0.0)).r;

vec2 bump = vec2(hX * aw.x + hY * aw.y, hZ * aw.z) * (1.8 * uAmp);
normal = normalize(normal + vec3(bump.x, bump.y, 0.0));
`
      )
  }

  m.customProgramCacheKey = () => `photo-organic-${k}-${amp}-${veins}`
  return m
}