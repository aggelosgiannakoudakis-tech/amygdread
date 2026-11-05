"use client";

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { E, H } from '../lib/data';
import { P, S, PieceBuilder } from '../lib/pieces';
import { organic } from '../lib/materials';

function mk<T extends THREE.Material>(m: T): T {
  m.transparent = true;
  m.depthWrite = true;
  return m;
}

const makeMaterials = () => {
  // Medical Specimen Palette
  const cortex = mk(organic(new THREE.MeshPhysicalMaterial({ 
    color: 0xd4c3b0, // Cadaveric Tan
    roughness: 0.35,
    metalness: 0.05,
    emissive: 0x221108,
    emissiveIntensity: 0.2
  }), 2.0, 0.45));

  const vessels = mk(organic(new THREE.MeshPhysicalMaterial({ 
    color: 0x881111, // Deep Red
    roughness: 0.2,
    clearcoat: 1.0 
  }), 1.0, 0.2));

  const nerves = mk(organic(new THREE.MeshPhysicalMaterial({ 
    color: 0xe5dccd, // Cream
    roughness: 0.5 
  }), 1.0, 0.1));

  return { cortex, vessels, nerves, default: cortex };
};

export default function BrainModel() {
  const gltf = useGLTF('/models/brain.glb', '/draco/');
  const { camera, gl } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const warming = useRef(0);

  const materials = useMemo(() => makeMaterials(), []);

  const pieces = useMemo(() => {
    if (!gltf) return [];
    return PieceBuilder.build(gltf.scene, (name) => {
      const n = name.toLowerCase();
      if (n.includes('vessel') || n.includes('artery')) return materials.vessels;
      if (n.includes('nerve')) return materials.nerves;
      return materials.cortex;
    });
  }, [gltf, materials]);

  useEffect(() => {
    const compileBoth = async () => {
      if (warming.current > 0) return;
      warming.current = 1;
      
      const scene = new THREE.Scene();
      const testGroup = new THREE.Group();
      scene.add(testGroup);
      
      pieces.forEach(p => {
        const m = new THREE.Mesh(p.geometry, p.material);
        testGroup.add(m);
      });

      // Warm shaders to prevent freezing during scroll
      pieces.forEach(p => (p.material.opacity = 0));
      await gl.compileAsync(scene, camera);
      
      pieces.forEach(p => (p.material.opacity = 1));
      await gl.compileAsync(scene, camera);
      
      E.ready = true;
    };
    compileBoth();
  }, [gl, camera, pieces]);

  useFrame((state, delta) => {
    // Explosion movement
    P(pieces, E.room0Factor, E.room1Factor, E.room2Factor, E.room3Factor);
    S(pieces, E.room0Factor, E.room1Factor, E.room2Factor, E.room3Factor);

    // Fade in/out logic
    const targetOpacity = H.value > 0.01 ? 1 : 0;
    pieces.forEach(p => {
      p.material.opacity = THREE.MathUtils.lerp(p.material.opacity, targetOpacity, 0.1);
      p.material.visible = p.material.opacity > 0.001;
    });

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {pieces.map((p, i) => (
        <primitive key={i} object={p.mesh} />
      ))}
    </group>
  );
}