// lib/materials.ts
import * as THREE from 'three';

export const organic = (texAlbedo: THREE.Texture | null) => {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.58,
    metalness: 0.03,
    reflectivity: 0.5,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffcca4'),
  });

  if (texAlbedo) {
    texAlbedo.wrapS = THREE.RepeatWrapping;
    texAlbedo.wrapT = THREE.RepeatWrapping;
  }

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTexAlbedo = { value: texAlbedo };

    shader.vertexShader = shader.vertexShader.replace(
      `#include <common>`,
      `#include <common>
       varying vec3 vWorldPos;
       varying vec3 vWorldNormal;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      `#include <beginnormal_vertex>`,
      `#include <beginnormal_vertex>
       vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
    );

    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
       vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
    );

    shader.fragmentShader = `
      uniform sampler2D uTexAlbedo;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <map_fragment>`,
      `
      #include <map_fragment>
      vec3 blending = abs(vWorldNormal);
      blending /= (blending.x + blending.y + blending.z + 0.00001);

      float scale = 0.35;
      vec3 xTex = texture2D(uTexAlbedo, vWorldPos.yz * scale).rgb;
      vec3 yTex = texture2D(uTexAlbedo, vWorldPos.xz * scale).rgb;
      vec3 zTex = texture2D(uTexAlbedo, vWorldPos.xy * scale).rgb;

      vec3 texColor = xTex * blending.x + yTex * blending.y + zTex * blending.z;

      // Darken sulcus / crevice regions
      float sulcus = smoothstep(0.1, 0.85, abs(vWorldNormal.y));
      texColor *= mix(0.6, 1.0, sulcus);

      diffuseColor.rgb = texColor;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <roughnessmap_fragment>`,
      `#include <roughnessmap_fragment>
       float photoLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
       roughnessFactor *= mix(0.7, 1.15, photoLum);
      `
    );
  };

  mat.customProgramCacheKey = () => 'photo-organic-v4';
  return mat;
};

export const materials = {
  organic,
};