// lib/materials.ts
import * as THREE from 'three';

export const materials = {
  organic: (texAlbedo: THREE.Texture | null) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.6,
      metalness: 0.05,
      reflectivity: 0.5,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      sheen: 0.3,
      sheenColor: new THREE.Color('#ffccaa'),
    });

    if (texAlbedo) {
      texAlbedo.wrapS = texAlbedo.wrapT = THREE.RepeatWrapping;
    }

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTexAlbedo = { value: texAlbedo };
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
        uniform sampler2D uTexAlbedo;
        varying vec3 vWPos;
        varying vec3 vWNorm;
        ${shader.fragmentShader}
      `;
      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <map_fragment>`,
        `
        vec3 blending = abs(vWNorm);
        blending /= (blending.x + blending.y + blending.z + 0.001);
        float scale = 0.45;
        vec3 xTex = texture2D(uTexAlbedo, vWPos.yz * scale).rgb;
        vec3 yTex = texture2D(uTexAlbedo, vWPos.xz * scale).rgb;
        vec3 zTex = texture2D(uTexAlbedo, vWPos.xy * scale).rgb;
        vec3 photoColor = xTex * blending.x + yTex * blending.y + zTex * blending.z;
        float sulcus = smoothstep(0.1, 0.9, abs(vWNorm.y));
        photoColor *= mix(0.55, 1.0, sulcus);
        diffuseColor.rgb = photoColor;
        `
      );
    };
    mat.customProgramCacheKey = () => 'photo-v30';
    return mat;
  }
};