// components/BrainModel.tsx
"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import pieces from "../lib/pieces";
import { materials } from "../lib/materials";
import { E } from "../lib/enter";

export default function BrainModel() {
  const { nodes } = useGLTF("/models/brain-transformed.glb") as any;
  const { gl } = useThree();
  
  // Load the photographic texture
  const brainAlbedo = useTexture("/textures/brain_albedo.jpg");
  brainAlbedo.wrapS = brainAlbedo.wrapT = THREE.RepeatWrapping;

  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const warming = useRef(true);

  // Create the material using the photo
  const material = useMemo(() => materials.organic(brainAlbedo), [brainAlbedo]);

  useEffect(() => {
    const compileBoth = async () => {
      material.transparent = false;
      material.depthWrite = true;
      await gl.compileAsync(meshRef.current, meshRef.current.parent || meshRef.current, null);
      
      material.transparent = true;
      await gl.compileAsync(meshRef.current, meshRef.current.parent || meshRef.current, null);
      
      warming.current = false;
    };
    compileBoth();
  }, [gl, material]);

  const { instanceMatrix, colors } = useMemo(() => {
    const matrix = new Float32Array(pieces.length * 16);
    const colorArr = new Float32Array(pieces.length * 3);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    pieces.forEach((p, i) => {
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
      dummy.updateMatrix();
      dummy.matrix.toArray(matrix, i * 16);
      
      color.set("#ffffff");
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

    pieces.forEach((p, i) => {
      const pIdx = i * 16;
      dummy.matrix.fromArray(instanceMatrix, pIdx);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      const explode = targetRoom === -1 ? E.room0Factor : 1.2;
      const targetPos = p.pos.clone().multiplyScalar(explode);
      dummy.position.lerp(targetPos, 0.08);

      const rotSpeed = 0.2 * p.speed;
      dummy.rotation.x += Math.sin(t * rotSpeed + p.phase) * 0.002;
      dummy.rotation.y += Math.cos(t * rotSpeed * 0.8 + p.phase) * 0.002;

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
        count={instanceMatrix.length / 16}
        array={instanceMatrix}
        itemSize={16}
      />
      <instancedBufferAttribute
        attach="instanceColor"
        count={colors.length / 3}
        array={colors}
        itemSize={3}
      />
    </instancedMesh>
  );
}