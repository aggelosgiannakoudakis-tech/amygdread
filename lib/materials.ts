// lib/materials.ts
import * as THREE from 'three';

export const materials = {
  organic: (texAlbedo: THREE.Texture | null) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.6,
      metalness: 0.02,
      reflectivity: 0.5,
      clearcoat: 0.5, // High clearcoat for wetness
      clearcoatRoughness: 0.2,
      sheen: 0.3,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffccaa'),
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTexAlbedo = { value: texAlbedo };
      
      shader.vertexShader = shader.vertexShader.replace(
        `#include <common>`,
        `#include <common>
         varying vec3 vPos;
         varying vec3 vNormalVec;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <beginnormal_vertex>`,
        `#include <beginnormal_vertex>
         vNormalVec = normalize(normalMatrix * normal);`
      );

      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
         vPos = (instanceMatrix * vec4(position, 1.0)).xyz;`
      );

      shader.fragmentShader = `
        uniform sampler2D uTexAlbedo;
        varying vec3 vPos;
        varying vec3 vNormalVec;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <map_fragment>`,
        `
        // Tri-planar blending weights
        vec3 blending = abs(vNormalVec);
        blending /= (blending.x + blending.y + blending.z);

        // Texture Projection Scale - Adjust 0.5 to change texture density
        float scale = 0.5; 
        vec3 xTex = texture2D(uTexAlbedo, vPos.yz * scale).rgb;
        vec3 yTex = texture2D(uTexAlbedo, vPos.xz * scale).rgb;
        vec3 zTex = texture2D(uTexAlbedo, vPos.xy * scale).rgb;
        
        // Blend photo projections
        vec3 texColor = xTex * blending.x + yTex * blending.y + zTex * blending.z;

        // Darken deep crevices (Sulcus shading)
        float sulcus = smoothstep(0.1, 0.9, abs(vNormalVec.y));
        texColor *= mix(0.6, 1.0, sulcus);

        diffuseColor.rgb = texColor;
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <roughnessmap_fragment>`,
        `#include <roughnessmap_fragment>
         // Make darker parts of the photo (veins/crevices) wetter/shinier
         float photoLum = dot(texColor, vec3(0.299, 0.587, 0.114));
         roughnessFactor *= mix(0.5, 1.2, photoLum);
        `
      );
    };

    mat.customProgramCacheKey = () => 'photo-organic-v3';
    return mat;
  }
};