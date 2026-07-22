/**
 * Digital Twin FM — GLB/GLTF Building Model Loader (R3F)
 *
 * Loads an uploaded building model via useGLTF and positions it in the scene.
 * Reports named child objects so the parent can show layer toggles,
 * and applies per-object visibility from the Layers panel.
 */

"use client";

import { useMemo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface BuildingModelProps {
  modelUrl: string;
  visibleObjects?: Set<string>;
  onObjectsFound?: (names: string[]) => void;
}

export function BuildingModel({
  modelUrl,
  visibleObjects,
  onObjectsFound,
}: BuildingModelProps) {
  const { scene } = useGLTF(modelUrl);

  // Report distinct named objects from the GLB so the parent can show layer toggles
  useEffect(() => {
    if (!onObjectsFound) return;
    const found = new Set<string>();
    scene.traverse((child) => {
      if (child.name) found.add(child.name);
    });
    const names = Array.from(found).sort();
    if (names.length > 0) onObjectsFound(names);
  }, [scene, onObjectsFound]);

  // Apply per-object visibility toggles from the Layers panel
  useEffect(() => {
    if (!visibleObjects || visibleObjects.size === 0) {
      scene.traverse((child) => { child.visible = true; });
    } else {
      scene.traverse((child) => {
        if (child.name) {
          child.visible = visibleObjects.has(child.name);
        }
      });
    }
  }, [scene, visibleObjects]);

  // Center the model and floor it on y=0
  const [position, scale] = useMemo(() => {
    // Temporarily show all children so the bounding box is correct
    scene.traverse((child) => { child.visible = true; });
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // Scale so the longest dimension fits within 28 units — a balanced
    // size that looks good with the default camera (35, 12, 35)
    const maxDim = Math.max(size.x, size.y, size.z);
    const s = maxDim > 0 ? 28 / maxDim : 1;
    return [
      [-center.x * s, -box.min.y * s, -center.z * s] as [number, number, number],
      [s, s, s] as [number, number, number],
    ];
  }, [scene]);

  return (
    <group position={position} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}
