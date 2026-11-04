// components/BrainModel.tsx
"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import pieces from "../lib/pieces"; // Uses your existing default export
import { materials } from "../lib/materials";
import { E } from "../lib/enter";
import { H } from "../lib/progress";

interface BrainModelProps {
  onReady?: () => void;
}

export default function BrainModel({ onReady }: BrainModelProps) {
  const { nodes } = useGLTF("/models/brain-transformed.glb") as any;
  const { gl, camera } = useThree();

  // Load texture manually to prevent Suspense hang
  const brainAlbedo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new THREE.TextureLoader().load("/textures/brain_albedo.jpg");
  }, []);

  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const warming = useRef(true);

  const material = useMemo(() => materials.organic(brainAlbedo), [brainAlbedo]);

  useEffect(() => {
    let active = true;
    const compile = async () => {
      material.transparent = false;
      await gl.compileAsync(meshRef.current, camera);
      material.transparent = true;
      await gl.compileAsync(meshRef.current, camera);
      if (active) {
        warming.current = false;
        onReady?.(); // Dismisses loading screen
      }
    };
    compile();
    return () => { active = false; };
  }, [gl, camera, material, onReady]);

  const { instanceMatrix, colors } = useMemo(() => {
    const matrix = new Float32Array(pieces.length * 16);
    const colorArr = new Float32Array(pieces.length * 3);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color("#ffffff");
    pieces.forEach((p, i) => {
      dummy.position.copy(p.pos || p.home);
      dummy.rotation.set(p.rot?.x || 0, p.rot?.y || 0, p.rot?.z || 0);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrix, i * 16);
      color.toArray(colorArr, i * 3);
    });
    return { instanceMatrix: matrix, colors: colorArr };
  }, []);

  useFrame((state) => {
    if (warming.current || !meshRef.current) return;

    const t = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();
    const targetRoom = E.room;
    
    const targetOpacity = targetRoom === -1 ? 1 : 0;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
    material.visible = material.opacity > 0.001;

    if (!material.visible) return;

    // Use H.p for scroll shatter, or fixed explosion if in room
    const shatter = targetRoom === -1 ? ((H as any).p || 0) : 1.2;

    pieces.forEach((p, i) => {
      dummy.matrix.fromArray(instanceMatrix, i * 16);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const targetPos = p.home.clone().addScaledVector(p.dir, p.dist * shatter);
      dummy.position.lerp(targetPos, 0.08);

      const rotSpeed = 0.2 * (p.spin?.x || 1);
      dummy.rotation.x += Math.sin(t * rotSpeed + p.h) * 0.002;
      dummy.rotation.y += Math.cos(t * rotSpeed * 0.8 + p.h) * 0.002;

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[nodes.Cortex.geometry, material, pieces.length]}
      frustumCulled={true}
    >
      <instancedBufferAttribute attach="instanceMatrix" count={pieces.length} array={instanceMatrix} itemSize={16} />
      <instancedBufferAttribute attach="instanceColor" count={pieces.length} array={colors} itemSize={3} />
    </instancedMesh>
  );
}