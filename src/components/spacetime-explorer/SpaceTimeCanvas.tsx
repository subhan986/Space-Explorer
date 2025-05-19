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
const G = 50; 

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
      // Ensure current object's position and velocity are valid before calculating forces
      if (!isFinite(obj.threePosition.x) || !isFinite(obj.threePosition.y) || !isFinite(obj.threePosition.z) ||
          !isFinite(obj.threeVelocity.x) || !isFinite(obj.threeVelocity.y) || !isFinite(obj.threeVelocity.z)) {
        console.warn(`Object ${obj.name} has invalid initial state for physics update. Skipping.`);
        return;
      }
      
      const totalForce = new THREE.Vector3(0, 0, 0);

      massiveObjects.forEach(massiveObj => {
        if (obj.id === massiveObj.id) return;

        // Ensure massiveObj's position is valid
        if (!isFinite(massiveObj.threePosition.x) || !isFinite(massiveObj.threePosition.y) || !isFinite(massiveObj.threePosition.z)) {
          console.warn(`Massive object ${massiveObj.name} has invalid position. Skipping force contribution.`);
          return;
        }

        const direction = new THREE.Vector3().subVectors(massiveObj.threePosition, obj.threePosition);
        let distanceSq = direction.lengthSq();

        // Prevent division by zero or extremely small distances
        if (distanceSq < 0.0001) { 
            distanceSq = 0.0001; 
        }

        // Soften interaction at very close distances to prevent extreme accelerations
        const minInteractionDistance = (obj.radius + massiveObj.radius) * 0.5; 
        const effectiveDistanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
        
        if (effectiveDistanceSq === 0) { // Should be caught by distanceSq < 0.0001, but as a safeguard
          console.warn(`Effective distance squared is zero between ${obj.name} and ${massiveObj.name}. Skipping force.`);
          return;
        }

        // Use a conceptual mass of 1 for orbiters if their mass is 0 for force calculation stability
        const objEffectiveMassForForce = obj.mass === 0 && obj.type === 'orbiter' ? 1 : obj.mass;
        const massProduct = massiveObj.mass * objEffectiveMassForForce; 
        const forceMagnitude = (G * massProduct) / effectiveDistanceSq;
        
        if (!isFinite(forceMagnitude)) {
          console.warn(`Force magnitude is not finite for object ${obj.name} due to ${massiveObj.name}. DistSq: ${distanceSq}, EffDistSq: ${effectiveDistanceSq}. Skipping force.`);
          return; 
        }
        
        const force = direction.normalize().multiplyScalar(forceMagnitude);
        totalForce.add(force);
      });
      
      // Use 1 for acceleration calculation if mass is 0 to prevent division by zero
      const currentMassForAcceleration = obj.mass > 0 ? obj.mass : 1; 
      const acceleration = totalForce.divideScalar(currentMassForAcceleration);

      if (!isFinite(acceleration.x) || !isFinite(acceleration.y) || !isFinite(acceleration.z)) {
        console.warn(`Acceleration is not finite for object ${obj.name}. Resetting acceleration for this step.`);
        acceleration.set(0,0,0); 
      }
      
      const deltaVelocity = acceleration.clone().multiplyScalar(dt); // Clone before multiply
      obj.threeVelocity.add(deltaVelocity);

      if (!isFinite(obj.threeVelocity.x) || !isFinite(obj.threeVelocity.y) || !isFinite(obj.threeVelocity.z)) {
        console.warn(`Velocity became non-finite for object ${obj.name}. Reverting delta V and attempting to stop.`);
        obj.threeVelocity.sub(deltaVelocity); // Revert this step's velocity change
        obj.threeVelocity.set(0,0,0); // Stop it
      }

      const deltaPosition = obj.threeVelocity.clone().multiplyScalar(dt); // Clone before multiply
      obj.threePosition.add(deltaPosition);

      if (!isFinite(obj.threePosition.x) || !isFinite(obj.threePosition.y) || !isFinite(obj.threePosition.z)) {
        console.warn(`Position became non-finite for object ${obj.name}. Reverting delta P and stopping velocity.`);
        obj.threePosition.sub(deltaPosition); // Revert this step's position change
        obj.threeVelocity.set(0,0,0); // Stop it to prevent further issues
      }

      const threeMesh = objectsMapRef.current.get(obj.id);
      if (threeMesh && isFinite(obj.threePosition.x) && isFinite(obj.threePosition.y) && isFinite(obj.threePosition.z)) {
        threeMesh.position.copy(obj.threePosition);
      } else if (threeMesh) {
        console.error(`Object ${obj.name} has invalid position, mesh not updated. Position:`, obj.threePosition);
      }
    });
  }, []);

  const updateTrajectories = useCallback(() => {
    if (!sceneRef.current || !simulationObjectsRef.current) return;
    const scene = sceneRef.current;

    simulationObjectsRef.current.forEach(simObj => {
      if (!isFinite(simObj.threePosition.x) || !isFinite(simObj.threePosition.y) || !isFinite(simObj.threePosition.z)) {
        // console.warn(`Skipping trajectory update for ${simObj.name} due to invalid position.`);
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) scene.remove(line); // Remove old line if position is now invalid
        return; 
      }

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
            (line.material as THREE.LineBasicMaterial).color.set(simObj.color); // Update color in case it changed
            line.geometry.setFromPoints(points);
            line.geometry.attributes.position.needsUpdate = true; 
            if (!line.parent) scene.add(line); 
          }
        } else if (line?.parent) { // Remove line if not enough points and it exists
          scene.remove(line);
        }
      } else { 
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) {
          scene.remove(line);
        }
        // Optionally clear points when trajectories are turned off
        // trajectoryPointsRef.current.set(simObj.id, []);
      }
    });
  }, [showTrajectories, trajectoryLength]);

  const deformGrid = useCallback(() => {
    if (!gridPlaneRef.current) return;
  
    const massiveSimObjects = Array.from(simulationObjectsRef.current.values())
      .filter(o => o.type === 'massive' && o.mass > 0 && 
                   isFinite(o.threePosition.x) && isFinite(o.threePosition.y) && isFinite(o.threePosition.z));
  
    const positions = gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const originalPositions = (gridPlaneRef.current.geometry.userData.originalPositions as THREE.BufferAttribute | undefined);
  
    if (!originalPositions) {
      console.warn("Original grid positions not found for deformation.");
      return; 
    }
  
    const vertex = new THREE.Vector3();
  
    if (massiveSimObjects.length === 0) { 
      // Reset grid to flat if no (valid) massive objects
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        positions.setZ(i, vertex.z); // Reset to original Z, which should be 0 for a flat plane
      }
    } else {
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        const localX = vertex.x; // World X of the grid vertex
        const localPlaneY = vertex.y; // World Z of the grid vertex (since plane is rotated)
    
        let totalDisplacement = 0;
        massiveSimObjects.forEach(mo => {
          const moWorldX = mo.threePosition.x; 
          const moWorldZ = mo.threePosition.z; // Massive object's Z is on the plane's Y
    
          const dx = localX - moWorldX;
          const dz = localPlaneY - moWorldZ; // Compare grid's Y (world Z) with object's Z
          const distanceOnPlaneSq = dx * dx + dz * dz;
          
          // Ensure distanceOnPlaneSq is not extremely small to avoid Math.exp issues
          const safeDistanceOnPlaneSq = Math.max(distanceOnPlaneSq, 0.0001);

          const wellStrength = mo.mass * 0.015; 
          // Falloff factor should ideally not be zero to prevent division by zero in exponent.
          // If mass is small, falloff can be small, leading to very localized effect.
          const falloffFactor = Math.max(mo.mass * 2, 0.1); // Prevent zero or too small falloff   
    
          const displacement = -wellStrength * Math.exp(-safeDistanceOnPlaneSq / falloffFactor);
          if (isFinite(displacement)) {
              totalDisplacement += displacement;
          } else {
            // console.warn(`Grid displacement calculation resulted in non-finite value for object ${mo.name}`);
          }
        });
        // Clamp displacement to prevent extreme warping
        const maxDisplacement = GRID_SIZE / 5;
        positions.setZ(i, originalPositions.getZ(i) + Math.max(-maxDisplacement, Math.min(maxDisplacement, totalDisplacement))); 
      }
    }
    positions.needsUpdate = true;
    gridPlaneRef.current.geometry.computeVertexNormals(); // Important for lighting
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222); // Dark grey background

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
    controls.enableDamping = true; // Smooth camera movement

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Softer ambient light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Brighter directional
    directionalLight.position.set(50, 80, 60);
    directionalLight.castShadow = true; // Optional: for shadows
    scene.add(directionalLight);

    // Grid Plane
    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_DIVISIONS, GRID_DIVISIONS);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8A2BE2, // Violet
      wireframe: true, 
      transparent: true, 
      opacity: 0.3, // Slightly more opaque
      metalness: 0.1, // Less metallic
      roughness: 0.9, // More rough
    });
    const gridPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    gridPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    gridPlane.receiveShadow = true; // Optional: for shadows
    scene.add(gridPlane);
    gridPlaneRef.current = gridPlane;
    // Store original positions for deformation reset
    if (gridPlaneRef.current) { 
        gridPlaneRef.current.geometry.userData.originalPositions = 
            (gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute).clone();
    }

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      
      if (simulationStatus === 'running') {
        const dt = simulationSpeed * (1 / 60); // Time step
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
      sceneRef.current?.clear(); // Clear scene children
    };
  // Dependencies for main setup effect
  }, []); // Removed simulationSpeed, status, etc. as they are handled by animate loop or other effects


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

      const isValidVector = (v: {x:number, y:number, z:number}) => isFinite(v.x) && isFinite(v.y) && isFinite(v.z);

      const pos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const vel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};


      if (!simObj || !threeMesh) { 
        const newThreePosition = new THREE.Vector3(pos.x, pos.y, pos.z);
        const newThreeVelocity = new THREE.Vector3(vel.x, vel.y, vel.z);
        simObj = {
          id: objData.id,
          type: objData.type,
          mass: objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0),
          threePosition: newThreePosition,
          threeVelocity: newThreeVelocity,
          radius: objData.radius > 0 ? objData.radius : 1, // Ensure positive radius
          color: objData.color,
          name: objData.name,
        };
        newSimMap.set(objData.id, simObj);

        if (threeMesh) { // Remove old mesh if it somehow exists without simObj
            scene.remove(threeMesh);
            threeMesh.geometry.dispose();
            if (Array.isArray(threeMesh.material)) threeMesh.material.forEach(m => m.dispose());
            else (threeMesh.material as THREE.Material).dispose();
            objectsMapRef.current.delete(objData.id);
        }
        const geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: simObj.color, metalness:0.3, roughness:0.6 });
        const newMesh = new THREE.Mesh(geometry, material);
        newMesh.name = objData.id; // For easier debugging in Three.js inspector
        newMesh.castShadow = true; // Optional
        scene.add(newMesh);
        objectsMapRef.current.set(objData.id, newMesh);
        newMesh.position.copy(newThreePosition);
         // Clear any old trajectory points for this new/re-added object
        trajectoryPointsRef.current.set(objData.id, []);


      } else { 
        const posChanged = !simObj.threePosition.equals(pos as THREE.Vector3);
        const velChanged = !simObj.threeVelocity.equals(vel as THREE.Vector3);
        const massChanged = simObj.mass !== (objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0));
        const radiusChanged = simObj.radius !== (objData.radius > 0 ? objData.radius : 1);
        const colorChanged = simObj.color !== objData.color;

        if (posChanged) simObj.threePosition.set(pos.x, pos.y, pos.z);
        if (velChanged) simObj.threeVelocity.set(vel.x, vel.y, vel.z);
        if (massChanged) simObj.mass = objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0);
        if (radiusChanged) simObj.radius = objData.radius > 0 ? objData.radius : 1;
        if (colorChanged) simObj.color = objData.color;
        
        simObj.name = objData.name; // Update name
        simObj.type = objData.type; // Update type (though less likely to change dynamically)


        // Only update mesh position directly if simulation is not running, or if the position changed externally
        if (posChanged || simulationStatus !== 'running') {
            if(isValidVector(simObj.threePosition)) threeMesh.position.copy(simObj.threePosition);
        }
        if (radiusChanged) {
           threeMesh.geometry.dispose();
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        }
        if (colorChanged) {
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(simObj.color);
        }
      }
    });

    // Remove objects from scene and simulation that are no longer in the props
    simulationObjectsRef.current.forEach((simObjInternal, id) => {
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

  // This effect should run when `objects` prop changes, or when simulation is stopped/reset
  // to ensure visual state matches the source of truth.
  }, [objects, simulationStatus]); 

  // Effect to handle simulation reset (status === 'stopped')
  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all existing trajectory lines from the scene
      trajectoriesRef.current.forEach((line) => {
        sceneRef.current?.remove(line);
      });
      // Clear the stored trajectory lines and their points
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear();
      
      // Reset simulation objects to their initial states from the `objects` prop
      const updatedSimMap = new Map<string, SimulationObjectInternal>();
      objects.forEach(objData => {
        const isValidVector = (v: {x:number, y:number, z:number}) => isFinite(v.x) && isFinite(v.y) && isFinite(v.z);
        const pos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
        const vel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};

        const threePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const threeVel = new THREE.Vector3(vel.x, vel.y, vel.z);
        
        updatedSimMap.set(objData.id, {
          id: objData.id,
          type: objData.type,
          mass: objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0),
          threePosition: threePos,
          threeVelocity: threeVel,
          radius: objData.radius > 0 ? objData.radius : 1,
          color: objData.color,
          name: objData.name,
        });
        
        const threeMesh = objectsMapRef.current.get(objData.id);
        if (threeMesh) {
          if(isValidVector(threePos)) threeMesh.position.copy(threePos);
        }
      });
      simulationObjectsRef.current = updatedSimMap;
      
      // Update trajectories (which will remove them if empty or showTrajectories is false)
      updateTrajectories(); 
      // Reset grid deformation
      deformGrid(); 
    }
  }, [simulationStatus, objects, updateTrajectories, deformGrid]); // Added dependencies

  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background" />;
};

export default SpaceTimeCanvas;

    