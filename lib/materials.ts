// lib/materials.ts
import * as THREE from 'three';

export const organic = (texAlbedo: THREE.Texture | null) => {
  if (texAlbedo) {
    // Critical for custom shader uniforms: decode sRGB properly & keep sharp at grazing angles
    texAlbedo.colorSpace = THREE.SRGBColorSpace;
    texAlbedo.wrapS = THREE.RepeatWrapping;
    texAlbedo.wrapT = THREE.RepeatWrapping;
    texAlbedo.anisotropy = 16;
    texAlbedo.needsUpdate = true;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.48,          // Soft tissue base (modulated by photo in shader)
    metalness: 0.0,           // Biological tissue is purely dielectric
    ior: 1.44,                // Refractive index of wet tissue / CSF
    reflectivity: 0.7,
    clearcoat: 0.88,          // Wet arachnoid / pia mater outer membrane
    clearcoatRoughness: 0.12, // Glossy wet film over the tissue
    sheen: 0.35,              // Grazing-angle organic velvet scatter
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color('#ff7a66'),
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTexAlbedo = { value: texAlbedo };

    // --- VERTEX SHADER ---
    shader.vertexShader = shader.vertexShader.replace(
      `#include <common>`,
      `#include <common>
       varying vec3 vObjPos;
       varying vec3 vObjNormal;
       varying vec3 vWorldNormal;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      `#include <beginnormal_vertex>`,
      `#include <beginnormal_vertex>
       vObjNormal = normalize(objectNormal);
       vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );

    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
       vObjPos = position;`
    );

    // --- FRAGMENT SHADER ---
    shader.fragmentShader = `
      uniform sampler2D uTexAlbedo;
      varying vec3 vObjPos;
      varying vec3 vObjNormal;
      varying vec3 vWorldNormal;

      // Sharp triplanar helper in local object space (sticks to pieces when moving/shattering)
      vec3 sampleBrainTriplanar(sampler2D tex, vec3 pos, vec3 n, float scale) {
        vec3 blend = pow(abs(n), vec3(6.0));
        blend /= dot(blend, vec3(1.0)) + 1e-5;

        vec3 xTex = texture2D(tex, pos.yz * scale).rgb;
        vec3 yTex = texture2D(tex, pos.xz * scale).rgb;
        vec3 zTex = texture2D(tex, pos.xy * scale).rgb;

        return xTex * blend.x + yTex * blend.y + zTex * blend.z;
      }
      ${shader.fragmentShader}
    `;

    // 1. Albedo + Dual-Scale Detail + Vascular Crevice Grading
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <map_fragment>`,
      `
      #include <map_fragment>

      // Macro scale for broad brain structure + Micro scale for close-up camera rushes
      float macroScale = 0.38;
      float microScale = 1.45;

      vec3 nObj = normalize(vObjNormal);
      vec3 macroCol = sampleBrainTriplanar(uTexAlbedo, vObjPos, nObj, macroScale);
      vec3 microCol = sampleBrainTriplanar(uTexAlbedo, vObjPos + vec3(1.73, 2.41, 0.97), nObj, microScale);

      // Blend micro-detail luminance/vessels into the macro photo
      float microDetail = dot(microCol, vec3(0.299, 0.587, 0.114));
      vec3 texColor = macroCol * mix(0.82, 1.18, microDetail);

      // Extract luminance (height) and vascular redness from the photo
      float photoLum = dot(texColor, vec3(0.299, 0.587, 0.114));
      float vascularMask = clamp((texColor.r - texColor.g * 0.85) * 2.5, 0.0, 1.0);

      // Shift dark sulci / crevices toward deep venous crimson instead of muddy grey/black
      float creviceMask = smoothstep(0.08, 0.55, photoLum);
      vec3 venousBlood = vec3(0.20, 0.015, 0.025);
      texColor = mix(venousBlood, texColor, creviceMask);

      // Subtle anatomical grounding on undersides
      float cavity = smoothstep(-0.8, 0.5, vWorldNormal.y);
      texColor *= mix(0.72, 1.0, cavity);

      diffuseColor.rgb = texColor;
      `
    );

    // 2. Wetness Variation: Sulci & blood vessels are wetter (lower roughness) than gyrus crowns
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <roughnessmap_fragment>`,
      `#include <roughnessmap_fragment>
       roughnessFactor *= mix(0.45, 1.12, creviceMask) * mix(1.0, 0.65, vascularMask);
      `
    );

    // 3. 3D Micro-Relief Bump Mapping directly from the photo texture (no extra normal map file needed)
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <normal_fragment_maps>`,
      `#include <normal_fragment_maps>
       {
         // Height field: gyri crowns push out, sulci & vessels indent slightly
         float surfaceHeight = photoLum - vascularMask * 0.15;
         vec3 dpdx = dFdx(-vViewPosition);
         vec3 dpdy = dFdy(-vViewPosition);
         vec3 r1 = cross(dpdy, normal);
         vec3 r2 = cross(normal, dpdx);
         float det = dot(dpdx, r1);

         float bumpStrength = 0.028;
         vec3 surfGrad = sign(det) * (dFdx(surfaceHeight) * r1 + dFdy(surfaceHeight) * r2);
         normal = normalize(normal - bumpStrength * surfGrad / max(abs(det), 1e-6));
       }
      `
    );

    // 4. Keep the outer clearcoat slightly smoother than the underlying tissue (like liquid CSF over folds)
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <clearcoat_normal_fragment_maps>`,
      `#include <clearcoat_normal_fragment_maps>
       clearcoatNormal = normalize(mix(clearcoatNormal, normal, 0.35));
      `
    );

    // 5. Subsurface Scattering (SSS) approximation in shadow terminators & thin ridges
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <lights_fragment_end>`,
      `#include <lights_fragment_end>
       {
         vec3 totalLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
         float lightLum = dot(totalLight, vec3(0.299, 0.587, 0.114));
         // Warm sub-dermal blood glow where light transitions into shadow
         float sssMask = smoothstep(0.02, 0.55, lightLum) * (1.0 - smoothstep(0.55, 1.2, lightLum));
         vec3 sssColor = vec3(0.68, 0.06, 0.04) * sssMask * 0.28;
         reflectedLight.directDiffuse += sssColor * diffuseColor.rgb;
       }
      `
    );
  };

  mat.customProgramCacheKey = () => 'photo-organic-v5';
  return mat;
};

export const materials = {
  organic,
};