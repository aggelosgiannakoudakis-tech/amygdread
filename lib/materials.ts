import * as THREE from 'three'

export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 110, amp = 0.12): T {
  m.onBeforeCompile = (s) => {
    s.uniforms.uK = { value: k }
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;')

    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vP; uniform float uK;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Only 3 fast noise lookups total (domain-warped for organic veins at zero FPS cost)
float n1 = vn(vP * (uK * 0.35));
float n2 = vn(vP * uK + n1 * 1.4);
float n3 = vn(vP * (uK * 2.2) - n2 * 1.2);
float nz = 0.55 * n1 + 0.30 * n2 + 0.15 * n3;

// Isolate pink/grey brain tissue from the yellow nerves
float isTissue = smoothstep(0.04, 0.11, diffuseColor.r - diffuseColor.g);

// Subtle grey-matter vs oxygenated pink-matter variation
vec3 greyMatter = diffuseColor.rgb * vec3(0.95, 0.97, 1.00);
vec3 pinkMatter = diffuseColor.rgb * vec3(1.07, 0.89, 0.85);
diffuseColor.rgb = mix(diffuseColor.rgb, mix(greyMatter, pinkMatter, n1), isTissue * 0.7);
diffuseColor.rgb *= ${(1 - amp / 2).toFixed(3)} + ${amp.toFixed(3)} * nz;

// Branching crimson pia-mater veins & fine capillaries
float vMain = smoothstep(0.042, 0.003, abs(n2 - 0.5));
float vFine = smoothstep(0.050, 0.004, abs(n3 - 0.5)) * smoothstep(0.35, 0.75, n1);
float vein = clamp((vMain * 0.75 + vFine * 0.45) * isTissue, 0.0, 1.0);
vec3 veinCol = mix(diffuseColor.rgb * vec3(0.55, 0.18, 0.20), vec3(0.22, 0.015, 0.025), smoothstep(0.2, 0.85, vein));
diffuseColor.rgb = mix(diffuseColor.rgb, veinCol, vein * 0.68);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (nz - 0.5) * 0.22 - vein * 0.12, 0.42, 0.92);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
// Deep fold vascular shadow inside the creases + subsurface scatter
float ndv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
float crease = pow(1.0 - ndv, 2.2);
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.16, 0.17), crease * 0.55 * isTissue);
float fres = pow(1.0 - ndv, 3.0);
totalEmissiveRadiance += vec3(0.1, 0.032, 0.028) * fres * 0.35;`
      )
  }
  m.customProgramCacheKey = () => `organic-safe-${k}-${amp}`
  return m
}