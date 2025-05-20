// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
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
  onObjectsCollidedAndMerged: (absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => void; // New callback
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
  textureUrl?: string;
  netForceMagnitude?: number;
}

interface MappedObject {
  mainMesh: THREE.Mesh;
  accretionDiskMesh?: THREE.Mesh;
  objectName: string; 
}

const SpaceTimeCanvas: React.FC<SpaceTimeCanvasProps> = ({
  objects,
  simulationStatus,
  simulationSpeed,
  onObjectSelected,
  showTrajectories,
  trajectoryLength,
  onObjectsCollidedAndMerged,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const objectsMapRef = useRef<Map<string, MappedObject>>(new Map());
  const trajectoriesRef = useRef<Map<string, THREE.Line>>(new Map());
  const trajectoryPointsRef = useRef<Map<string, THREE.Vector3[]>>(new Map());

  const simulationObjectsRef = useRef<Map<string, SimulationObjectInternal>>(new Map());
  const gridPlaneRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null>(null);
  const animationFrameIdRef = useRef<number>();
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);

  const [forceDisplayData, setForceDisplayData] = useState<{ id: string; name: string; force: number | undefined }[]>([]);

  const isValidVector = useCallback((v: {x:number, y:number, z:number} | undefined): v is {x:number, y:number, z:number} => {
    return !!v && isFinite(v.x) && isFinite(v.y) && isFinite(v.z);
  },[]);

  const updatePhysics = useCallback((dt: number) => {
    if (!simulationObjectsRef.current) return;

    let simObjectsArray = Array.from(simulationObjectsRef.current.values());
    
    // Update forces, velocities, and positions
    simObjectsArray.forEach(obj => {
      if (!isValidVector(obj.threePosition) || !isValidVector(obj.threeVelocity)) {
        obj.netForceMagnitude = 0;
        return;
      }

      const totalForce = new THREE.Vector3(0, 0, 0);
      const forceExerters = simObjectsArray.filter(exerter => exerter.id !== obj.id && exerter.mass > 0 && isValidVector(exerter.threePosition));

      if (obj.mass > 0) {
        forceExerters.forEach(exerter => {
          const direction = new THREE.Vector3().subVectors(exerter.threePosition, obj.threePosition);
          let distanceSq = direction.lengthSq();
          const minInteractionDistance = (obj.radius + exerter.radius) * 0.1; // Softening factor base
          distanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
          
          if (distanceSq === 0) return;
          const forceMagnitude = (G_CONSTANT * exerter.mass * obj.mass) / distanceSq;
          if (!isFinite(forceMagnitude)) return;

          const force = direction.normalize().multiplyScalar(forceMagnitude);
          totalForce.add(force);
        });
      } else { // Massless particle (test particle with mass 1 for acceleration)
        forceExerters.forEach(exerter => {
          const direction = new THREE.Vector3().subVectors(exerter.threePosition, obj.threePosition);
          let distanceSq = direction.lengthSq();
          const minInteractionDistance = (obj.radius + exerter.radius) * 0.1;
          distanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
          if (distanceSq === 0) return;
          const forceMagnitudeOnTestParticle = (G_CONSTANT * exerter.mass * 1.0) / distanceSq;
          if (!isFinite(forceMagnitudeOnTestParticle)) return;
          const forceOnParticle = direction.normalize().multiplyScalar(forceMagnitudeOnTestParticle);
          testParticleForce.add(forceOnParticle);
        });
        totalForce.copy(testParticleForce);
      }
      
      obj.netForceMagnitude = totalForce.length();
      let acceleration = new THREE.Vector3(0,0,0);
      if (obj.mass > 0) {
        acceleration = totalForce.clone().divideScalar(obj.mass);
      } else if (forceExerters.length > 0) { // Re-calculate for massless if needed, using effective mass 1
         const testParticleForce = new THREE.Vector3(0,0,0);
         forceExerters.forEach(exerter => {
            if (!isValidVector(exerter.threePosition)) return;
            const direction = new THREE.Vector3().subVectors(exerter.threePosition, obj.threePosition);
            let distanceSq = direction.lengthSq();
            const minInteractionDistance = (obj.radius + exerter.radius) * 0.1;
            distanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
            if (distanceSq === 0) return;
            const forceMagnitudeOnTestParticle = (G_CONSTANT * exerter.mass * 1.0) / distanceSq;
            if (!isFinite(forceMagnitudeOnTestParticle)) return;
            const forceOnParticle = direction.normalize().multiplyScalar(forceMagnitudeOnTestParticle);
            testParticleForce.add(forceOnParticle);
        });
        acceleration.copy(testParticleForce);
        obj.netForceMagnitude = testParticleForce.length();
      }


      if (!isValidVector(acceleration)) acceleration.set(0,0,0);
      const deltaVelocity = acceleration.clone().multiplyScalar(dt);
      obj.threeVelocity.add(deltaVelocity);

      if (!isValidVector(obj.threeVelocity)) obj.threeVelocity.set(0,0,0);
      const deltaPosition = obj.threeVelocity.clone().multiplyScalar(dt);
      obj.threePosition.add(deltaPosition);

      if (!isValidVector(obj.threePosition)) {
        obj.threePosition.sub(deltaPosition); // Revert if invalid
        obj.threeVelocity.set(0,0,0);
      }

      const mappedObj = objectsMapRef.current.get(obj.id);
      if (mappedObj?.mainMesh && isValidVector(obj.threePosition)) {
        mappedObj.mainMesh.position.copy(obj.threePosition);
      }
    });

    // Collision detection and merging
    const mergeEvents: { absorbedId: string, absorberId: string, massToTransfer: number }[] = [];
    const involvedInMergeThisFrame = new Set<string>(); // To prevent multiple merges with the same obj in one frame

    // Re-fetch simObjectsArray as its internal state (mass) might be conceptually changing
    // For this pass, we only care about current positions and radii for collision detection.
    // The actual mass transfer is handled by the parent.
    const currentSimObjectsForCollision = Array.from(simulationObjectsRef.current.values());


    for (let i = 0; i < currentSimObjectsForCollision.length; i++) {
      const obj1 = currentSimObjectsForCollision[i];
      if (involvedInMergeThisFrame.has(obj1.id) || !isValidVector(obj1.threePosition)) continue;

      for (let j = i + 1; j < currentSimObjectsForCollision.length; j++) {
        const obj2 = currentSimObjectsForCollision[j];
        if (involvedInMergeThisFrame.has(obj2.id) || !isValidVector(obj2.threePosition)) continue;

        const distance = obj1.threePosition.distanceTo(obj2.threePosition);
        if (distance < obj1.radius + obj2.radius) { // Collision
          let absorber: SimulationObjectInternal;
          let absorbed: SimulationObjectInternal;

          if (obj1.mass > obj2.mass) {
            absorber = obj1;
            absorbed = obj2;
          } else if (obj2.mass > obj1.mass) {
            absorber = obj2;
            absorbed = obj1;
          } else { // Equal mass, decide by ID to be deterministic
            absorber = obj1.id < obj2.id ? obj1 : obj2;
            absorbed = obj1.id < obj2.id ? obj2 : obj1;
          }
          
          mergeEvents.push({ absorbedId: absorbed.id, absorberId: absorber.id, massToTransfer: absorbed.mass });
          involvedInMergeThisFrame.add(absorbed.id); 
          // The absorber can still absorb others in the same frame if it's massive enough
          // involvedInMergeThisFrame.add(absorber.id); // Optional: if an object can only be part of one merge per frame
        }
      }
    }
    
    // Process collected merge events
    if (mergeEvents.length > 0 && onObjectsCollidedAndMerged) {
      mergeEvents.forEach(event => {
        onObjectsCollidedAndMerged(event.absorbedId, event.absorberId, event.massToTransfer);
      });
    }

  }, [isValidVector, onObjectsCollidedAndMerged]); // Added onObjectsCollidedAndMerged

  const updateTrajectories = useCallback(() => {
    // ... (rest of the function remains the same)
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
    // ... (rest of the function remains the same)
    if (!gridPlaneRef.current) return;

    const objectsWithMassForGrid = Array.from(simulationObjectsRef.current.values())
      .filter(o => o.mass > 0 && isValidVector(o.threePosition));

    const positions = gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const originalPositions = (gridPlaneRef.current.geometry.userData.originalPositions as THREE.BufferAttribute | undefined);

    if (!originalPositions) return;

    const vertex = new THREE.Vector3();
    const maxDisplacement = 60;

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

          const wellStrength = mo.mass * 0.03; 
          const falloffFactor = Math.max(mo.mass * 0.5 + mo.radius * 2, 25);

          const displacement = -wellStrength * Math.exp(-safeDistanceOnPlaneSq / falloffFactor);
          if (isFinite(displacement)) {
              totalDisplacement += displacement;
          }
        });
        positions.setZ(i, originalPositions.getZ(i) + Math.max(-maxDisplacement, Math.min(maxDisplacement, totalDisplacement)));
      }
    }
    positions.needsUpdate = true;
    gridPlaneRef.current.geometry.computeVertexNormals();
  }, [isValidVector]);


  // Effect for Three.js setup (runs once)
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    textureLoaderRef.current = new THREE.TextureLoader();


    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const bgColor = 0x222222; 
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, INITIAL_CAMERA_POSITION.y * 1.5, INITIAL_CAMERA_POSITION.y * 6);


    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 5000);
    cameraRef.current = camera;
    camera.position.set(INITIAL_CAMERA_POSITION.x, INITIAL_CAMERA_POSITION.y, INITIAL_CAMERA_POSITION.z);
    camera.updateProjectionMatrix();

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
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (currentMount && rendererRef.current?.domElement) currentMount.removeChild(rendererRef.current.domElement);
      rendererRef.current?.dispose();
      objectsMapRef.current.forEach(mappedObj => {
        mappedObj.mainMesh.geometry.dispose();
        if (mappedObj.mainMesh.material instanceof THREE.Material) mappedObj.mainMesh.material.dispose();
        else if (Array.isArray(mappedObj.mainMesh.material)) mappedObj.mainMesh.material.forEach(m => m.dispose());
        (mappedObj.mainMesh.material as THREE.MeshStandardMaterial).map?.dispose();

        if (mappedObj.accretionDiskMesh) {
          mappedObj.accretionDiskMesh.geometry.dispose();
          if (mappedObj.accretionDiskMesh.material instanceof THREE.Material) mappedObj.accretionDiskMesh.material.dispose();
        }
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

  // Effect for animation loop (re-runs if simulationStatus or simulationSpeed changes)
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current) return;

    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        controls.update();

        if (simulationStatus === 'running') {
            const deltaTime = lastTimestamp > 0 ? (timestamp - lastTimestamp) / 1000 : 1/60; // deltaTime in seconds
            lastTimestamp = timestamp;
            const dt = simulationSpeed * deltaTime; // Adjusted time step
            updatePhysics(dt);
            updateTrajectories();
            deformGrid();

            objectsMapRef.current.forEach((mappedObj) => {
              if (mappedObj.objectName === 'Black Hole' && mappedObj.accretionDiskMesh) {
                mappedObj.accretionDiskMesh.rotation.y += 0.002 * simulationSpeed; 
              }
            });

            const newForceData = Array.from(simulationObjectsRef.current.values()).map(simObj => ({
              id: simObj.id, name: simObj.name, force: simObj.netForceMagnitude,
            }));
            setForceDisplayData(newForceData);
        } else {
          lastTimestamp = 0; 
           const newForceData = Array.from(simulationObjectsRef.current.values()).map(simObj => ({
              id: simObj.id, name: simObj.name, force: simulationStatus === 'stopped' ? 0 : simObj.netForceMagnitude,
            }));
          setForceDisplayData(newForceData);
        }
        renderer.render(scene, camera);
    };
    animate(0); 
    return () => { if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); };
  }, [simulationStatus, simulationSpeed, updatePhysics, updateTrajectories, deformGrid]);


  // Effect for synchronizing props.objects with internal simulation state
  useEffect(() => {
    if (!sceneRef.current || !textureLoaderRef.current) return;
    const scene = sceneRef.current;
    const textureLoader = textureLoaderRef.current;
    const newSimMap = new Map(simulationObjectsRef.current); // Start with current internal state
    const currentPropIds = new Set<string>();

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObj = newSimMap.get(objData.id);
      let mappedObj = objectsMapRef.current.get(objData.id);
      let threeMesh = mappedObj?.mainMesh;

      // Validate and sanitize prop data
      const propPos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const propVel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
      const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01;
      const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;

      if (!simObj || !threeMesh) { // New object or object whose mesh was removed
        const newThreePosition = new THREE.Vector3(propPos.x, propPos.y, propPos.z);
        const newThreeVelocity = new THREE.Vector3(propVel.x, propVel.y, propVel.z);
        simObj = {
          id: objData.id, type: objData.type, mass: propMass,
          threePosition: newThreePosition, threeVelocity: newThreeVelocity,
          radius: propRadius, color: objData.color, name: objData.name,
          textureUrl: objData.textureUrl, netForceMagnitude: 0,
        };
        newSimMap.set(objData.id, simObj);

        if (mappedObj) { // Clean up old meshes if they exist but simObj was lost
            scene.remove(mappedObj.mainMesh);
            mappedObj.mainMesh.geometry.dispose();
            const oldMaterial = mappedObj.mainMesh.material as THREE.MeshStandardMaterial;
            oldMaterial.map?.dispose();
            oldMaterial.dispose();
            if (mappedObj.accretionDiskMesh) {
                mappedObj.mainMesh.remove(mappedObj.accretionDiskMesh); // remove from parent first
                mappedObj.accretionDiskMesh.geometry.dispose();
                (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
            }
            objectsMapRef.current.delete(objData.id);
        }

        const geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({ metalness:0.3, roughness:0.6 });
        if (simObj.textureUrl && textureLoader) {
            material.map = textureLoader.load(simObj.textureUrl);
            material.color.set(0xffffff);
        } else {
            material.color.set(simObj.color);
        }
        threeMesh = new THREE.Mesh(geometry, material);
        threeMesh.name = objData.id; // Use ID for picking if needed later
        threeMesh.castShadow = true;
        scene.add(threeMesh);
        threeMesh.position.copy(newThreePosition); // Set initial position
        
        const newMappedObject: MappedObject = { mainMesh: threeMesh, objectName: objData.name };

        if (objData.name === 'Black Hole') {
            const diskInnerRadius = simObj.radius * 1.5; 
            const diskOuterRadius = simObj.radius * 5;   
            const diskGeometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
            const diskMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xFFA500, // Orange
                side: THREE.DoubleSide, 
                transparent: true, 
                opacity: 0.6, 
                blending: THREE.AdditiveBlending 
            });
            const accretionDiskMesh = new THREE.Mesh(diskGeometry, diskMaterial);
            accretionDiskMesh.rotation.x = Math.PI / 2; 
            threeMesh.add(accretionDiskMesh); 
            newMappedObject.accretionDiskMesh = accretionDiskMesh;
        }
        objectsMapRef.current.set(objData.id, newMappedObject);
        trajectoryPointsRef.current.set(objData.id, [newThreePosition.clone()]); // Initialize trajectory
      } else { // Object exists, update its properties
        let corePhysicsStateReset = false; // Did position, velocity, or mass change significantly?
        let visualReset = false; // Did radius, color, or texture change?

        simObj.name = objData.name;
        mappedObj.objectName = objData.name;
        simObj.type = objData.type;

        if (simObj.radius !== propRadius) {
           simObj.radius = propRadius;
           threeMesh.geometry.dispose(); // Dispose old geometry
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
           visualReset = true;

           // If black hole, update accretion disk size too
           if (mappedObj.objectName === 'Black Hole' && mappedObj.accretionDiskMesh) {
             mappedObj.accretionDiskMesh.geometry.dispose();
             const diskInnerRadius = simObj.radius * 1.5;
             const diskOuterRadius = simObj.radius * 5; // Consistent with creation
             mappedObj.accretionDiskMesh.geometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
           }
        }

        const material = threeMesh.material as THREE.MeshStandardMaterial;
        const oldTextureUrl = simObj.textureUrl;
        simObj.textureUrl = objData.textureUrl;

        if (simObj.textureUrl && simObj.textureUrl !== oldTextureUrl && textureLoader) {
            material.map?.dispose(); // Dispose old texture
            material.map = textureLoader.load(simObj.textureUrl);
            material.color.set(0xffffff); // Use white for textured objects
            visualReset = true;
        } else if (!simObj.textureUrl && oldTextureUrl) { // Texture removed
            material.map?.dispose();
            material.map = null;
            material.color.set(objData.color); // Revert to base color
            visualReset = true;
        } else if (!simObj.textureUrl && simObj.color !== objData.color) { // Color changed, no texture
            material.color.set(objData.color);
            simObj.color = objData.color; // Update simObj's color
            visualReset = true;
        } else if (simObj.textureUrl && simObj.color !== objData.color) {
            // If textured, base color prop is mainly for trajectories/fallbacks
            simObj.color = objData.color;
        }
        
        // Accretion disk handling for existing objects (e.g. name changed to/from Black Hole)
        if (mappedObj.objectName === 'Black Hole') {
            if (!mappedObj.accretionDiskMesh) { // Needs a disk, but doesn't have one
                const diskInnerRadius = simObj.radius * 1.5;
                const diskOuterRadius = simObj.radius * 5;
                const diskGeometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
                const diskMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFFA500, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.6,
                    blending: THREE.AdditiveBlending
                });
                const accretionDiskMesh = new THREE.Mesh(diskGeometry, diskMaterial);
                accretionDiskMesh.rotation.x = Math.PI / 2;
                threeMesh.add(accretionDiskMesh);
                mappedObj.accretionDiskMesh = accretionDiskMesh;
                visualReset = true;
            } else { // Disk exists, ensure its material properties are correct
                const diskMaterial = mappedObj.accretionDiskMesh.material as THREE.MeshBasicMaterial;
                diskMaterial.color.set(0xFFA500);
                diskMaterial.opacity = 0.6;
                diskMaterial.blending = THREE.AdditiveBlending;
                diskMaterial.needsUpdate = true; // In case material properties changed
            }
        } else { // Not a black hole, ensure no accretion disk
            if (mappedObj.accretionDiskMesh) {
                threeMesh.remove(mappedObj.accretionDiskMesh);
                mappedObj.accretionDiskMesh.geometry.dispose();
                (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
                delete mappedObj.accretionDiskMesh;
                visualReset = true;
            }
        }


        // Only update position/velocity from props if simulation is NOT running OR if mass changed
        if (simulationStatus !== 'running' || simObj.mass !== propMass) {
            simObj.mass = propMass; // Always update mass in simObj from prop
            // If sim not running, or if mass changed (even if running), reset pos/vel from props
            if (simulationStatus !== 'running' || (simObj.mass !== propMass && propMass !== undefined)) {
                if (isValidVector(propPos)) simObj.threePosition.set(propPos.x, propPos.y, propPos.z);
                if (isValidVector(propVel)) simObj.threeVelocity.set(propVel.x, propVel.y, propVel.z);
                if (isValidVector(simObj.threePosition)) threeMesh.position.copy(simObj.threePosition);
                corePhysicsStateReset = true;
            }
        }

        if (corePhysicsStateReset || (visualReset && simulationStatus !== 'running')) {
            // If core physics or visuals reset (and not running), also reset trajectory
            trajectoryPointsRef.current.set(objData.id, isValidVector(simObj.threePosition) ? [simObj.threePosition.clone()] : []);
            // Clear old trajectory line from scene if it exists
            const trajectoryLine = trajectoriesRef.current.get(objData.id);
            if (trajectoryLine) {
              scene.remove(trajectoryLine); // remove from scene
              trajectoryLine.geometry.dispose(); // dispose geometry
              (trajectoryLine.material as THREE.Material).dispose(); // dispose material
              trajectoriesRef.current.delete(objData.id); // remove from map
            }
        }
      }
    });

    // Remove objects from simulation/scene that are no longer in props.objects
    simulationObjectsRef.current.forEach((simObj, id) => {
      if (!currentPropIds.has(id)) {
        const mappedObjToRemove = objectsMapRef.current.get(id);
        if (mappedObjToRemove) {
          scene.remove(mappedObjToRemove.mainMesh); // remove from scene
          mappedObjToRemove.mainMesh.geometry.dispose();
          const oldMaterial = mappedObjToRemove.mainMesh.material as THREE.MeshStandardMaterial;
          oldMaterial.map?.dispose(); // dispose texture map if any
          oldMaterial.dispose();

          if (mappedObjToRemove.accretionDiskMesh) { // If it had a disk
            mappedObjToRemove.mainMesh.remove(mappedObjToRemove.accretionDiskMesh); // remove from parent
            mappedObjToRemove.accretionDiskMesh.geometry.dispose();
            (mappedObjToRemove.accretionDiskMesh.material as THREE.Material).dispose();
          }
          objectsMapRef.current.delete(id);
        }
        // Remove trajectory
        const trajectoryLine = trajectoriesRef.current.get(id);
        if (trajectoryLine) {
          scene.remove(trajectoryLine);
          trajectoryLine.geometry.dispose();
          (trajectoryLine.material as THREE.Material).dispose();
          trajectoriesRef.current.delete(id);
          trajectoryPointsRef.current.delete(id);
        }
        newSimMap.delete(id); // Remove from internal simulation map
      }
    });
    simulationObjectsRef.current = newSimMap; // Update the ref to the modified map

    // If simulation is not running, ensure grid and trajectories are updated based on current (potentially new) state
    if (simulationStatus !== 'running') {
      deformGrid();
      updateTrajectories(); // This will draw initial points or clear trajectories if needed
    }
  }, [objects, simulationStatus, isValidVector, deformGrid, updateTrajectories]); // Added objects and simulationStatus

  // Effect to reset trajectories and sim state when simulation is stopped
  useEffect(() => {
    if (simulationStatus === 'stopped') {
      // Clear all existing trajectories from the scene and refs
      trajectoriesRef.current.forEach((line) => {
        if (line.parent) sceneRef.current?.remove(line);
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear();

      // Reset simulation objects to their initial states based on current `objects` prop
      const updatedSimMap = new Map<string, SimulationObjectInternal>();
      objects.forEach(objData => {
        const pos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
        const vel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
        const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;
        const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01;

        const threePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const threeVel = new THREE.Vector3(vel.x, vel.y, vel.z);

        updatedSimMap.set(objData.id, {
          id: objData.id, type: objData.type, mass: propMass,
          threePosition: threePos, threeVelocity: threeVel,
          radius: propRadius, color: objData.color, name: objData.name,
          textureUrl: objData.textureUrl, netForceMagnitude: 0, // Reset net force
        });

        // Ensure Three.js mesh reflects this state
        const mappedObj = objectsMapRef.current.get(objData.id);
        if (mappedObj?.mainMesh) {
          const threeMesh = mappedObj.mainMesh;
          threeMesh.position.copy(threePos);
          // Potentially update geometry/material if radius/texture/color changed in props while stopped
          if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== propRadius) {
            threeMesh.geometry.dispose();
            threeMesh.geometry = new THREE.SphereGeometry(propRadius, 32, 32);
          }
          const material = threeMesh.material as THREE.MeshStandardMaterial;
          if (objData.textureUrl && textureLoaderRef.current) {
              if(material.map?.image?.src !== objData.textureUrl || !material.map) { // check if texture actually changed or was null
                material.map?.dispose();
                material.map = textureLoaderRef.current.load(objData.textureUrl);
              }
              material.color.set(0xffffff);
          } else {
              if(material.map) material.map.dispose(); // remove texture if it existed
              material.map = null;
              material.color.set(objData.color);
          }
          // Ensure accretion disk reflects current state if black hole
          if (mappedObj.objectName === 'Black Hole') {
            const diskInnerRadius = propRadius * 1.5;
            const diskOuterRadius = propRadius * 5;
            if (mappedObj.accretionDiskMesh) {
              const diskMesh = mappedObj.accretionDiskMesh;
              // Check if disk geometry needs update
              if ((diskMesh.geometry as THREE.RingGeometry).parameters.innerRadius !== diskInnerRadius || 
                  (diskMesh.geometry as THREE.RingGeometry).parameters.outerRadius !== diskOuterRadius) {
                diskMesh.geometry.dispose();
                diskMesh.geometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
              }
              // Ensure disk material properties are correct
              const diskMaterial = diskMesh.material as THREE.MeshBasicMaterial;
              diskMaterial.color.set(0xFFA500);
              diskMaterial.opacity = 0.6;
              diskMaterial.blending = THREE.AdditiveBlending;
              diskMaterial.needsUpdate = true;
            } else { // Disk missing, recreate
                const diskGeometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
                const diskMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFFA500, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.6,
                    blending: THREE.AdditiveBlending 
                });
                const accretionDiskMesh = new THREE.Mesh(diskGeometry, diskMaterial);
                accretionDiskMesh.rotation.x = Math.PI / 2;
                threeMesh.add(accretionDiskMesh);
                mappedObj.accretionDiskMesh = accretionDiskMesh;
            }
          } else if (mappedObj.accretionDiskMesh) { // Not a black hole but has a disk, remove it
             threeMesh.remove(mappedObj.accretionDiskMesh);
             mappedObj.accretionDiskMesh.geometry.dispose();
            (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
             delete mappedObj.accretionDiskMesh;
          }
        }
        // Initialize trajectory points for drawing if showTrajectories is true
        trajectoryPointsRef.current.set(objData.id, [threePos.clone()]);
      });
      simulationObjectsRef.current = updatedSimMap;
      updateTrajectories(); // Redraw trajectories based on initial positions
      deformGrid(); // Deform grid based on initial positions
    }
  }, [simulationStatus, objects, isValidVector, updateTrajectories, deformGrid]);


  return (
    <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background relative">
      <div className="absolute bottom-2 right-2 bg-black/70 text-white p-3 rounded-lg text-xs max-w-sm max-h-60 overflow-y-auto shadow-lg border border-gray-700">
        <h4 className="font-bold mb-2 text-sm border-b border-gray-600 pb-1">Net Gravitational Forces:</h4>
        {forceDisplayData.length === 0 && <p className="italic text-gray-400">No objects in simulation.</p>}
        {forceDisplayData.map(data => (
          <div key={data.id} className="truncate py-0.5">
            <span className="font-medium">{data.name}</span>:
            <span className="ml-1">{data.force !== undefined ? data.force.toFixed(2) : 'N/A'}</span>
            <span className="text-gray-400 ml-1">units</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpaceTimeCanvas;
