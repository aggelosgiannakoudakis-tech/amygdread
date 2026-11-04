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
  const { nodes, scene } = useGLTF("/models/brain-transformed.glb") as any;
  const { gl, camera } = useThree();

  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const warming = useRef(true);

  const { pieces } = useMemo(() => buildPieces(scene), [scene]);
  const material = useMemo(() => materials.organic(), []);

  useEffect(() => {
    let active = true;
    const compile = async () => {
      try {
        material.transparent = false;
        await gl.compileAsync(meshRef.current, camera);
        material.transparent = true;
        await gl.compileAsync(meshRef.current, camera);
      } catch (e) {}
      if (active) {
        warming.current = false;
        onReady?.();
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

    pieces.forEach((p: Piece, i: number) => {
      dummy.position.copy(p.home);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrix, i * 16);
      color.toArray(colorArr, i * 3);
    });
    return { instanceMatrix: matrix, colors: colorArr };
  }, [pieces]);

  useFrame((state) => {
    if (warming.current || !meshRef.current) return;

    const t = state.clock.getElapsedTime();
    const dummy = new THREE.Object3D();
    
    const targetOpacity = E.room === -1 ? 1 : 0;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 0.05);
    material.visible = material.opacity > 0.001;

    if (!material.visible) return;

    // Use H.i for scroll shatter as defined in your state
    const hAny = H as any;
    const shatter = E.room === -1 ? (hAny.i || 0) : 1.2;

    pieces.forEach((p: Piece, i: number) => {
      dummy.matrix.fromArray(instanceMatrix, i * 16);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const targetPos = p.home.clone().addScaledVector(p.dir, p.dist * shatter);
      dummy.position.lerp(targetPos, 0.08);

      const rotSpeed = 0.2 * (p.spin?.x || 1);
      dummy.rotation.x += Math.sin(t * rotSpeed + p.h) * 0.0015;
      dummy.rotation.y += Math.cos(t * rotSpeed * 0.8 + p.h) * 0.0015;

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
      <instancedBufferAttribute 
        attach="instanceMatrix" 
        args={[instanceMatrix, 16]} 
      />
      <instancedBufferAttribute 
        attach="instanceColor" 
        args={[colors, 3]} 
      />
    </instancedMesh>
  );
}