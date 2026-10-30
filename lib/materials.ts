import * as THREE from 'three'
// Gentle, LOW-frequency tonal + roughness variation only. (The earlier version perturbed normals from screen-space derivatives of high-frequency noise and
// multiplied colour by thresholded noise: both read as black speckle. Removed.)
export function organic<T extends THREE.MeshPhysicalMaterial>(m: T, k = 110, amp = 0.12): T {
  console.log('[ORGANIC MAT CREATED]', performance.now().toFixed(0) + 'ms', m.uuid)
  m.onBeforeCompile = (s) => {
    s.uniforms.uK = { value: k }
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;')
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vP; uniform float uK;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat nz = .65*vn(vP*uK) + .35*vn(vP*uK*2.1); diffuseColor.rgb *= ${(1 - amp / 2).toFixed(3)} + ${amp.toFixed(3)}*nz;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (nz-.5)*.22, .4, 1.);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat fres = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 3.); totalEmissiveRadiance += vec3(.1,.035,.03) * fres * .35;')
  }
  m.customProgramCacheKey = () => `organic${k}-${amp}-${m.uuid}`
  return m
}