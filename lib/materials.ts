// lib/materials.ts
import * as THREE from 'three';

export const materials = {
  organic: () => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d4b5a0'),
      roughness: 0.55,
      metalness: 0.02,
      reflectivity: 0.5,
      clearcoat: 0.22,
      clearcoatRoughness: 0.5,
      sheen: 0.35,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#ffcca4'),
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
         vWNorm = normalize(mat3(modelMatrix) * objectNormal);`
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
         vWPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      );

      shader.fragmentShader = `
        varying vec3 vWPos;
        varying vec3 vWNorm;

        // 3D Simplex Noise for realistic anatomical tissue mottling
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          i = mod289(i);
          vec4 p = permute(permute(permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
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
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <map_fragment>`,
        `
        #include <map_fragment>
        
        vec3 pos = vWPos * 2.8;
        float n1 = snoise(pos);
        float n2 = snoise(pos * 5.2 + vec3(1.7, 3.1, 0.4));
        float n3 = snoise(pos * 12.0);

        float mottle = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

        vec3 colorCream = vec3(0.85, 0.78, 0.72);
        vec3 colorFlesh = vec3(0.62, 0.48, 0.41);
        vec3 colorDeep  = vec3(0.38, 0.22, 0.20);
        vec3 colorVessel= vec3(0.48, 0.18, 0.16);

        vec3 tissueColor = mix(colorFlesh, colorCream, smoothstep(-0.4, 0.4, mottle));
        tissueColor = mix(tissueColor, colorDeep, smoothstep(0.2, 0.7, n2));

        // Micro capillary vein accents
        float vein = smoothstep(0.68, 0.72, abs(n3));
        tissueColor = mix(tissueColor, colorVessel, vein * 0.6);

        // Anatomical Sulcus Shadowing
        float sulcus = smoothstep(0.05, 0.8, abs(vWNorm.y));
        tissueColor *= mix(0.55, 1.0, sulcus);

        diffuseColor.rgb = tissueColor;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <roughnessmap_fragment>`,
        `#include <roughnessmap_fragment>
         float detailRough = snoise(vWPos * 15.0);
         roughnessFactor *= mix(0.75, 1.25, detailRough * 0.5 + 0.5);
        `
      );
    };

    mat.customProgramCacheKey = () => 'photo-organic-v100';
    return mat;
  }
};