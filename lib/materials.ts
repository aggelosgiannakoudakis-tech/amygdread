// lib/materials.ts
import * as THREE from 'three';

export const materials = {
  organic: (texAlbedo: THREE.Texture | null) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', // Base color white so the photo shows through perfectly
      roughness: 0.65,
      metalness: 0.05,
      reflectivity: 0.5,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      sheen: 0.2,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffccaa'),
      transmission: 0,
      thickness: 0,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTexAlbedo = { value: texAlbedo };
      shader.uniforms.uTime = { value: 0 };
      
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
        uniform float uTime;
        varying vec3 vPos;
        varying vec3 vNormalVec;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <map_fragment>`,
        `
        vec3 blending = abs(vNormalVec);
        blending /= (blending.x + blending.y + blending.z);

        // Tri-planar mapping scale
        float scale = 0.4; 
        vec3 xTex = texture2D(uTexAlbedo, vPos.yz * scale).rgb;
        vec3 yTex = texture2D(uTexAlbedo, vPos.xz * scale).rgb;
        vec3 zTex = texture2D(uTexAlbedo, vPos.xy * scale).rgb;
        
        // Blend the 3 projections together
        vec3 texColor = xTex * blending.x + yTex * blending.y + zTex * blending.z;

        // Darken crevices based on normal orientation (Sulcus darkening)
        float sulcus = smoothstep(0.2, 0.8, blending.y);
        texColor *= mix(0.7, 1.0, sulcus);

        diffuseColor.rgb = texColor;
        `
      );

      // Add a bit of organic pulse to the wetness
      shader.fragmentShader = shader.fragmentShader.replace(
        `#include <roughnessmap_fragment>`,
        `#include <roughnessmap_fragment>
         float photoLum = dot(texColor, vec3(0.299, 0.587, 0.114));
         roughnessFactor *= mix(1.2, 0.8, photoLum);
        `
      );
    };

    // Important for tri-planar consistency
    mat.customProgramCacheKey = () => 'photo-organic-v1';

    return mat;
  }
};