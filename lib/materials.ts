import * as THREE from 'three';

function getTissueTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const size = Math.random() * 1.5;
    const alpha = Math.random() * 0.15;
    context.fillStyle = `rgba(0,0,0,${alpha})`;
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const tissueTex = getTissueTexture();

export function organic<T extends THREE.MeshPhysicalMaterial>(
  m: T, 
  k = 1.8, 
  amp = 0.2
): T {
  m.map = tissueTex;
  m.roughness = 0.4;
  m.metalness = 0.05;
  m.clearcoat = 0.8;
  m.clearcoatRoughness = 0.15;
  
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = `
      varying vec3 vWorldPos;
      ${shader.vertexShader}
    `.replace(
      `#include <worldpos_vertex>`,
      `#include <worldpos_vertex>
       vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    shader.fragmentShader = `
      varying vec3 vWorldPos;
      vec3 hash(vec3 p) {
        p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                 dot(p, vec3(269.5, 183.3, 246.1)),
                 dot(p, vec3(113.5, 271.9, 124.6)));
        return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(dot(hash(i + vec3(0, 0, 0)), f - vec3(0, 0, 0)),
                           dot(hash(i + vec3(1, 0, 0)), f - vec3(1, 0, 0)), u.x),
                       mix(dot(hash(i + vec3(0, 1, 0)), f - vec3(0, 1, 0)),
                           dot(hash(i + vec3(1, 1, 0)), f - vec3(1, 1, 0)), u.x), u.y),
                   mix(mix(dot(hash(i + vec3(0, 0, 1)), f - vec3(0, 0, 1)),
                           dot(hash(i + vec3(1, 0, 1)), f - vec3(1, 0, 1)), u.x),
                       mix(dot(hash(i + vec3(0, 1, 1)), f - vec3(0, 1, 1)),
                           dot(hash(i + vec3(1, 1, 1)), f - vec3(1, 1, 1)), u.x), u.y), u.z);
      }
      ${shader.fragmentShader}
    `.replace(
      `#include <color_fragment>`,
      `#include <color_fragment>
       float n = noise(vWorldPos * 8.0);
       float n2 = noise(vWorldPos * 25.0);
       vec3 mottleColor = vec3(0.6, 0.45, 0.35);
       float mottleStrength = smoothstep(-0.2, 0.6, n);
       diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * mottleColor, mottleStrength * ${amp.toFixed(2)});
       if (n2 > 0.75) { diffuseColor.rgb *= vec3(0.9, 0.7, 0.7); }
      `
    ).replace(
      `#include <normal_fragment_begin>`,
      `#include <normal_fragment_begin>
       normal = normalize(normal + (n2 * 0.1));
      `
    );
  };
  return m;
}