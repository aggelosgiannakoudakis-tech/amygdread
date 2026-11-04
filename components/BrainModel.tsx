// components/BrainModel.tsx
"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { buildPieces, Piece } from "../lib/pieces";
import { materials } from "../lib/materials";
import { E } from "../lib/enter";
import { H } from "../lib/progress";

interface BrainModelProps {
  onReady?: () => void;
}

export default function BrainModel({ onReady }: BrainModelProps) {
  const { scene } = useGLTF("/models/brain-transformed.glb") as any;
  const { gl, camera } = useThree();

  // Background loader prevents React Suspense hangs
  const brainAlbedo = useMemo(() => {
    if (typeof window === "undefined") return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(
      "/textures/brain_albedo.jpg",
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.needsUpdate = true;
      },
      undefined,
      () => {}
    );
    return tex;
  }, []);

  const { pieces } = useMemo(() => {
    return buildPieces(scene);
  }, [scene]);

  const material = useMemo(() => {
    return materials.organic(brainAlbedo);
  }, [brainAlbedo]);

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

    // Guaranteed fallback: dismiss loader screen within 600ms
    const timer = setTimeout(() => {
      if (active && warming.current) {
        warming.current = false;
        onReady?.();
      }
    }, 600);

    const compileBoth = async () => {
      try {
        material.transparent = false;
        material.depthWrite = true;
        await gl.compileAsync(scene, camera);

        material.transparent = true;
        await gl.compileAsync(scene, camera);
      } catch (e) {
        // Shader warning safely ignored
      }

      if (active && warming.current) {
        warming.current = false;
        onReady?.();
        clearTimeout(timer);
      }
    };

    compileBoth();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [gl, camera, scene, material, onReady]);

  useFrame((state) => {
    if (warming.current || !pieces) return;

    const t = state.clock.getElapsedTime();
    const targetRoom = E.room;

    const targetOpacity = targetRoom === -1 ? 1 : 0;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
    material.visible = material.opacity > 0.001;

    if (!material.visible) return;

    // Safe access to progress to bypass strict Next.js TypeScript errors
    const hAny = H as any;
    const shatterFactor = targetRoom === -1 ? (hAny.p ?? hAny.i ?? 0) : 1.2;

    pieces.forEach((p: Piece) => {
      if (p.layer === "hidden") {
        p.mesh.visible = false;
        return;
      }

      const targetPos = p.home.clone().addScaledVector(p.dir, p.dist * shatterFactor);
      p.mesh.position.lerp(targetPos, 0.08);

      const rotSpeed = 0.2 * (p.spin?.x || 1);
      p.mesh.rotation.x += Math.sin(t * rotSpeed + p.h) * 0.0015;
      p.mesh.rotation.y += Math.cos(t * rotSpeed * 0.8 + p.h) * 0.0015;
    });
  });

  return <primitive object={scene} />;
}