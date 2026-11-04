// components/BrainModel.tsx
"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildPieces, Piece } from "../lib/pieces";
import { materials } from "../lib/materials";
import { E } from "../lib/enter";
import { P, S, LOAD } from "../lib/progress";

const _targetPos = new THREE.Vector3();

function createFallbackTexture() {
  const data = new Uint8Array([128, 128, 255, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export default function BrainModel({ onReady }: { onReady?: () => void }) {
  const { scene } = useGLTF("/brain.glb") as any;
  const { gl, camera } = useThree();

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // Build pieces once on the loaded GLB
  const { pieces, center, size } = useMemo(() => {
    if (!scene.userData.__builtPieces) {
      scene.userData.__builtPieces = buildPieces(scene);
    }
    return scene.userData.__builtPieces as ReturnType<typeof buildPieces>;
  }, [scene]);

  const baseTexture = useMemo(() => createFallbackTexture(), []);

  const material = useMemo(() => {
    return materials.organic(baseTexture);
  }, [baseTexture]);

  // Immediately mark model ready and dismiss the loading screen
  useEffect(() => {
    pieces.forEach((p: Piece) => {
      if (p.mesh) {
        p.mesh.material = material;
      }
    });

    S.pieces = pieces;
    S.norm = { c: center, s: size };
    S.remaining = 1;
    LOAD.model = true;

    try {
      gl.compile(scene, camera);
    } catch {}

    onReadyRef.current?.();
  }, [pieces, center, size, material, gl, scene, camera]);

  // Load /textures/brain_albedo.jpg via plain HTML Image so it never blocks Suspense or DefaultLoadingManager
  useEffect(() => {
    let active = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!active) return;
      const tex = new THREE.Texture(img);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 16);
      tex.needsUpdate = true;

      if (material.userData?.uTexAlbedo) {
        material.userData.uTexAlbedo.value = tex;
      }
      material.needsUpdate = true;
    };
    img.src = "/textures/brain_albedo.jpg";

    return () => {
      active = false;
    };
  }, [gl, material]);

  useFrame((state) => {
    if (!pieces || pieces.length === 0) return;

    const t = state.clock.getElapsedTime();
    const targetRoom = E.room;

    const targetOpacity = targetRoom === -1 ? 1 : 0;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
    material.visible = material.opacity > 0.001;

    if (!material.visible) return;

    const prog = P.value;
    let rem = 0;

    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (p.layer === "hidden") {
        p.mesh.visible = false;
        continue;
      }

      let u = targetRoom === -1 ? THREE.MathUtils.clamp((prog - p.start) / p.dur, 0, 1) : 1;
      u = u * u * (3 - 2 * u);
      rem += 1 - u;

      _targetPos.copy(p.home).addScaledVector(p.dir, p.dist * u);
      p.mesh.position.lerp(_targetPos, 0.12);

      const rotSpeed = 0.2 * (p.spin.x || 1);
      p.mesh.rotation.x = p.spin.x * u + Math.sin(t * rotSpeed + p.h) * 0.0015;
      p.mesh.rotation.y = p.spin.y * u + Math.cos(t * rotSpeed * 0.8 + p.h) * 0.0015;
      p.mesh.rotation.z = p.spin.z * u;
    }

    S.remaining = rem / Math.max(1, pieces.length);
  });

  return <primitive object={scene} />;
}

useGLTF.preload("/brain.glb");