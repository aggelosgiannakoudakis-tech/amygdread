import * as THREE from 'three'

// Hyper-realistic biological tissue shader:
// 1. Multi-scale grey/pink matter mottling
// 2. 3D domain-warped branching pia mater veins & micro-capillaries
// 3. Speckle-free analytical 3D micro-relief normal perturbation
// 4. Subsurface blood scattering (SSS) at shadow terminators
export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 110, amp = 0.12): T {
  m.onBeforeCompile = (s) => {
    s.uniforms.uK = { value: k }

    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vFwd;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vP = position;
vRight = normalize(normalMatrix[0]);
vUp = normalize(normalMatrix[1]);
vFwd = normalize(normalMatrix[2]);`
      )

    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vFwd;
uniform float uK;

float h3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vn(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x),
        mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x),
        mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float organicHeight(vec3 p) {
  float base = 0.55 * vn(p * 0.45) + 0.30 * vn(p * 1.15) + 0.15 * vn(p * 2.5);
  vec3 wp = p * 0.38 + 0.55 * vec3(vn(p * 0.18), vn(p * 0.18 + 11.7), vn(p * 0.18 + 23.4));
  float r1 = abs(vn(wp) - 0.5);
  float vGroove = smoothstep(0.055, 0.0, r1);
  return base - vGroove * 0.16;
}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec3 pOrg = vP * uK;

// Automatically distinguish cortex/tissue from yellow nerves and dark arteries
float isNerve = smoothstep(0.02, 0.08, diffuseColor.g - diffuseColor.b) * smoothstep(0.28, 0.12, diffuseColor.r - diffuseColor.g);
float isVessel = smoothstep(0.06, 0.18, diffuseColor.r - diffuseColor.g * 2.2);
float isTissue = clamp(1.0 - isNerve * 0.85 - isVessel * 0.75, 0.0, 1.0);

// 1. Multi-scale biological mottling (oxygenated pink-rose vs pale grey matter)
float nMacro = vn(pOrg * 0.16);
float nMid   = vn(pOrg * 0.48);
float nFine  = vn(pOrg * 1.35);
float nz     = 0.50 * nMacro + 0.32 * nMid + 0.18 * nFine;

vec3 warmFlesh = diffuseColor.rgb * vec3(1.07, 0.92, 0.89);
vec3 coolGrey  = diffuseColor.rgb * vec3(0.95, 0.98, 1.01);
diffuseColor.rgb = mix(coolGrey, warmFlesh, smoothstep(0.28, 0.72, nMacro));
diffuseColor.rgb *= ${(1 - amp * 0.55).toFixed(3)} + ${(amp * 1.1).toFixed(3)} * nz;

// 2. Branching 3D Pia Mater Capillary & Vein Network
vec3 wp1 = pOrg * 0.38 + 0.55 * vec3(vn(pOrg * 0.18), vn(pOrg * 0.18 + 11.7), vn(pOrg * 0.18 + 23.4));
float r1 = abs(vn(wp1) - 0.5);
float r2 = abs(vn(wp1 * 1.85 + 7.3) - 0.5);
float vMain = smoothstep(0.040, 0.004, r1 + r2 * 0.36);

vec3 wp2 = pOrg * 0.95 + 0.42 * vec3(vn(pOrg * 0.42 + 5.1), vn(pOrg * 0.42 + 19.3), vn(pOrg * 0.42 + 37.9));
float r3 = abs(vn(wp2) - 0.5);
float r4 = abs(vn(wp2 * 2.05 + 13.1) - 0.5);
float vCap = smoothstep(0.034, 0.003, r3 + r4 * 0.42);

float vBed = smoothstep(0.22, 0.75, vn(pOrg * 0.14 + 3.7));
float veinMask = clamp((vMain * 0.75 + vCap * 0.45 * vBed) * isTissue, 0.0, 1.0);

vec3 veinHalo = diffuseColor.rgb * vec3(0.68, 0.28, 0.28);
vec3 veinCore = vec3(0.18, 0.018, 0.022);
diffuseColor.rgb = mix(diffuseColor.rgb, veinHalo, smoothstep(0.0, 0.55, veinMask) * 0.62);
diffuseColor.rgb = mix(diffuseColor.rgb, veinCore, smoothstep(0.35, 0.95, veinMask) * 0.52);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
// 3. Speckle-free analytical 3D micro-relief normal perturbation
float fw = max(length(fwidth(pOrg)), 0.001);
float detailFade = 1.0 / (1.0 + fw * 3.5);
float grazeFade = smoothstep(0.08, 0.35, abs(dot(normal, normalize(vViewPosition))));
float eps = 0.065;
float h0 = organicHeight(pOrg);
vec3 grad3D = vec3(
  organicHeight(pOrg + vec3(eps, 0.0, 0.0)) - h0,
  organicHeight(pOrg + vec3(0.0, eps, 0.0)) - h0,
  organicHeight(pOrg + vec3(0.0, 0.0, eps)) - h0
) / eps;
vec3 viewGrad = grad3D.x * vRight + grad3D.y * vUp + grad3D.z * vFwd;
viewGrad -= normal * dot(viewGrad, normal);
viewGrad = clamp(viewGrad, vec3(-0.32), vec3(0.32));
normal = normalize(normal - viewGrad * 0.22 * detailFade * grazeFade);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
// Matte-satin biological finish: minimum roughness clamped at 0.48 so it never looks like baby oil
roughnessFactor = clamp(roughnessFactor + (0.5 - nz) * 0.16 - veinMask * 0.12, 0.48, 0.92);`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
// 4. Subsurface Scattering (SSS): warm blood-red scatter through shadow terminators
vec3 totDiff = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
float diffLum = dot(totDiff, vec3(0.299, 0.587, 0.114));
float sssZone = smoothstep(0.0, 0.18, diffLum) * (1.0 - smoothstep(0.18, 0.75, diffLum));
vec3 sssColor = vec3(0.38, 0.05, 0.04) * diffuseColor.rgb;
reflectedLight.directDiffuse += sssColor * sssZone * (0.55 * isTissue + 0.15);

// 5. Deep fold vascular shadow occlusion
float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
float foldCrease = pow(1.0 - ndv, 2.2);
vec3 creaseTint = mix(vec3(1.0), vec3(0.58, 0.24, 0.24), foldCrease * 0.42 * isTissue);
reflectedLight.directDiffuse *= creaseTint;
reflectedLight.indirectDiffuse *= creaseTint;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.2);
totalEmissiveRadiance += vec3(0.08, 0.025, 0.022) * fres * 0.28;`
      )
  }
  m.customProgramCacheKey = () => `organic-v2-${k}-${amp}`
  return m
}