// lib/materials.ts
import * as THREE from 'three';

export const organic = (texAlbedo: THREE.Texture | null) => {
  if (texAlbedo) {
    texAlbedo.wrapS = THREE.RepeatWrapping;
    texAlbedo.wrapT = THREE.RepeatWrapping;
    texAlbedo.needsUpdate = true;
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.46,
    metalness: 0.0,
    ior: 1.44,
    reflectivity: 0.75,
    clearcoat: 0.88,          // Wet cerebrospinal fluid / pia mater gloss
    clearcoatRoughness: 0.12,
    sheen: 0.35,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color('#ff8570'),
  });

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

      // Crops into the center 56% of the texture so the flat blue corners of brain_albedo.jpg are never sampled
      vec2 brainInteriorUV(vec2 p) {
        vec2 t = abs(fract(p) * 2.0 - 1.0); // seamless triangle wave 0..1
        return t * 0.52 + 0.24;
      }

      vec3 sampleTriplanarInterior(sampler2D tex, vec3 pos, vec3 n, float scale) {
        vec3 blend = pow(abs(n), vec3(5.0));
        blend /= (blend.x + blend.y + blend.z + 1e-5);

        vec3 xTex = texture2D(tex, brainInteriorUV(pos.yz * scale)).rgb;
        vec3 yTex = texture2D(tex, brainInteriorUV(pos.xz * scale)).rgb;
        vec3 zTex = texture2D(tex, brainInteriorUV(pos.xy * scale)).rgb;

        return xTex * blend.x + yTex * blend.y + zTex * blend.z;
      }
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <map_fragment>`,
      `
      #include <map_fragment>

      vec3 nW = normalize(vWorldNormal);
      vec3 rawMacro = sampleTriplanarInterior(uTexAlbedo, vWorldPos, nW, 0.28);
      vec3 rawMicro = sampleTriplanarInterior(uTexAlbedo, vWorldPos + vec3(1.37, 2.91, 0.73), nW, 0.85);

      // Unpack tangent normal vectors from brain_albedo.jpg
      vec3 nMacro = rawMacro * 2.0 - 1.0;
      vec3 nMicro = rawMicro * 2.0 - 1.0;

      // Detect if the texture is a blue/purple normal map vs. a red/pink photo
      float isNormalMap = step(rawMacro.r + 0.03, rawMacro.b);

      // Compute fold depth (sulci vs gyri crowns) from normal map slope & Z channel
      float slope = clamp(length(nMacro.xy) * 1.35 + length(nMicro.xy) * 0.45, 0.0, 1.0);
      float gyrusCrown = clamp(nMacro.z * (1.0 - slope * 0.65), 0.0, 1.0);
      float sulcusDepth = smoothstep(0.15, 0.78, gyrusCrown);

      // Fine capillary/vessel trace inside the grooves
      float vesselLine = smoothstep(0.45, 0.82, slope) * (1.0 - smoothstep(0.82, 0.98, slope));

      // Anatomical wet brain palette driven by the texture's folds
      vec3 deepSulcusColor = vec3(0.18, 0.018, 0.028); // Dark venous crimson in deep creases
      vec3 vesselColor     = vec3(0.48, 0.045, 0.055); // Arterial red along fold walls
      vec3 cortexMidColor  = vec3(0.74, 0.44, 0.42);   // Warm pink-beige tissue
      vec3 gyrusPeakColor  = vec3(0.88, 0.64, 0.58);   // Lighter grey-pink gyrus crowns

      vec3 organicCol = mix(deepSulcusColor, cortexMidColor, sulcusDepth);
      organicCol = mix(organicCol, gyrusPeakColor, smoothstep(0.55, 0.95, sulcusDepth));
      organicCol = mix(organicCol, vesselColor, vesselLine * 0.55);

      // Add subtle micro-tissue mottling from the secondary scale
      organicCol *= mix(0.88, 1.12, clamp(nMicro.x * 0.5 + 0.5, 0.0, 1.0));

      // Fallback if user swaps in a regular RGB photo
      vec3 photoCol = rawMacro * mix(0.65, 1.0, smoothstep(0.1, 0.85, abs(nW.y)));

      // Grounding occlusion in deep geometry crevices
      float geoSulcus = smoothstep(0.05, 0.85, abs(nW.y));
      vec3 finalBrainCol = mix(photoCol, organicCol, isNormalMap);
      finalBrainCol *= mix(0.72, 1.0, geoSulcus);

      diffuseColor.rgb = finalBrainCol;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <roughnessmap_fragment>`,
      `#include <roughnessmap_fragment>
       // Sulci and blood vessels are wetter/glossier than the gyrus crowns
       roughnessFactor *= mix(0.42, 1.08, sulcusDepth);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <normal_fragment_maps>`,
      `#include <normal_fragment_maps>
       {
         // Apply 3D surface relief from the texture's normal channels so light catches every fold
         vec3 texPerturb = normalize(vec3(nMacro.xy * 0.75 + nMicro.xy * 0.35, max(0.2, nMacro.z)));
         normal = normalize(normal + vec3(texPerturb.x, texPerturb.y, 0.0) * 0.32);
       }
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <lights_fragment_end>`,
      `#include <lights_fragment_end>
       {
         // Subsurface scattering glow in the tissue folds
         vec3 totalLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
         float lightLum = dot(totalLight, vec3(0.299, 0.587, 0.114));
         float sssMask = smoothstep(0.02, 0.55, lightLum) * (1.0 - smoothstep(0.55, 1.2, lightLum));
         reflectedLight.directDiffuse += vec3(0.65, 0.06, 0.04) * sssMask * 0.26 * diffuseColor.rgb;
       }
      `
    );
  };

  mat.customProgramCacheKey = () => 'photo-organic-v7';
  return mat;
};

export const materials = {
  organic,
};