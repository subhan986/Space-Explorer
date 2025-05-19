// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneObject, MassiveObject, OrbiterObject, Vector3 as AppVector3 } from '@/types/spacetime';
import { GRID_SIZE, GRID_DIVISIONS, INITIAL_CAMERA_POSITION } from '@/lib/constants';

interface SpaceTimeCanvasProps {
  objects: SceneObject[];
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  onObjectSelected?: (objectId: string | null) => void; // Optional: if selection via canvas is implemented
  showTrajectories: boolean;
  trajectoryLength: number;
}

const SpaceTimeCanvas: React.FC<SpaceTimeCanvasProps> = ({
  objects,
  simulationStatus,
  simulationSpeed,
  onObjectSelected,
  showTrajectories,
  trajectoryLength,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const trajectoriesRef = useRef<Map<string, THREE.Line>>(new Map());
  const trajectoryPointsRef = useRef<Map<string, THREE.Vector3[]>>(new Map());

  // Grid plane reference for deformation
  const gridPlaneRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222); // Matches CSS background

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.set(INITIAL_CAMERA_POSITION.x, INITIAL_CAMERA_POSITION.y, INITIAL_CAMERA_POSITION.z);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    // Spacetime Grid (PlaneGeometry for deformation)
    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_DIVISIONS, GRID_DIVISIONS);
    const planeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x8A2BE2, // Accent color for grid lines
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const gridPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    gridPlane.rotation.x = -Math.PI / 2; // Lay flat
    scene.add(gridPlane);
    gridPlaneRef.current = gridPlane;
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      
      // Placeholder for simulation logic / object updates
      if (simulationStatus === 'running') {
        // TODO: Implement physics simulation step based on simulationSpeed
        // TODO: Update trajectoryPointsRef and trajectoriesRef
      }

      // Placeholder for grid deformation
      // deformGrid();

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      // Dispose geometries and materials if necessary
      objectsMapRef.current.forEach(obj => {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      });
      trajectoriesRef.current.forEach(line => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      gridPlaneRef.current?.geometry.dispose();
      (gridPlaneRef.current?.material as THREE.Material)?.dispose();
    };
  }, []);

  // Update objects in scene
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const currentIds = new Set<string>();

    objects.forEach(objData => {
      currentIds.add(objData.id);
      let threeObj = objectsMapRef.current.get(objData.id);

      if (!threeObj) {
        const geometry = new THREE.SphereGeometry(objData.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: objData.color });
        threeObj = new THREE.Mesh(geometry, material);
        threeObj.name = objData.id; // For potential picking
        scene.add(threeObj);
        objectsMapRef.current.set(objData.id, threeObj);
      } else {
        // Update existing object (e.g., radius, color if changed)
        (threeObj.geometry as THREE.SphereGeometry).parameters.radius !== objData.radius && threeObj.geometry.dispose();
        threeObj.geometry = new THREE.SphereGeometry(objData.radius, 32, 32);
        (threeObj.material as THREE.MeshStandardMaterial).color.set(objData.color);
      }
      threeObj.position.set(objData.position.x, objData.position.y, objData.position.z);
    });

    // Remove objects not in current list
    objectsMapRef.current.forEach((threeObj, id) => {
      if (!currentIds.has(id)) {
        scene.remove(threeObj);
        threeObj.geometry.dispose();
        if (Array.isArray(threeObj.material)) threeObj.material.forEach(m => m.dispose());
        else threeObj.material.dispose();
        objectsMapRef.current.delete(id);

        // Remove trajectory too
        const trajectoryLine = trajectoriesRef.current.get(id);
        if (trajectoryLine) {
          scene.remove(trajectoryLine);
          trajectoryLine.geometry.dispose();
          (trajectoryLine.material as THREE.Material).dispose();
          trajectoriesRef.current.delete(id);
          trajectoryPointsRef.current.delete(id);
        }
      }
    });
  }, [objects]);


  // Placeholder for grid deformation logic
  // const deformGrid = () => {
  //   if (!gridPlaneRef.current || objects.length === 0) return;
  //   const massiveObjects = objects.filter(o => o.type === 'massive') as MassiveObject[];
  //   if (massiveObjects.length === 0) return; // Only deform for massive objects

  //   const positions = gridPlaneRef.current.geometry.attributes.position;
  //   const worldPosition = new THREE.Vector3();

  //   for (let i = 0; i < positions.count; i++) {
  //     worldPosition.fromBufferAttribute(positions, i);
  //     gridPlaneRef.current.localToWorld(worldPosition); // Get vertex in world space (relative to grid's initial flat position)
      
  //     let totalDisplacement = 0;
  //     massiveObjects.forEach(mo => {
  //       const moPosition = new THREE.Vector3(mo.position.x, mo.position.y, mo.position.z);
  //       // distance on the XZ plane from the massive object to the vertex
  //       const distance = Math.sqrt(Math.pow(worldPosition.x - moPosition.x, 2) + Math.pow(worldPosition.z - moPosition.z, 2));
  //       if (distance < 0.1) { // Avoid division by zero or extreme values
  //         totalDisplacement += -mo.mass / 0.1; // Max displacement
  //       } else {
  //         totalDisplacement += -mo.mass / (distance * 0.5); // Simplified gravity well, tune factor 0.5
  //       }
  //     });
  //     // Apply displacement to the original Z component (which is Y in local grid space before rotation)
  //     positions.setZ(i, Math.max(-GRID_SIZE/4, Math.min(0, totalDisplacement))); // Clamp displacement
  //   }
  //   positions.needsUpdate = true;
  //   gridPlaneRef.current.geometry.computeVertexNormals(); // Important for lighting if not wireframe
  // };


  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl" />;
};

export default SpaceTimeCanvas;
