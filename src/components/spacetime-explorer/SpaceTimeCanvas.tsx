// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneObject, MassiveObject, OrbiterObject, ObjectType } from '@/types/spacetime';
import { GRID_SIZE, GRID_DIVISIONS, INITIAL_CAMERA_POSITION } from '@/lib/constants';

interface SpaceTimeCanvasProps {
  objects: SceneObject[];
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  onObjectSelected?: (objectId: string | null) => void;
  showTrajectories: boolean;
  trajectoryLength: number;
}

// Internal representation for simulation objects
interface SimulationObjectInternal {
  id: string;
  type: ObjectType;
  mass: number;
  threePosition: THREE.Vector3;
  threeVelocity: THREE.Vector3;
  radius: number;
  color: string;
  name: string;
}

// Gravitational Constant (tuned for visual effect)
const G = 100;

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
  
  const objectsMapRef = useRef<Map<string, THREE.Mesh>>(new Map()); // Visual meshes
  const trajectoriesRef = useRef<Map<string, THREE.Line>>(new Map()); // Trajectory lines
  const trajectoryPointsRef = useRef<Map<string, THREE.Vector3[]>>(new Map()); // Points for trajectories
  
  const simulationObjectsRef = useRef<Map<string, SimulationObjectInternal>>(new Map()); // Physics state
  const gridPlaneRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null>(null);
  const animationFrameIdRef = useRef<number>();

  const updatePhysics = useCallback((dt: number) => {
    if (!simulationObjectsRef.current) return;

    const simObjectsArray = Array.from(simulationObjectsRef.current.values());
    const massiveObjects = simObjectsArray.filter(obj => obj.type === 'massive' && obj.mass > 0);

    simObjectsArray.forEach(obj => {
      const totalForce = new THREE.Vector3(0, 0, 0);

      massiveObjects.forEach(massiveObj => {
        if (obj.id === massiveObj.id) return;

        const direction = new THREE.Vector3().subVectors(massiveObj.threePosition, obj.threePosition);
        const distanceSq = direction.lengthSq();

        if (distanceSq < 0.0001) return; // Avoid division by zero or extreme forces

        // Soften interaction at very close distances to prevent extreme accelerations
        const minInteractionDistance = (obj.radius + massiveObj.radius) * 0.5; // Half sum of radii
        const effectiveDistanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
        
        const massProduct = massiveObj.mass * (obj.mass === 0 && obj.type === 'orbiter' ? 1 : obj.mass); // Treat orbiter with 0 mass as 1 for force calc
        const forceMagnitude = (G * massProduct) / effectiveDistanceSq;
        
        const force = direction.normalize().multiplyScalar(forceMagnitude);
        totalForce.add(force);
      });
      
      const currentMassForAcceleration = obj.mass > 0 ? obj.mass : 1; // Use 1 if mass is 0 to avoid division by zero
      const acceleration = totalForce.divideScalar(currentMassForAcceleration);
      
      obj.threeVelocity.add(acceleration.multiplyScalar(dt));
      obj.threePosition.add(obj.threeVelocity.clone().multiplyScalar(dt));

      const threeMesh = objectsMapRef.current.get(obj.id);
      if (threeMesh) {
        threeMesh.position.copy(obj.threePosition);
      }
    });
  }, []);

  const updateTrajectories = useCallback(() => {
    if (!sceneRef.current || !simulationObjectsRef.current) return;
    const scene = sceneRef.current;

    simulationObjectsRef.current.forEach(simObj => {
      const points = trajectoryPointsRef.current.get(simObj.id) || [];
      
      if (showTrajectories) {
        points.push(simObj.threePosition.clone());
        while (points.length > trajectoryLength) {
          points.shift();
        }
        trajectoryPointsRef.current.set(simObj.id, points);

        let line = trajectoriesRef.current.get(simObj.id);
        if (points.length > 1) {
          if (!line) {
            const material = new THREE.LineBasicMaterial({ color: simObj.color, transparent: true, opacity: 0.7 });
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            line = new THREE.Line(geometry, material);
            line.name = `trajectory_${simObj.id}`;
            trajectoriesRef.current.set(simObj.id, line);
            scene.add(line);
          } else {
            (line.material as THREE.LineBasicMaterial).color.set(simObj.color);
            line.geometry.setFromPoints(points);
            line.geometry.attributes.position.needsUpdate = true; // Important for dynamic lines
            if (!line.parent) scene.add(line); // Re-add if was removed
          }
        }
      } else { // Hide trajectories
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) {
          scene.remove(line);
          // Don't dispose here, just remove from scene. Points are still kept.
        }
      }
    });
  }, [showTrajectories, trajectoryLength]);

  const deformGrid = useCallback(() => {
    if (!gridPlaneRef.current || simulationObjectsRef.current.size === 0) return;
  
    const massiveSimObjects = Array.from(simulationObjectsRef.current.values())
      .filter(o => o.type === 'massive' && o.mass > 0);
  
    const positions = gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const originalPositions = (gridPlaneRef.current.geometry.userData.originalPositions as THREE.BufferAttribute | undefined);
  
    if (!originalPositions) return; // Should have been set during init
  
    const vertex = new THREE.Vector3();
  
    if (massiveSimObjects.length === 0) { // Reset grid if no massive objects
      for (let i = 0; i < positions.count; i++) {
        positions.setZ(i, 0); // Local Z is the dimension perpendicular to the plane
      }
    } else {
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        const localX = vertex.x;
        const localY = vertex.y; // This is along one of the plane's axes
    
        let totalDisplacement = 0;
        massiveSimObjects.forEach(mo => {
          const moLocalX = mo.threePosition.x; // Assuming grid is at world origin
          const moLocalPlaneY = mo.threePosition.z; // World Z maps to grid's other axis
    
          const dx = localX - moLocalX;
          const dy = localY - moLocalPlaneY;
          const distanceOnPlaneSq = dx * dx + dy * dy;
          
          // Adjust strength and falloff of the well
          const wellStrength = mo.mass * 0.015; // Depth of the well
          const falloffFactor = mo.mass * 2;   // How quickly it diminishes
    
          const displacement = -wellStrength * Math.exp(-distanceOnPlaneSq / falloffFactor);
          totalDisplacement += displacement;
        });
        positions.setZ(i, Math.max(-GRID_SIZE/5, totalDisplacement)); // Clamp displacement
      }
    }
    positions.needsUpdate = true;
    gridPlaneRef.current.geometry.computeVertexNormals();
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222); // Matches globals.css --background for dark theme

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    cameraRef.current = camera;
    camera.position.set(INITIAL_CAMERA_POSITION.x, INITIAL_CAMERA_POSITION.y, INITIAL_CAMERA_POSITION.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 80, 60);
    scene.add(directionalLight);

    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_DIVISIONS, GRID_DIVISIONS);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8A2BE2, // Matches --accent color from globals.css
      wireframe: true, 
      transparent: true, 
      opacity: 0.3,
      metalness: 0.2,
      roughness: 0.8,
    });
    const gridPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    gridPlane.rotation.x = -Math.PI / 2;
    scene.add(gridPlane);
    gridPlaneRef.current = gridPlane;
    if (gridPlaneRef.current) { // Ensure gridPlaneRef.current is not null
        gridPlaneRef.current.geometry.userData.originalPositions = 
            (gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute).clone();
    }


    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      
      if (simulationStatus === 'running') {
        const dt = simulationSpeed * (1 / 60);
        updatePhysics(dt);
        updateTrajectories();
        deformGrid();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (currentMount && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (currentMount && rendererRef.current) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      objectsMapRef.current.forEach(obj => {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else (obj.material as THREE.Material).dispose();
      });
      trajectoriesRef.current.forEach(line => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      gridPlaneRef.current?.geometry.dispose();
      (gridPlaneRef.current?.material as THREE.Material)?.dispose();
      sceneRef.current?.clear();
    };
  }, [simulationSpeed, simulationStatus, updatePhysics, updateTrajectories, deformGrid]);


  // Effect to synchronize external `objects` prop with internal `simulationObjectsRef` and THREE.js scene
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current);
    const currentPropIds = new Set<string>();

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObj = newSimMap.get(objData.id);
      const threeMesh = objectsMapRef.current.get(objData.id);

      if (!simObj || !threeMesh) { // New object or mesh needs creation
        const newThreePosition = new THREE.Vector3(objData.position.x, objData.position.y, objData.position.z);
        const newThreeVelocity = new THREE.Vector3(objData.velocity.x, objData.velocity.y, objData.velocity.z);
        simObj = {
          id: objData.id,
          type: objData.type,
          mass: objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0),
          threePosition: newThreePosition,
          threeVelocity: newThreeVelocity,
          radius: objData.radius,
          color: objData.color,
          name: objData.name,
        };
        newSimMap.set(objData.id, simObj);

        if (threeMesh) scene.remove(threeMesh); // remove old if exists for some reason
        const geometry = new THREE.SphereGeometry(objData.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: objData.color, metalness:0.3, roughness:0.6 });
        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = objData.id;
        scene.add(newMesh);
        objectsMapRef.current.set(objData.id, newMesh);
        newMesh.position.copy(newThreePosition);

      } else { // Existing object, update properties
        const posChanged = !simObj.threePosition.equals(objData.position as THREE.Vector3);
        const velChanged = !simObj.threeVelocity.equals(objData.velocity as THREE.Vector3);
        const massChanged = simObj.mass !== (objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0));

        if (posChanged) simObj.threePosition.set(objData.position.x, objData.position.y, objData.position.z);
        if (velChanged) simObj.threeVelocity.set(objData.velocity.x, objData.velocity.y, objData.velocity.z);
        if (massChanged) simObj.mass = objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0);
        
        simObj.radius = objData.radius;
        simObj.color = objData.color;
        simObj.name = objData.name;
        simObj.type = objData.type;

        if (posChanged || simulationStatus !== 'running') threeMesh.position.copy(simObj.threePosition);
        if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== objData.radius) {
           threeMesh.geometry.dispose();
           threeMesh.geometry = new THREE.SphereGeometry(objData.radius, 32, 32);
        }
        (threeMesh.material as THREE.MeshStandardMaterial).color.set(objData.color);
      }
    });

    // Remove simulation objects and their meshes if they are no longer in the `objects` prop
    simulationObjectsRef.current.forEach((_, id) => {
      if (!currentPropIds.has(id)) {
        const threeMesh = objectsMapRef.current.get(id);
        if (threeMesh) {
          scene.remove(threeMesh);
          threeMesh.geometry.dispose();
          if (Array.isArray(threeMesh.material)) threeMesh.material.forEach(m => m.dispose());
          else (threeMesh.material as THREE.Material).dispose();
          objectsMapRef.current.delete(id);
        }
        const trajectoryLine = trajectoriesRef.current.get(id);
        if (trajectoryLine) {
          scene.remove(trajectoryLine);
          trajectoryLine.geometry.dispose();
          (trajectoryLine.material as THREE.Material).dispose();
          trajectoriesRef.current.delete(id);
          trajectoryPointsRef.current.delete(id);
        }
        newSimMap.delete(id);
      }
    });
    simulationObjectsRef.current = newSimMap;

  }, [objects, simulationStatus]); // Rerun when objects list or simulationStatus changes

  // Effect for simulation status changes (e.g., reset trajectories on stop/reset)
  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all trajectory points and remove lines from scene
      trajectoriesRef.current.forEach((line) => {
        sceneRef.current?.remove(line);
        // Don't dispose lines here, updateTrajectories will handle visibility/creation
      });
      // Keep trajectoriesRef, but clear points
      trajectoryPointsRef.current.forEach(points => points.length = 0);
      
      // Re-sync simulation objects' positions/velocities from `objects` prop
      // This ensures that if the user manually edited values while paused/stopped,
      // those values are the starting point if the simulation runs again.
      const updatedSimMap = new Map<string, SimulationObjectInternal>();
      objects.forEach(objData => {
        const threePos = new THREE.Vector3(objData.position.x, objData.position.y, objData.position.z);
        const threeVel = new THREE.Vector3(objData.velocity.x, objData.velocity.y, objData.velocity.z);
        updatedSimMap.set(objData.id, {
          id: objData.id,
          type: objData.type,
          mass: objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0),
          threePosition: threePos,
          threeVelocity: threeVel,
          radius: objData.radius,
          color: objData.color,
          name: objData.name,
        });
        const threeMesh = objectsMapRef.current.get(objData.id);
        if (threeMesh) {
          threeMesh.position.copy(threePos);
        }
      });
      simulationObjectsRef.current = updatedSimMap;
      // Force trajectory update to hide them if needed, or clear them if they were visible
      updateTrajectories();
      deformGrid(); // Update grid to reflect potentially reset object positions
    }
  }, [simulationStatus, objects, updateTrajectories, deformGrid]);

  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background" />;
};

export default SpaceTimeCanvas;
