
// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { SceneObject, ObjectType } from '@/types/spacetime';
import { GRID_SIZE, GRID_DIVISIONS, INITIAL_CAMERA_POSITION } from '@/lib/constants';

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
        console.warn(`Object ${obj.name} has invalid initial state (pos/vel) for physics update. Skipping.`);
        return;
      }

      const totalForce = new THREE.Vector3(0, 0, 0);

      forceExerters.forEach(exerter => {
        if (obj.id === exerter.id) return;

        if (!isValidVector(exerter.threePosition)) {
          console.warn(`Force-exerting object ${exerter.name} has invalid position. Skipping force contribution.`);
          return;
        }

        const direction = new THREE.Vector3().subVectors(exerter.threePosition, obj.threePosition);
        let distanceSq = direction.lengthSq();

        if (distanceSq < 0.000001) {
            distanceSq = 0.000001;
        }

        const minInteractionDistance = (obj.radius + exerter.radius) * 0.5;
        const effectiveDistanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);

        if (effectiveDistanceSq === 0) {
          console.warn(`Effective distance squared is zero between ${obj.name} and ${exerter.name}. Skipping force.`);
          return;
        }

        let forceMagnitude;
        if (obj.mass > 0) { // Object itself has mass
            forceMagnitude = (G * exerter.mass * obj.mass) / effectiveDistanceSq;
        } else { // Object is massless (tracer), use a nominal mass of 1 for force calculation for it to be affected
            forceMagnitude = (G * exerter.mass * 1.0) / effectiveDistanceSq;
        }

        if (!isFinite(forceMagnitude)) {
          console.warn(`Force magnitude is not finite for object ${obj.name} due to ${exerter.name}. DistSq: ${distanceSq}, EffDistSq: ${effectiveDistanceSq}. Skipping force.`);
          return;
        }

        const force = direction.normalize().multiplyScalar(forceMagnitude);
        totalForce.add(force);
      });

      const currentMassForAcceleration = obj.mass > 0 ? obj.mass : 1; // Use nominal mass of 1 for acceleration if actual mass is 0
      const acceleration = totalForce.divideScalar(currentMassForAcceleration);

      if (!isValidVector(acceleration)) {
        console.warn(`Acceleration is not finite for object ${obj.name}. Resetting acceleration for this step.`);
        acceleration.set(0,0,0);
      }

      const deltaVelocity = acceleration.clone().multiplyScalar(dt);
      obj.threeVelocity.add(deltaVelocity);

      if (!isValidVector(obj.threeVelocity)) {
        console.warn(`Velocity became non-finite for object ${obj.name}. Reverting delta V and stopping.`);
        obj.threeVelocity.sub(deltaVelocity);
        obj.threeVelocity.set(0,0,0);
      }

      const deltaPosition = obj.threeVelocity.clone().multiplyScalar(dt);
      obj.threePosition.add(deltaPosition);

      if (!isValidVector(obj.threePosition)) {
        console.warn(`Position became non-finite for object ${obj.name}. Reverting delta P and stopping velocity.`);
        obj.threePosition.sub(deltaPosition);
        obj.threeVelocity.set(0,0,0);
      }

      const threeMesh = objectsMapRef.current.get(obj.id);
      if (threeMesh && isValidVector(obj.threePosition)) {
        threeMesh.position.copy(obj.threePosition);
      } else if (threeMesh) {
        console.error(`Object ${obj.name} has invalid position, mesh not updated. Position:`, obj.threePosition);
      }
    });
  }, [isValidVector]);

  const updateTrajectories = useCallback(() => {
    if (!sceneRef.current || !simulationObjectsRef.current) return;
    const scene = sceneRef.current;

    simulationObjectsRef.current.forEach(simObj => {
      if (!isValidVector(simObj.threePosition)) {
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
        trajectoryPointsRef.current.set(simObj.id, []);
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
          const moWorldZ = mo.threePosition.z; // In plane geometry, mesh's Y maps to world's Z for gravity well calculation

          const dx = localX - moWorldX;
          const dz = localPlaneY - moWorldZ; // Use localPlaneY as it corresponds to the grid's "depth" axis (world Z)
          const distanceOnPlaneSq = dx * dx + dz * dz;

          const safeDistanceOnPlaneSq = Math.max(distanceOnPlaneSq, 0.0001);

          const wellStrength = mo.mass * 0.015; // How deep the well is
          const falloffFactor = Math.max(mo.mass * 2, 0.1); // How wide the well is, increased influence with mass

          const displacement = -wellStrength * Math.exp(-safeDistanceOnPlaneSq / falloffFactor);
          if (isFinite(displacement)) {
              totalDisplacement += displacement;
          }
        });
        const maxDisplacement = GRID_SIZE / 5; // Cap displacement to prevent extreme warping
        positions.setZ(i, originalPositions.getZ(i) + Math.max(-maxDisplacement, Math.min(maxDisplacement, totalDisplacement)));
      }
    }
    positions.needsUpdate = true;
    gridPlaneRef.current.geometry.computeVertexNormals();
  }, [isValidVector]);

  // Effect for THREE.js scene setup (runs once on mount)
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x222222); // Matches globals.css --background

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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Softer ambient light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Stronger directional
    directionalLight.position.set(50, 80, 60);
    directionalLight.castShadow = true; // Enable shadows for more depth
    scene.add(directionalLight);

    // Grid Plane (Spacetime Fabric)
    const planeGeometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_DIVISIONS, GRID_DIVISIONS);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0x8A2BE2, // Violet, matches --accent
      wireframe: true,
      transparent: true,
      opacity: 0.3, // Slightly more opaque
      metalness: 0.1, // Less metallic
      roughness: 0.9, // More rough
    });
    const gridPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    gridPlane.rotation.x = -Math.PI / 2; // Orient plane horizontally
    gridPlane.receiveShadow = true; // Allow grid to receive shadows
    scene.add(gridPlane);
    gridPlaneRef.current = gridPlane;
    // Store original positions for deformation
    if (gridPlaneRef.current) {
        gridPlaneRef.current.geometry.userData.originalPositions =
            (gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute).clone();
    }


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
      // animationFrameIdRef is managed by the animation loop effect
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
      sceneRef.current?.clear(); // Clear all children from the scene
    };
  }, []); // Empty dependency array ensures this runs only once on mount


  // Effect for running the animation loop
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
        // Essential THREE objects not initialized yet from the setup effect
        return;
    }

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    const animate = () => {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        controls.update(); // Update orbit controls

        if (simulationStatus === 'running') {
            const dt = simulationSpeed * (1 / 60); // Time delta for physics update
            updatePhysics(dt);
            updateTrajectories();
            deformGrid();
        }
        renderer.render(scene, camera);
    };

    animate(); // Start the animation loop

    return () => { // Cleanup for this effect
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
    };
  // Dependencies: if any of these change, the animation loop effect re-runs,
  // capturing the new values in the 'animate' closure.
  }, [simulationStatus, simulationSpeed, updatePhysics, updateTrajectories, deformGrid]);


  // Effect to synchronize `objects` prop with internal `simulationObjectsRef` and Three.js meshes
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current); // Start with current simulation state
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

      if (!simObj || !threeMesh) { // New object or mesh needs recreation
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

        // If mesh exists but simObj doesn't (should be rare), remove old mesh first
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
        threeMesh.name = objData.id; // Useful for debugging in Three.js inspector
        threeMesh.castShadow = true; // Object casts shadow
        scene.add(threeMesh);
        objectsMapRef.current.set(objData.id, threeMesh);
        threeMesh.position.copy(newThreePosition); // Set initial mesh position
        // Initialize trajectory points for new object
        trajectoryPointsRef.current.set(objData.id, [newThreePosition.clone()]);
      } else { // Existing object, update its properties
        let corePhysicsStateReset = false;

        // Update non-physics properties directly
        simObj.name = objData.name;
        simObj.type = objData.type;

        // Update visual properties (radius, color) if they changed
        if (simObj.radius !== propRadius) {
           simObj.radius = propRadius;
           threeMesh.geometry.dispose(); // Dispose old geometry
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32); // Create new
        }
        if (simObj.color !== objData.color) {
            simObj.color = objData.color;
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(simObj.color);
        }

        // Update core physics state (mass, position, velocity) from props only if:
        // 1. Simulation is NOT running, OR
        // 2. The object's mass has changed (this implies a reset of its physics state to new initial conditions)
        if (simulationStatus !== 'running' || simObj.mass !== propMass) {
          simObj.mass = propMass;
          simObj.threePosition.set(propPos.x, propPos.y, propPos.z);
          simObj.threeVelocity.set(propVel.x, propVel.y, propVel.z);
          threeMesh.position.copy(simObj.threePosition); // Sync mesh position
          corePhysicsStateReset = true;
        }
        // If simulation is running and mass hasn't changed, physics engine controls pos/vel.
        // Mesh position is updated directly in updatePhysics.

        if (corePhysicsStateReset) {
            // If physics state was reset, clear old trajectory and start anew
            trajectoryPointsRef.current.set(objData.id, [simObj.threePosition.clone()]);
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
    simulationObjectsRef.current = newSimMap; // Update the main simulation state ref

  }, [objects, simulationStatus, isValidVector]); // Re-run when objects prop or simulationStatus changes

  // Effect for handling simulation reset (status 'stopped')
  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all trajectories visually and from memory
      trajectoriesRef.current.forEach((line) => {
        if (line.parent) sceneRef.current?.remove(line);
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear();

      // Re-initialize simulationObjectsRef based on the `objects` prop to reset positions/velocities
      const updatedSimMap = new Map<string, SimulationObjectInternal>(); // Create a fresh map

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

        // Also update the Three.js mesh position and visual properties
        const threeMesh = objectsMapRef.current.get(objData.id);
        if (threeMesh) {
          threeMesh.position.copy(threePos);
          // Ensure visual properties like radius and color are also reset from props
          if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== propRadius) {
            threeMesh.geometry.dispose();
            threeMesh.geometry = new THREE.SphereGeometry(propRadius, 32, 32);
          }
          if ((threeMesh.material as THREE.MeshStandardMaterial).color.getHexString() !== objData.color.substring(1)) {
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(objData.color);
          }
        }
         // Initialize trajectory for each object after stop
        trajectoryPointsRef.current.set(objData.id, [threePos.clone()]);
      });
      simulationObjectsRef.current = updatedSimMap; // Set the simulation state to this newly initialized map

      // After resetting object states, also update trajectories (which should now be empty/single point)
      // and deform the grid according to the reset positions.
      updateTrajectories(); // This will clear/reset visual lines if showTrajectories is true
      deformGrid();
    }
  }, [simulationStatus, objects, isValidVector, updateTrajectories, deformGrid]); // Added updateTrajectories and deformGrid as dependencies

  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background" />;
};

export default SpaceTimeCanvas;

    