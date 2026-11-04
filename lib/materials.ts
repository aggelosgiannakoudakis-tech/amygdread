// lib/materials.ts
import * as THREE from 'three';

export const materials = {
  organic: () => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e5d1c5'),
      roughness: 0.55,
      metalness: 0.05,
      reflectivity: 0.5,
      clearcoat: 0.45,
      clearcoatRoughness: 0.25,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffccaa'),
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        `#include <common>`,
        `#include <common>
         varying vec3 vWPos;
         varying vec3 vWNorm;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        `#include <beginnormal_vertex>`,
        `#include <beginnormal_vertex>
         vWNorm = normalize(mat3(instanceMatrix) * mat3(modelMatrix) * objectNormal);`
      );
      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
         vWPos = (instanceMatrix * modelMatrix * vec4(position, 1.0)).xyz;`
      );

      shader.fragmentShader = `
        varying vec3 vWPos;
        varying vec3 vWNorm;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          vec4 j = p - 49.0 * floor(p * (1.0/49.0));
          vec4 x = floor(j * (1.0/7.0)) * (1.0/7.0) * 2.0 - 1.1;
          vec4 y = (j - 7.0 * floor(j * (1.0/7.0))) * (1.0/7.0) * 2.0 - 1.1;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          return 42.0 * dot(m*m*m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <map_fragment>`,
        `
        #include <map_fragment>
        vec3 p = vWPos * 3.5;
        float n1 = snoise(p);
        float n2 = snoise(p * 4.4 + 13.0);
        float n3 = snoise(p * 18.0);

        vec3 cTan = vec3(0.88, 0.78, 0.72);
        vec3 cFlesh = vec3(0.65, 0.48, 0.42);
        vec3 cDeep = vec3(0.42, 0.25, 0.22);
        vec3 cVein = vec3(0.45, 0.15, 0.12);

        vec3 tissue = mix(cFlesh, cTan, smoothstep(-0.3, 0.4, n1));
        tissue = mix(tissue, cDeep, smoothstep(0.2, 0.8, n2));
        tissue = mix(tissue, cVein, smoothstep(0.75, 0.8, abs(n3)) * 0.4);

        float sulcus = smoothstep(0.1, 0.85, abs(vWNorm.y));
        tissue *= mix(0.5, 1.0, sulcus);

        diffuseColor.rgb = tissue;
        `
      );
    };

    mat.customProgramCacheKey = () => 'photo-organic-v200';
    return mat;
  }
};