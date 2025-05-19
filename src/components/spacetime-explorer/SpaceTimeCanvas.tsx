
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
    // Change: Consider all objects with mass > 0 as force exerters
    const forceExerters = simObjectsArray.filter(exerter => exerter.mass > 0);

    simObjectsArray.forEach(obj => { // obj is the object being AFFECTED
      if (!isFinite(obj.threePosition.x) || !isFinite(obj.threePosition.y) || !isFinite(obj.threePosition.z) ||
          !isFinite(obj.threeVelocity.x) || !isFinite(obj.threeVelocity.y) || !isFinite(obj.threeVelocity.z)) {
        console.warn(`Object ${obj.name} has invalid initial state for physics update. Skipping.`);
        return;
      }
      
      const totalForce = new THREE.Vector3(0, 0, 0);

      forceExerters.forEach(exerter => { // exerter is the object EXERTING force
        if (obj.id === exerter.id) return; // An object does not exert force on itself

        if (!isFinite(exerter.threePosition.x) || !isFinite(exerter.threePosition.y) || !isFinite(exerter.threePosition.z)) {
          console.warn(`Force-exerting object ${exerter.name} has invalid position. Skipping force contribution.`);
          return;
        }

        const direction = new THREE.Vector3().subVectors(exerter.threePosition, obj.threePosition);
        let distanceSq = direction.lengthSq();

        if (distanceSq < 0.0001) { 
            distanceSq = 0.0001; 
        }

        const minInteractionDistance = (obj.radius + exerter.radius) * 0.5; 
        const effectiveDistanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
        
        if (effectiveDistanceSq === 0) {
          console.warn(`Effective distance squared is zero between ${obj.name} and ${exerter.name}. Skipping force.`);
          return;
        }

        // Mass of the object being affected, for force calculation (F = G*m1*m2/r^2).
        // If obj.mass is 0 (test particle), use 1 for m2 in F = G*m_exerter*m_obj_effective/r^2.
        // This means test particles experience force proportional to m_exerter.
        const objEffectiveMassForForce = obj.mass === 0 ? 1 : obj.mass;
        const massProduct = exerter.mass * objEffectiveMassForForce; 
        const forceMagnitude = (G * massProduct) / effectiveDistanceSq;
        
        if (!isFinite(forceMagnitude)) {
          console.warn(`Force magnitude is not finite for object ${obj.name} due to ${exerter.name}. DistSq: ${distanceSq}, EffDistSq: ${effectiveDistanceSq}. Skipping force.`);
          return; 
        }
        
        const force = direction.normalize().multiplyScalar(forceMagnitude);
        totalForce.add(force);
      });
      
      // Mass for acceleration (a = F/m). If obj.mass is 0 (test particle), use 1 for its mass.
      const currentMassForAcceleration = obj.mass > 0 ? obj.mass : 1; 
      const acceleration = totalForce.divideScalar(currentMassForAcceleration);

      if (!isFinite(acceleration.x) || !isFinite(acceleration.y) || !isFinite(acceleration.z)) {
        console.warn(`Acceleration is not finite for object ${obj.name}. Resetting acceleration for this step.`);
        acceleration.set(0,0,0); 
      }
      
      const deltaVelocity = acceleration.clone().multiplyScalar(dt);
      obj.threeVelocity.add(deltaVelocity);

      if (!isFinite(obj.threeVelocity.x) || !isFinite(obj.threeVelocity.y) || !isFinite(obj.threeVelocity.z)) {
        console.warn(`Velocity became non-finite for object ${obj.name}. Reverting delta V and attempting to stop.`);
        obj.threeVelocity.sub(deltaVelocity); 
        obj.threeVelocity.set(0,0,0); 
      }

      const deltaPosition = obj.threeVelocity.clone().multiplyScalar(dt);
      obj.threePosition.add(deltaPosition);

      if (!isFinite(obj.threePosition.x) || !isFinite(obj.threePosition.y) || !isFinite(obj.threePosition.z)) {
        console.warn(`Position became non-finite for object ${obj.name}. Reverting delta P and stopping velocity.`);
        obj.threePosition.sub(deltaPosition); 
        obj.threeVelocity.set(0,0,0); 
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
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) scene.remove(line); 
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
            (line.material as THREE.LineBasicMaterial).color.set(simObj.color); 
            line.geometry.setFromPoints(points);
            line.geometry.attributes.position.needsUpdate = true; 
            if (!line.parent) scene.add(line); 
          }
        } else if (line?.parent) { 
          scene.remove(line);
        }
      } else { 
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) {
          scene.remove(line);
        }
      }
    });
  }, [showTrajectories, trajectoryLength]);

  const deformGrid = useCallback(() => {
    if (!gridPlaneRef.current) return;
  
    const objectsWithMassForGrid = Array.from(simulationObjectsRef.current.values())
      .filter(o => o.mass > 0 && 
                   isFinite(o.threePosition.x) && isFinite(o.threePosition.y) && isFinite(o.threePosition.z));
  
    const positions = gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const originalPositions = (gridPlaneRef.current.geometry.userData.originalPositions as THREE.BufferAttribute | undefined);
  
    if (!originalPositions) {
      console.warn("Original grid positions not found for deformation.");
      return; 
    }
  
    const vertex = new THREE.Vector3();
  
    if (objectsWithMassForGrid.length === 0) { 
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        positions.setZ(i, vertex.z); 
      }
    } else {
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        const localX = vertex.x; 
        const localPlaneY = vertex.y; 
    
        let totalDisplacement = 0;
        objectsWithMassForGrid.forEach(mo => {
          const moWorldX = mo.threePosition.x; 
          const moWorldZ = mo.threePosition.z; // Note: In THREE.js PlaneGeometry, 'y' is the grid's depth on the plane
    
          const dx = localX - moWorldX;
          const dz = localPlaneY - moWorldZ; 
          const distanceOnPlaneSq = dx * dx + dz * dz;
          
          const safeDistanceOnPlaneSq = Math.max(distanceOnPlaneSq, 0.0001);

          const wellStrength = mo.mass * 0.015; 
          const falloffFactor = Math.max(mo.mass * 2, 0.1); 
    
          const displacement = -wellStrength * Math.exp(-safeDistanceOnPlaneSq / falloffFactor);
          if (isFinite(displacement)) {
              totalDisplacement += displacement;
          }
        });
        const maxDisplacement = GRID_SIZE / 5;
        positions.setZ(i, originalPositions.getZ(i) + Math.max(-maxDisplacement, Math.min(maxDisplacement, totalDisplacement))); 
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
    scene.background = new THREE.Color(0x222222); 

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); 
    directionalLight.position.set(50, 80, 60);
    directionalLight.castShadow = true; 
    scene.add(directionalLight);

    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_DIVISIONS, GRID_DIVISIONS);
    const planeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8A2BE2, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.3, 
      metalness: 0.1, 
      roughness: 0.9, 
    });
    const gridPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    gridPlane.rotation.x = -Math.PI / 2; 
    gridPlane.receiveShadow = true; 
    scene.add(gridPlane);
    gridPlaneRef.current = gridPlane;
    if (gridPlaneRef.current) { 
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current);
    const currentPropIds = new Set<string>();

    const isValidVector = (v: {x:number, y:number, z:number}) => v && isFinite(v.x) && isFinite(v.y) && isFinite(v.z);

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObj = newSimMap.get(objData.id);
      let threeMesh = objectsMapRef.current.get(objData.id);

      const propPos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const propVel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
      const propRadius = objData.radius > 0 ? objData.radius : 1;
      // Ensure mass is correctly sourced, defaulting to 0 if undefined (especially for orbiters)
      const propMass = (objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0));


      if (!simObj || !threeMesh) { 
        const newThreePosition = new THREE.Vector3(propPos.x, propPos.y, propPos.z);
        const newThreeVelocity = new THREE.Vector3(propVel.x, propVel.y, propVel.z);
        simObj = {
          id: objData.id,
          type: objData.type,
          mass: propMass,
          threePosition: newThreePosition,
          threeVelocity: newThreeVelocity,
          radius: propRadius,
          color: objData.color,
          name: objData.name,
        };
        newSimMap.set(objData.id, simObj);

        if (threeMesh) { 
            scene.remove(threeMesh);
            threeMesh.geometry.dispose();
            if (Array.isArray(threeMesh.material)) threeMesh.material.forEach(m => m.dispose());
            else (threeMesh.material as THREE.Material).dispose();
            objectsMapRef.current.delete(objData.id);
        }
        const geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: simObj.color, metalness:0.3, roughness:0.6 });
        threeMesh = new THREE.Mesh(geometry, material);
        threeMesh.name = objData.id; 
        threeMesh.castShadow = true; 
        scene.add(threeMesh);
        objectsMapRef.current.set(objData.id, threeMesh);
        threeMesh.position.copy(newThreePosition);
        trajectoryPointsRef.current.set(objData.id, []);
      } else { 
        // Update non-physics properties that can change live
        simObj.mass = propMass; // Mass can now change live, affecting physics
        simObj.name = objData.name;
        simObj.type = objData.type;

        // Update visual properties if changed
        if (simObj.radius !== propRadius) {
           simObj.radius = propRadius;
           threeMesh.geometry.dispose();
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        }
        if (simObj.color !== objData.color) {
            simObj.color = objData.color;
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(simObj.color);
        }
        
        // If simulation is NOT running, update position and velocity from props.
        // Otherwise, physics engine controls them.
        if (simulationStatus !== 'running') {
          const currentSimPosVec = new THREE.Vector3(propPos.x, propPos.y, propPos.z);
          const currentSimVelVec = new THREE.Vector3(propVel.x, propVel.y, propVel.z);

          if (!simObj.threePosition.equals(currentSimPosVec)) {
            simObj.threePosition.copy(currentSimPosVec);
            if(isValidVector(simObj.threePosition)) threeMesh.position.copy(simObj.threePosition);
            trajectoryPointsRef.current.set(objData.id, []); // Reset trajectory on external position change
          }
          if (!simObj.threeVelocity.equals(currentSimVelVec)) {
            simObj.threeVelocity.copy(currentSimVelVec);
            trajectoryPointsRef.current.set(objData.id, []); // Reset trajectory on external velocity change
          }
        }
      }
    });

    simulationObjectsRef.current.forEach((simObjInternal, id) => {
      if (!currentPropIds.has(id)) {
        const meshToRemove = objectsMapRef.current.get(id);
        if (meshToRemove) {
          scene.remove(meshToRemove);
          meshToRemove.geometry.dispose();
          if (Array.isArray(meshToRemove.material)) meshToRemove.material.forEach(m => m.dispose());
          else (meshToRemove.material as THREE.Material).dispose();
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

  }, [objects, simulationStatus]); 

  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all dynamic trajectory data
      trajectoriesRef.current.forEach((line) => {
        sceneRef.current?.remove(line);
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear();
      
      // Reset simulation objects to their initial states from 'objects' prop
      const updatedSimMap = new Map<string, SimulationObjectInternal>();
      const isValidVector = (v: {x:number, y:number, z:number}) => v && isFinite(v.x) && isFinite(v.y) && isFinite(v.z);

      objects.forEach(objData => {
        const pos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
        const vel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
        const propMass = (objData.type === 'massive' ? (objData as MassiveObject).mass : ((objData as OrbiterObject).mass || 0));

        const threePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const threeVel = new THREE.Vector3(vel.x, vel.y, vel.z);
        
        updatedSimMap.set(objData.id, {
          id: objData.id,
          type: objData.type,
          mass: propMass,
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
      
      // Explicitly update trajectories and grid based on reset state
      updateTrajectories(); 
      deformGrid(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationStatus, objects]); // Removed updateTrajectories, deformGrid from deps as they are stable callbacks

  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background" />;
};

export default SpaceTimeCanvas;
