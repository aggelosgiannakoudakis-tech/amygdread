// components/BrainModel.tsx
"use client";

import React, { useMemo, useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildPieces, Piece } from "../lib/pieces";
import { materials } from "../lib/materials";
import { E } from "../lib/enter";
import { H } from "../lib/progress";

const _targetPos = new THREE.Vector3();

const CANDIDATE_MODELS = [
  "/brain.glb",
  "/models/brain.glb",
  "/brain-transformed.glb",
  "/models/brain-transformed.glb",
];

function createFallbackTexture() {
  const data = new Uint8Array([195, 115, 110, 255]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export interface BrainModelProps {
  onReady?: () => void;
}

export default function BrainModel({ onReady }: BrainModelProps) {
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let active = true;

    const findModel = async () => {
      for (const url of CANDIDATE_MODELS) {
        try {
          const res = await fetch(url, { method: "HEAD" });
          if (res.ok) {
            if (active) setModelUrl(url);
            return;
          }
        } catch {
          // try next candidate
        }
      }
      console.error(
        "Could not find brain GLB at any of:",
        CANDIDATE_MODELS,
        "— check your public/ folder!"
      );
      // Unblock loading screen even if the GLB is missing
      if (active) onReadyRef.current?.();
    };

    findModel();
    return () => {
      active = false;
    };
  }, []);

  if (!modelUrl) return null;

  return <BrainModelInner modelUrl={modelUrl} onReady={onReady} />;
}

function BrainModelInner({
  modelUrl,
  onReady,
}: {
  modelUrl: string;
  onReady?: () => void;
}) {
  const { scene } = useGLTF(modelUrl) as any;
  const { gl, camera } = useThree();

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const material = useMemo(() => {
    const fallbackTex = createFallbackTexture();
    return materials.organic(fallbackTex);
  }, []);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    // ⚠️ Make sure this matches the exact filename inside your public/textures/ folder
    loader.load(
      "/textures/brain_albedo.jpg",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 16);
        tex.needsUpdate = true;

        if (material.userData.uTexAlbedo) {
          material.userData.uTexAlbedo.value = tex;
        }
        material.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(
          "Texture /textures/brain_albedo.jpg not found, using fallback:",
          err
        );
      }
    );
  }, [gl, material]);

  const { pieces } = useMemo(() => {
    return buildPieces(scene);
  }, [scene]);

  useEffect(() => {
    if (!pieces) return;
    pieces.forEach((p: Piece) => {
      if (p.mesh) {
        p.mesh.material = material;
      }
    });
  }, [pieces, material]);

  const warming = useRef(true);

  useEffect(() => {
    let active = true;

    const withTimeout = (promise: Promise<any>, ms: number) =>
      Promise.race([
        promise,
        new Promise((resolve) => setTimeout(resolve, ms)),
      ]);

    const compileBoth = async () => {
      try {
        material.transparent = true;
        material.depthWrite = true;
        if (typeof gl.compileAsync === "function") {
          await withTimeout(gl.compileAsync(scene, camera), 1500);
        } else {
          gl.compile(scene, camera);
        }
      } catch (e) {
        console.warn("Shader compilation warning:", e);
      }

      if (active) {
        warming.current = false;
        onReadyRef.current?.();
      }
    };

    compileBoth();
    return () => {
      active = false;
    };
  }, [gl, camera, scene, material]);

  useFrame((state) => {
    if (warming.current || !pieces) return;

    const t = state.clock.getElapsedTime();
    const targetRoom = E.room;

    const targetOpacity = targetRoom === -1 ? 1 : 0;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
    material.visible = material.opacity > 0.001;

    if (!material.visible) return;

    const shatterFactor = targetRoom === -1 ? ((H as any).p ?? 0) : 1.2;

    pieces.forEach((p: Piece) => {
      if (p.layer === "hidden") {
        p.mesh.visible = false;
        return;
      }

      _targetPos.copy(p.home).addScaledVector(p.dir, p.dist * shatterFactor);
      p.mesh.position.lerp(_targetPos, 0.08);

      const rotSpeed = 0.2 * (p.spin.x || 1);
      p.mesh.rotation.x += Math.sin(t * rotSpeed + p.h) * 0.0015;
      p.mesh.rotation.y += Math.cos(t * rotSpeed * 0.8 + p.h) * 0.0015;
    });
  });

  return <primitive object={scene} />;
}