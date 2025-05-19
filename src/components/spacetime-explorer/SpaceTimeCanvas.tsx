
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
    // Any object with mass > 0 can exert force
    const forceExerters = simObjectsArray.filter(exerter => exerter.mass > 0 && isValidVector(exerter.threePosition));

    simObjectsArray.forEach(obj => {
      if (!isValidVector(obj.threePosition) || !isValidVector(obj.threeVelocity)) {
        return;
      }

      const totalForce = new THREE.Vector3(0, 0, 0);

      forceExerters.forEach(exerter => {
        if (obj.id === exerter.id) return;

        if (!isValidVector(exerter.threePosition)) {
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
          return;
        }

        let forceMagnitude;
        if (obj.mass > 0) { 
            forceMagnitude = (G_CONSTANT * exerter.mass * obj.mass) / effectiveDistanceSq;
        } else { 
            forceMagnitude = (G_CONSTANT * exerter.mass * 1.0) / effectiveDistanceSq;
        }


        if (!isFinite(forceMagnitude)) {
          return;
        }

        const force = direction.normalize().multiplyScalar(forceMagnitude);
        totalForce.add(force);
      });

      const currentMassForAcceleration = obj.mass > 0 ? obj.mass : 1.0;
      const acceleration = totalForce.divideScalar(currentMassForAcceleration);
      
      if (!isValidVector(acceleration)) {
        acceleration.set(0,0,0);
      }

      const deltaVelocity = acceleration.clone().multiplyScalar(dt);
      obj.threeVelocity.add(deltaVelocity);

      if (!isValidVector(obj.threeVelocity)) {
        obj.threeVelocity.sub(deltaVelocity); 
        obj.threeVelocity.set(0,0,0); 
      }

      const deltaPosition = obj.threeVelocity.clone().multiplyScalar(dt);
      obj.threePosition.add(deltaPosition);

      if (!isValidVector(obj.threePosition)) {
        obj.threePosition.sub(deltaPosition); 
        obj.threeVelocity.set(0,0,0); 
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
          const moWorldZ = mo.threePosition.z; 

          const dx = localX - moWorldX;
          const dz = localPlaneY - moWorldZ; 
          const distanceOnPlaneSq = dx * dx + dz * dz;
          const safeDistanceOnPlaneSq = Math.max(distanceOnPlaneSq, 0.0001);

          // Increased strength and adjusted falloff for more pronounced bending with mass.
          const wellStrength = mo.mass * 0.03; // How deep the well is
          const falloffFactor = Math.max(mo.mass * 0.5 + mo.radius * 2, 25); // How wide the well is, considers mass and radius

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
  }, [isValidVector]);

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
      sceneRef.current?.clear(); 
    };
  }, []); 

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) {
        return;
    }

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        controls.update();

        if (simulationStatus === 'running') {
            const deltaTime = lastTimestamp > 0 ? (timestamp - lastTimestamp) / 1000 : 1/60;
            lastTimestamp = timestamp;
            const dt = simulationSpeed * deltaTime; 
            updatePhysics(dt);
            updateTrajectories();
            deformGrid();
        } else {
          lastTimestamp = 0; // Reset timestamp when paused/stopped
        }
        renderer.render(scene, camera);
    };

    animate(0); 

    return () => { 
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
    };
  }, [simulationStatus, simulationSpeed, updatePhysics, updateTrajectories, deformGrid]);

  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current);
    const currentPropIds = new Set<string>();

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObj = newSimMap.get(objData.id);
      let threeMesh = objectsMapRef.current.get(objData.id);

      const propPos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const propVel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
      const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01;
      const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;

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
        trajectoryPointsRef.current.set(objData.id, [newThreePosition.clone()]);
      } else { 
        let corePhysicsStateReset = false;

        simObj.name = objData.name;
        simObj.type = objData.type;
        
        if (simObj.radius !== propRadius) {
           simObj.radius = propRadius;
           threeMesh.geometry.dispose();
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        }
        if (simObj.color !== objData.color) {
            simObj.color = objData.color;
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(simObj.color);
        }
        
        // Only reset position/velocity from props if sim is not running OR if mass changed
        if (simulationStatus !== 'running' || simObj.mass !== propMass) {
            simObj.mass = propMass; // Always update mass if it changed or sim not running

            // If sim not running, or mass changed, reset pos/vel from props
            if (simulationStatus !== 'running' || (simObj.mass !== propMass && propMass !== undefined)) {
                simObj.threePosition.set(propPos.x, propPos.y, propPos.z);
                simObj.threeVelocity.set(propVel.x, propVel.y, propVel.z);
                threeMesh.position.copy(simObj.threePosition);
                corePhysicsStateReset = true;
            }
        }


        if (corePhysicsStateReset) {
            trajectoryPointsRef.current.set(objData.id, [simObj.threePosition.clone()]);
             // If core state was reset, and sim is running, this might cause a jump.
            // Consider if this is desired, or if trajectory reset should only happen when sim is stopped/paused.
            // For now, resetting trajectory if core physics state is reset.
            const trajectoryLine = trajectoriesRef.current.get(objData.id);
            if (trajectoryLine) {
              scene.remove(trajectoryLine);
              trajectoryLine.geometry.dispose();
              (trajectoryLine.material as THREE.Material).dispose();
              trajectoriesRef.current.delete(objData.id);
            }
        }
      }
    });

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

  }, [objects, simulationStatus, isValidVector]); 

  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all existing trajectory lines from the scene and memory
      trajectoriesRef.current.forEach((line) => {
        if (line.parent) sceneRef.current?.remove(line);
        line.geometry.dispose(); // Dispose geometry
        (line.material as THREE.LineBasicMaterial).dispose(); // Dispose material
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear(); // Clear stored points

      const updatedSimMap = new Map<string, SimulationObjectInternal>();

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
          threeMesh.position.copy(threePos); // Reset mesh position
          // Optionally, update mesh geometry/material if they could have changed
           if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== propRadius) {
            threeMesh.geometry.dispose();
            threeMesh.geometry = new THREE.SphereGeometry(propRadius, 32, 32);
          }
          if ((threeMesh.material as THREE.MeshStandardMaterial).color.getHexString() !== objData.color.substring(1)) {
            (threeMesh.material as THREE.MeshStandardMaterial).color.set(objData.color);
          }
        }
        // Initialize trajectory points with the reset position
        trajectoryPointsRef.current.set(objData.id, [threePos.clone()]);
      });
      simulationObjectsRef.current = updatedSimMap;
      updateTrajectories(); // Re-draw trajectories if needed (likely empty or single point now)
      deformGrid();
    }
  }, [simulationStatus, objects, isValidVector, updateTrajectories, deformGrid]);

  return <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background" />;
};

export default SpaceTimeCanvas;

