
// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneObject, ObjectType } from '@/types/spacetime';
import { GRID_SIZE, GRID_DIVISIONS, INITIAL_CAMERA_POSITION, G_CONSTANT } from '@/lib/constants';

interface SpaceTimeCanvasProps {
  objects: SceneObject[];
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  onObjectSelected?: (objectId: string | null) => void;
  showTrajectories: boolean;
  trajectoryLength: number;
}

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

  const simulationObjectsRef = useRef<Map<string, SimulationObjectInternal>>(new Map());
  const gridPlaneRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null>(null);
  const animationFrameIdRef = useRef<number>();

  const isValidVector = useCallback((v: {x:number, y:number, z:number} | undefined): v is {x:number, y:number, z:number} => {
    return !!v && isFinite(v.x) && isFinite(v.y) && isFinite(v.z);
  },[]);

  const updatePhysics = useCallback((dt: number) => {
    if (!simulationObjectsRef.current) return;

    const simObjectsArray = Array.from(simulationObjectsRef.current.values());
    const forceExerters = simObjectsArray.filter(exerter => exerter.mass > 0 && isValidVector(exerter.threePosition));

    simObjectsArray.forEach(obj => {
      if (!isValidVector(obj.threePosition) || !isValidVector(obj.threeVelocity)) {
        console.warn(`Object ${obj.id} has invalid position or velocity, skipping physics update.`);
        return;
      }

      const totalForce = new THREE.Vector3(0, 0, 0);

      forceExerters.forEach(exerter => {
        if (obj.id === exerter.id) return;

        if (!isValidVector(exerter.threePosition)) {
          console.warn(`Force exerter ${exerter.id} has invalid position, skipping interaction with ${obj.id}.`);
          return;
        }

        const direction = new THREE.Vector3().subVectors(exerter.threePosition, obj.threePosition);
        let distanceSq = direction.lengthSq();
        
        if (distanceSq < 0.000001) { // Prevent division by zero if objects are at the exact same spot
            distanceSq = 0.000001;
        }
        
        // Softening factor: minimum distance to prevent extreme forces when objects are too close.
        // Consider object radii for interaction "surface".
        const minInteractionDistance = (obj.radius + exerter.radius) * 0.5; // A bit arbitrary, can be tuned
        const effectiveDistanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);

        if (effectiveDistanceSq === 0) { // Should be caught by distanceSq check, but as a safeguard
          console.warn(`Effective distance squared is zero between ${obj.id} and ${exerter.id}.`);
          return;
        }

        let forceMagnitude;
        // Ensure obj.mass is treated as at least 1 for massless particles for force calculation if needed,
        // but acceleration will use its actual mass (or 1 if mass is 0).
        if (obj.mass > 0) { // Standard gravitational force
            forceMagnitude = (G_CONSTANT * exerter.mass * obj.mass) / effectiveDistanceSq;
        } else { // Object is massless (tracer), use a nominal mass of 1 for force interaction
            forceMagnitude = (G_CONSTANT * exerter.mass * 1.0) / effectiveDistanceSq;
        }


        if (!isFinite(forceMagnitude)) {
          console.warn(`Calculated force magnitude is not finite for ${obj.id} due to ${exerter.id}.`);
          return;
        }

        const force = direction.normalize().multiplyScalar(forceMagnitude);
        totalForce.add(force);
      });

      // Use a minimum mass of 1 for acceleration calculation if actual mass is 0 or less, to prevent division by zero.
      const currentMassForAcceleration = obj.mass > 0 ? obj.mass : 1.0;
      const acceleration = totalForce.divideScalar(currentMassForAcceleration);
      
      if (!isValidVector(acceleration)) {
        // console.warn(`Object ${obj.id} has invalid acceleration. Resetting to zero.`);
        acceleration.set(0,0,0); // Reset acceleration if it became invalid
      }

      const deltaVelocity = acceleration.clone().multiplyScalar(dt);
      obj.threeVelocity.add(deltaVelocity);

      if (!isValidVector(obj.threeVelocity)) {
        // console.warn(`Object ${obj.id} developed invalid velocity. Reverting delta V and attempting to zero out V.`);
        obj.threeVelocity.sub(deltaVelocity); // Revert the problematic delta
        obj.threeVelocity.set(0,0,0); // Attempt to stabilize by zeroing velocity
      }

      const deltaPosition = obj.threeVelocity.clone().multiplyScalar(dt);
      obj.threePosition.add(deltaPosition);

      if (!isValidVector(obj.threePosition)) {
        // console.warn(`Object ${obj.id} developed invalid position. Reverting delta P and zeroing V.`);
        obj.threePosition.sub(deltaPosition); // Revert delta P
        obj.threeVelocity.set(0,0,0); // Zero out velocity as position is unstable
      }

      const threeMesh = objectsMapRef.current.get(obj.id);
      if (threeMesh && isValidVector(obj.threePosition)) {
        threeMesh.position.copy(obj.threePosition);
      }
    });
  }, [isValidVector]);

  const updateTrajectories = useCallback(() => {
    if (!sceneRef.current || !simulationObjectsRef.current) return;
    const scene = sceneRef.current;

    simulationObjectsRef.current.forEach(simObj => {
      if (!isValidVector(simObj.threePosition)) {
        // If object position is invalid, try to remove its trajectory
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) scene.remove(line);
        // trajectoryPointsRef.current.delete(simObj.id); // Optionally clear points
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
            // Update existing line
            (line.material as THREE.LineBasicMaterial).color.set(simObj.color); // Update color in case it changed
            line.geometry.setFromPoints(points);
            line.geometry.attributes.position.needsUpdate = true;
            if (!line.parent) scene.add(line); // Add back if removed
          }
        } else if (line?.parent) {
          // Remove line if not enough points (e.g., trajectory cleared)
          scene.remove(line);
        }
      } else { // If trajectories are hidden
        const line = trajectoriesRef.current.get(simObj.id);
        if (line?.parent) {
          scene.remove(line); // Remove from scene
        }
        // Optionally, keep points in trajectoryPointsRef even if hidden, or clear them:
        trajectoryPointsRef.current.set(simObj.id, []); // Clears points when trajectories are toggled off
      }
    });
  }, [showTrajectories, trajectoryLength, isValidVector]);

  const deformGrid = useCallback(() => {
    if (!gridPlaneRef.current) return;

    const objectsWithMassForGrid = Array.from(simulationObjectsRef.current.values())
      .filter(o => o.mass > 0 && isValidVector(o.threePosition));

    const positions = gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const originalPositions = (gridPlaneRef.current.geometry.userData.originalPositions as THREE.BufferAttribute | undefined);

    if (!originalPositions) {
      console.warn("Original grid positions not found for deformation.");
      return;
    }

    const vertex = new THREE.Vector3();

    if (objectsWithMassForGrid.length === 0) { // Reset grid if no massive objects
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        positions.setZ(i, vertex.z); // Reset to original Z (local Z for the plane)
      }
    } else {
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(originalPositions, i);
        const localX = vertex.x; // Grid's local X (world X)
        const localPlaneY = vertex.y; // Grid's local Y (world Z)

        let totalDisplacement = 0;
        objectsWithMassForGrid.forEach(mo => {
          // Object's world position projected onto the grid's plane (world XZ)
          const moWorldX = mo.threePosition.x;
          const moWorldZ = mo.threePosition.z; // World Z corresponds to grid's local Y

          const dx = localX - moWorldX;
          const dz = localPlaneY - moWorldZ; // This is distance in world Z
          const distanceOnPlaneSq = dx * dx + dz * dz;
          const safeDistanceOnPlaneSq = Math.max(distanceOnPlaneSq, 0.0001); // Prevent division by zero / extreme values

          const wellStrength = mo.mass * 0.03; 
          const falloffFactor = Math.max(mo.mass * 0.5 + mo.radius * 2, 25); 

          const displacement = -wellStrength * Math.exp(-safeDistanceOnPlaneSq / falloffFactor);
          if (isFinite(displacement)) {
              totalDisplacement += displacement;
          }
        });
        // Apply displacement to the grid's local Z coordinate (which is world Y, but negated due to plane rotation)
        const maxDisplacement = GRID_SIZE / 5; // Max depth of deformation
        positions.setZ(i, originalPositions.getZ(i) + Math.max(-maxDisplacement, Math.min(maxDisplacement, totalDisplacement)));
      }
    }
    positions.needsUpdate = true;
    gridPlaneRef.current.geometry.computeVertexNormals(); // Important for lighting
  }, [isValidVector]);

  // Effect for initial Three.js setup (runs once)
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222); // Dark background

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

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Soft ambient light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Brighter directional light
    directionalLight.position.set(50, 80, 60);
    directionalLight.castShadow = true; // Enable shadows from this light
    scene.add(directionalLight);

    // Spacetime grid plane
    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_DIVISIONS, GRID_DIVISIONS);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x8A2BE2, // Violet color for the grid
      wireframe: true,
      transparent: true,
      opacity: 0.3, // Make it somewhat transparent
      metalness: 0.1, // Low metalness
      roughness: 0.9, // High roughness for a matte look
    });
    const gridPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    gridPlane.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    gridPlane.receiveShadow = true; // Grid can receive shadows
    scene.add(gridPlane);
    gridPlaneRef.current = gridPlane;
    
    // Store original positions for deformation
    if (gridPlaneRef.current) {
        gridPlaneRef.current.geometry.userData.originalPositions =
            (gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute).clone();
    }

    // Handle resize
    const handleResize = () => {
      if (currentMount && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
      }
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
      sceneRef.current?.clear(); // Clear scene children and dispose them
    };
  }, []); // Empty dependency array: runs once on mount

  // Effect for animation loop (runs when simulationStatus or speed changes)
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
        // console.log("Renderer, scene, camera, or controls not ready for animation loop.");
        return;
    }

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        controls.update(); // Update orbit controls

        if (simulationStatus === 'running') {
            const deltaTime = lastTimestamp > 0 ? (timestamp - lastTimestamp) / 1000 : 1/60; // seconds
            lastTimestamp = timestamp;
            const dt = simulationSpeed * deltaTime; // Apply simulation speed
            updatePhysics(dt);
            updateTrajectories();
            deformGrid();
        } else {
          lastTimestamp = 0; // Reset timestamp when paused/stopped to prevent large jump on resume
        }
        renderer.render(scene, camera);
    };

    // console.log(`Starting animation loop with status: ${simulationStatus}`);
    animate(0); // Start the animation loop

    return () => { // Cleanup function for this effect
        // console.log("Stopping animation loop due to effect re-run or unmount.");
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
    };
  }, [simulationStatus, simulationSpeed, updatePhysics, updateTrajectories, deformGrid]);


  // Effect to synchronize `objects` prop with internal simulation state
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current);
    const currentPropIds = new Set<string>();

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObj = newSimMap.get(objData.id);
      let threeMesh = objectsMapRef.current.get(objData.id);

      // Validate and sanitize prop data
      const propPos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const propVel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
      const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01; // Min radius
      const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;

      if (!simObj || !threeMesh) { // Object is new or needs full recreation
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

        // If threeMesh exists, remove old one before creating new
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
        threeMesh.name = objData.id; // For raycasting or identification
        threeMesh.castShadow = true;
        scene.add(threeMesh);
        objectsMapRef.current.set(objData.id, threeMesh);
        threeMesh.position.copy(newThreePosition); // Set initial position
        trajectoryPointsRef.current.set(objData.id, [newThreePosition.clone()]); // Start trajectory
      } else { // Object exists, update its properties
        let corePhysicsStateReset = false;

        // Always update descriptive properties
        simObj.name = objData.name;
        simObj.type = objData.type;
        
        // Update visual properties if changed
        if (simObj.radius !== propRadius) {
           simObj.radius = propRadius;
           threeMesh.geometry.dispose(); // Dispose old geometry
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32); // Create new
        }
        if (simObj.color !== objData.color) {
            simObj.color = objData.color;
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(simObj.color);
        }
        
        // Core physics state (mass, position, velocity) update logic:
        // Only reset from props if sim is not 'running' OR if mass has changed (fundamental change).
        if (simulationStatus !== 'running' || simObj.mass !== propMass) {
            simObj.mass = propMass; // Update mass

            // If sim not running, or mass changed (even if running), reset pos/vel from props.
            // This ensures UI edits to pos/vel take effect when paused/stopped, or when mass changes.
            if (simulationStatus !== 'running' || (simObj.mass !== propMass && propMass !== undefined)) {
                if (isValidVector(propPos)) simObj.threePosition.set(propPos.x, propPos.y, propPos.z);
                if (isValidVector(propVel)) simObj.threeVelocity.set(propVel.x, propVel.y, propVel.z);
                
                if (isValidVector(simObj.threePosition)) threeMesh.position.copy(simObj.threePosition);
                corePhysicsStateReset = true;
            }
        }


        if (corePhysicsStateReset) {
            // If core physics state was reset (e.g., user edited pos/vel while paused, or mass changed),
            // reset the trajectory for this object.
            trajectoryPointsRef.current.set(objData.id, isValidVector(simObj.threePosition) ? [simObj.threePosition.clone()] : []);
            const trajectoryLine = trajectoriesRef.current.get(objData.id);
            if (trajectoryLine) {
              scene.remove(trajectoryLine);
              trajectoryLine.geometry.dispose();
              (trajectoryLine.material as THREE.Material).dispose();
              trajectoriesRef.current.delete(objData.id); // Remove from map to be recreated by updateTrajectories
            }
        }
      }
    });

    // Remove objects from simulation and scene if they are no longer in props.objects
    simulationObjectsRef.current.forEach((_, id) => {
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

    // If the simulation is not running (i.e., paused or stopped),
    // an edit to an object should trigger an immediate grid and trajectory update.
    if (simulationStatus !== 'running') {
      deformGrid();
      updateTrajectories(); 
    }

  }, [objects, simulationStatus, isValidVector, deformGrid, updateTrajectories]); 

  // Effect to handle simulation state when 'stopped' (especially for resetting)
  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all existing trajectory lines from the scene and memory
      trajectoriesRef.current.forEach((line) => {
        if (line.parent) sceneRef.current?.remove(line);
        line.geometry.dispose(); 
        (line.material as THREE.LineBasicMaterial).dispose(); 
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear(); 

      const updatedSimMap = new Map<string, SimulationObjectInternal>();

      // Reset simulation objects to their initial states from props
      objects.forEach(objData => {
        const pos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
        const vel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
        const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;
        const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01;

        const threePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const threeVel = new THREE.Vector3(vel.x, vel.y, vel.z);

        updatedSimMap.set(objData.id, {
          id: objData.id,
          type: objData.type,
          mass: propMass,
          threePosition: threePos,
          threeVelocity: threeVel,
          radius: propRadius,
          color: objData.color,
          name: objData.name,
        });

        const threeMesh = objectsMapRef.current.get(objData.id);
        if (threeMesh) {
          threeMesh.position.copy(threePos); // Reset mesh visual position
          // Ensure visual properties also reset if they were derived or could change
           if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== propRadius) {
            threeMesh.geometry.dispose();
            threeMesh.geometry = new THREE.SphereGeometry(propRadius, 32, 32);
          }
          if ((threeMesh.material as THREE.MeshStandardMaterial).color.getHexString() !== objData.color.substring(1)) {
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(objData.color);
          }
        }
        // Initialize trajectory points with the reset position (single point or empty)
        trajectoryPointsRef.current.set(objData.id, [threePos.clone()]);
      });
      simulationObjectsRef.current = updatedSimMap;
      updateTrajectories(); // Re-draw trajectories (will be single points or gone)
      deformGrid(); // Update grid based on reset positions
    }
  }, [simulationStatus, objects, isValidVector, updateTrajectories, deformGrid]);

  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background" />;
};

export default SpaceTimeCanvas;

    