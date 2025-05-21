
// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { SceneObject, ObjectType, LightingMode } from '@/types/spacetime';
import { GRID_SIZE, GRID_DIVISIONS, INITIAL_CAMERA_POSITION, G_CONSTANT } from '@/lib/constants';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface SpaceTimeCanvasProps {
  objects: SceneObject[];
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  onObjectSelected?: (objectId: string | null) => void;
  showTrajectories: boolean;
  trajectoryLength: number;
  onObjectsCollidedAndMerged: (absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => void;
  showShadows: boolean;
  lightingMode: LightingMode;
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
  showShadows,
  lightingMode,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight | null>(null);
  const pointLightRef = useRef<THREE.PointLight | null>(null);

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
          const minInteractionDistance = (obj.radius + exerter.radius) * 0.1; 
          distanceSq = Math.max(distanceSq, minInteractionDistance * minInteractionDistance);
          
          if (distanceSq === 0) return;
          const forceMagnitude = (G_CONSTANT * exerter.mass * obj.mass) / distanceSq;
          if (!isFinite(forceMagnitude)) return;

          const force = direction.normalize().multiplyScalar(forceMagnitude);
          totalForce.add(force);
        });
      } else { 
        const testParticleForce = new THREE.Vector3(0,0,0);
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
      } else if (forceExerters.length > 0) { 
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
        obj.threePosition.sub(deltaPosition); 
        obj.threeVelocity.set(0,0,0);
      }

      const mappedObj = objectsMapRef.current.get(obj.id);
      if (mappedObj?.mainMesh && isValidVector(obj.threePosition)) {
        mappedObj.mainMesh.position.copy(obj.threePosition);
      }
    });

    const mergeEvents: { absorbedId: string, absorberId: string, massToTransfer: number }[] = [];
    const involvedInMergeThisFrame = new Set<string>(); 

    const currentSimObjectsForCollision = Array.from(simulationObjectsRef.current.values());

    for (let i = 0; i < currentSimObjectsForCollision.length; i++) {
      const obj1 = currentSimObjectsForCollision[i];
      if (involvedInMergeThisFrame.has(obj1.id) || !isValidVector(obj1.threePosition)) continue;

      for (let j = i + 1; j < currentSimObjectsForCollision.length; j++) {
        const obj2 = currentSimObjectsForCollision[j];
        if (involvedInMergeThisFrame.has(obj2.id) || !isValidVector(obj2.threePosition)) continue;

        const distance = obj1.threePosition.distanceTo(obj2.threePosition);
        if (distance < obj1.radius + obj2.radius) { 
          let absorber: SimulationObjectInternal;
          let absorbed: SimulationObjectInternal;

          if (obj1.mass > obj2.mass) {
            absorber = obj1;
            absorbed = obj2;
          } else if (obj2.mass > obj1.mass) {
            absorber = obj2;
            absorbed = obj1;
          } else { 
            absorber = obj1.id < obj2.id ? obj1 : obj2; 
            absorbed = obj1.id < obj2.id ? obj2 : obj1;
          }
          
          mergeEvents.push({ absorbedId: absorbed.id, absorberId: absorber.id, massToTransfer: absorbed.mass });
          involvedInMergeThisFrame.add(absorbed.id); 
        }
      }
    }
    
    if (mergeEvents.length > 0 && onObjectsCollidedAndMerged) {
      mergeEvents.forEach(event => {
        onObjectsCollidedAndMerged(event.absorbedId, event.absorberId, event.massToTransfer);
      });
    }

  }, [isValidVector, onObjectsCollidedAndMerged]);

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


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    textureLoaderRef.current = new THREE.TextureLoader();

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const initialBgColor = new THREE.Color(0x0A0A1A); 
    // scene.background = initialBgColor; // Background is loaded below
    scene.fog = new THREE.Fog(0x050510, 7000, 25000); // Dark fog

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 50000); // Far plane increased
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); 
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5); 
    directionalLight.position.set(50, 80, 60);
    scene.add(directionalLight);
    directionalLightRef.current = directionalLight;

    const pointLight = new THREE.PointLight(0xaaaaff, 0, 500, 1); 
    pointLight.position.set(-100, 50, -100);
    scene.add(pointLight);
    pointLightRef.current = pointLight;


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

    const loadStaticBackground = () => {
      if (!textureLoaderRef.current || !sceneRef.current) return;
      textureLoaderRef.current.load(
        '/space_background.jpg', 
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          if (sceneRef.current) {
            sceneRef.current.background = texture;
          }
          texture.needsUpdate = true; 
        },
        undefined, 
        (error) => {
          console.error('Failed to load static background texture:', error);
          if (sceneRef.current) sceneRef.current.background = initialBgColor; 
        }
      );
    };
    loadStaticBackground();


    const resizeObserver = new ResizeObserver(() => {
      if (currentMount && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    });
    resizeObserver.observe(currentMount);
    
    if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
    }


    return () => {
      resizeObserver.unobserve(currentMount);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (currentMount && rendererRef.current?.domElement) currentMount.removeChild(rendererRef.current.domElement);
      rendererRef.current?.dispose();
      
      const bgTexture = sceneRef.current?.background as THREE.Texture;
      if (bgTexture && bgTexture.isTexture) {
        bgTexture.dispose();
      }

      objectsMapRef.current.forEach(mappedObj => {
        mappedObj.mainMesh.geometry.dispose();
        if (mappedObj.mainMesh.material instanceof THREE.Material) mappedObj.mainMesh.material.dispose();
        else if (Array.isArray(mappedObj.mainMesh.material)) mappedObj.mainMesh.material.forEach(m => m.dispose());
        
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (!ambientLightRef.current || !directionalLightRef.current || !pointLightRef.current) return;

    ambientLightRef.current.intensity = 0;
    directionalLightRef.current.intensity = 0;
    directionalLightRef.current.castShadow = false;
    pointLightRef.current.intensity = 0;
    
    switch (lightingMode) {
      case "Realistic Solar":
        ambientLightRef.current.intensity = 1.2;
        directionalLightRef.current.intensity = 1.5;
        directionalLightRef.current.position.set(50, 80, 60);
        directionalLightRef.current.castShadow = showShadows;
        break;
      case "Ambient Glow":
        ambientLightRef.current.intensity = 2.0;
        directionalLightRef.current.intensity = 0.3; 
        directionalLightRef.current.position.set(50, 80, 60);
        directionalLightRef.current.castShadow = false; 
        break;
      case "Dramatic Edge":
        ambientLightRef.current.intensity = 0.5;
        directionalLightRef.current.intensity = 1.0; 
        directionalLightRef.current.position.set(50, 80, 60);
        directionalLightRef.current.castShadow = showShadows;
        
        pointLightRef.current.intensity = 0.7; 
        pointLightRef.current.position.set(-100, 50, -100); 
        break;
    }
    
    objectsMapRef.current.forEach(mappedObj => {
        const simObj = simulationObjectsRef.current.get(mappedObj.mainMesh.name); // Use mesh name as ID
        if (simObj && (simObj.name === "Sun")) { // Check by name
            mappedObj.mainMesh.castShadow = false; 
        } else {
            const dirLightCastsShadows = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
            mappedObj.mainMesh.castShadow = showShadows && dirLightCastsShadows;
        }
    });

  }, [lightingMode, showShadows]);


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
            const deltaTime = lastTimestamp > 0 ? (timestamp - lastTimestamp) / 1000 : 1/60; 
            lastTimestamp = timestamp;
            const dt = simulationSpeed * deltaTime; 
            updatePhysics(dt);
            updateTrajectories();
            deformGrid();

            objectsMapRef.current.forEach((mappedObj, objectId) => {
              const simObj = simulationObjectsRef.current.get(objectId);
              if (simObj && (simObj.name === 'Black Hole' || simObj.name === 'Sagittarius A*') && mappedObj.accretionDiskMesh) {
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


  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current); 
    const currentPropIds = new Set<string>();

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObj = newSimMap.get(objData.id);
      let mappedObj = objectsMapRef.current.get(objData.id);
      let threeMesh = mappedObj?.mainMesh;

      const propPos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const propVel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
      const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01;
      const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;

      if (!simObj || !threeMesh) { 
        const newThreePosition = new THREE.Vector3(propPos.x, propPos.y, propPos.z);
        const newThreeVelocity = new THREE.Vector3(propVel.x, propVel.y, propVel.z);
        simObj = {
          id: objData.id, type: objData.type, mass: propMass,
          threePosition: newThreePosition, threeVelocity: newThreeVelocity,
          radius: propRadius, color: objData.color, name: objData.name,
          netForceMagnitude: 0,
        };
        newSimMap.set(objData.id, simObj);

        if (mappedObj) { 
            scene.remove(mappedObj.mainMesh);
            mappedObj.mainMesh.geometry.dispose();
            const oldMaterial = mappedObj.mainMesh.material as THREE.MeshStandardMaterial;
            oldMaterial.dispose();
            
            if (mappedObj.accretionDiskMesh) {
                mappedObj.mainMesh.remove(mappedObj.accretionDiskMesh); 
                mappedObj.accretionDiskMesh.geometry.dispose();
                (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
            }
            objectsMapRef.current.delete(objData.id);
        }

        const geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
             color: new THREE.Color(simObj.color),
        });
        
        if (simObj.name === "Sun") {
            material.emissive.set(new THREE.Color(simObj.color));
            material.emissiveIntensity = 1.0; 
            material.metalness = 0.0;
            material.roughness = 0.8;
        } else if (simObj.name === "Earth" || simObj.name === "Moon" || simObj.name === "Jupiter" || simObj.name === "Ceres") {
            material.metalness = 0.1;
            material.roughness = 0.7;
        } else if (simObj.name === "Black Hole" || simObj.name === "Sagittarius A*") {
            material.color.set(0x000000); 
            material.metalness = 0.0;
            material.roughness = 0.5;
        } else { 
            material.metalness = 0.3;
            material.roughness = 0.6;
        }

        threeMesh = new THREE.Mesh(geometry, material);
        threeMesh.name = objData.id; 
        
        const dirLightCastsShadowsInCurrentMode = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
        if (simObj.name === "Sun") {
            threeMesh.castShadow = false;
            threeMesh.receiveShadow = false;
        } else if (simObj.name === "Black Hole" || simObj.name === "Sagittarius A*") {
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode; 
            threeMesh.receiveShadow = false; 
        } else { 
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = true;
        }

        scene.add(threeMesh);
        threeMesh.position.copy(newThreePosition); 
        
        const newMappedObject: MappedObject = { mainMesh: threeMesh, objectName: objData.name };

        if (objData.name === 'Black Hole' || objData.name === 'Sagittarius A*') {
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
            accretionDiskMesh.castShadow = false;
            accretionDiskMesh.receiveShadow = false;
            threeMesh.add(accretionDiskMesh); 
            newMappedObject.accretionDiskMesh = accretionDiskMesh;
        }
        objectsMapRef.current.set(objData.id, newMappedObject);
        mappedObj = newMappedObject; 
        trajectoryPointsRef.current.set(objData.id, [newThreePosition.clone()]); 
      } else { 
        let corePhysicsStateReset = false; 
        let visualReset = false; 

        simObj.name = objData.name;
        mappedObj.objectName = objData.name; 
        simObj.type = objData.type;

        if (simObj.radius !== propRadius) {
           simObj.radius = propRadius;
           threeMesh.geometry.dispose(); 
           threeMesh.geometry = new THREE.SphereGeometry(simObj.radius, 32, 32);
           visualReset = true;

           if ((mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*') && mappedObj.accretionDiskMesh) {
             mappedObj.accretionDiskMesh.geometry.dispose();
             const diskInnerRadius = simObj.radius * 1.5;
             const diskOuterRadius = simObj.radius * 5; 
             mappedObj.accretionDiskMesh.geometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
           }
        }

        const material = threeMesh.material as THREE.MeshStandardMaterial;
                
        if (simObj.color !== objData.color || material.color.getHexString() !== new THREE.Color(objData.color).getHexString().substring(1)) { 
             material.color.set(new THREE.Color(objData.color));
             visualReset = true; 
        }
        simObj.color = objData.color; 

        const dirLightCastsShadowsInCurrentMode = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
        if (simObj.name === "Sun") {
            material.emissive.set(new THREE.Color(simObj.color)); 
            material.emissiveIntensity = 1.0;
            material.metalness = 0.0;
            material.roughness = 0.8;
            threeMesh.castShadow = false;
            threeMesh.receiveShadow = false;
        } else if (simObj.name === "Earth" || simObj.name === "Moon" || simObj.name === "Jupiter" || simObj.name === "Ceres") {
            material.metalness = 0.1;
            material.roughness = 0.7;
            material.emissive?.set(0x000000); 
            material.emissiveIntensity = 0;
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = true;
        } else if (simObj.name === "Black Hole" || simObj.name === "Sagittarius A*") {
            material.color.set(0x000000); 
            material.metalness = 0.0;
            material.roughness = 0.5;
            material.emissive?.set(0x000000);
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = false;
        } else { 
            material.metalness = 0.3;
            material.roughness = 0.6;
            material.emissive?.set(0x000000);
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = true;
        }
        
        if(visualReset || material.color.getHexString() !== new THREE.Color(objData.color).getHexString().substring(1) ) { 
            material.needsUpdate = true;
        }
        
        if (mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*') {
            if (!mappedObj.accretionDiskMesh) { 
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
                accretionDiskMesh.castShadow = false;
                accretionDiskMesh.receiveShadow = false;
                threeMesh.add(accretionDiskMesh);
                mappedObj.accretionDiskMesh = accretionDiskMesh;
            } else { 
                const diskMaterial = mappedObj.accretionDiskMesh.material as THREE.MeshBasicMaterial;
                diskMaterial.color.set(0xFFA500); 
                diskMaterial.opacity = 0.6;
                diskMaterial.blending = THREE.AdditiveBlending;
                diskMaterial.needsUpdate = true; 
            }
        } else { 
            if (mappedObj.accretionDiskMesh) {
                threeMesh.remove(mappedObj.accretionDiskMesh);
                mappedObj.accretionDiskMesh.geometry.dispose();
                (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
                delete mappedObj.accretionDiskMesh;
            }
        }

        if (simulationStatus !== 'running' || simObj.mass !== propMass) {
            simObj.mass = propMass; 
            if (simulationStatus !== 'running' || (simObj.mass !== propMass && propMass !== undefined)) { 
                if (isValidVector(propPos)) simObj.threePosition.set(propPos.x, propPos.y, propPos.z);
                if (isValidVector(propVel)) simObj.threeVelocity.set(propVel.x, propVel.y, propVel.z);
                if (isValidVector(simObj.threePosition)) threeMesh.position.copy(simObj.threePosition);
                corePhysicsStateReset = true;
            }
        }

        if (corePhysicsStateReset || (visualReset && simulationStatus !== 'running')) {
            trajectoryPointsRef.current.set(objData.id, isValidVector(simObj.threePosition) ? [simObj.threePosition.clone()] : []);
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

    simulationObjectsRef.current.forEach((simObj, id) => {
      if (!currentPropIds.has(id)) {
        const mappedObjToRemove = objectsMapRef.current.get(id);
        if (mappedObjToRemove) {
          scene.remove(mappedObjToRemove.mainMesh); 
          mappedObjToRemove.mainMesh.geometry.dispose();
          const oldMaterial = mappedObjToRemove.mainMesh.material as THREE.MeshStandardMaterial;
          oldMaterial.dispose();
          
          if (mappedObjToRemove.accretionDiskMesh) { 
            mappedObjToRemove.mainMesh.remove(mappedObjToRemove.accretionDiskMesh); 
            mappedObjToRemove.accretionDiskMesh.geometry.dispose();
            (mappedObjToRemove.accretionDiskMesh.material as THREE.Material).dispose();
          }
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

    if (simulationStatus !== 'running') {
      deformGrid();
      updateTrajectories(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, simulationStatus, isValidVector, deformGrid, updateTrajectories, showShadows, lightingMode]); 

  useEffect(() => {
    if (simulationStatus === 'stopped') {
      trajectoriesRef.current.forEach((line) => {
        if (line.parent) sceneRef.current?.remove(line);
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear();

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
          netForceMagnitude: 0,
        });

        const mappedObj = objectsMapRef.current.get(objData.id);
        if (mappedObj?.mainMesh) {
          const threeMesh = mappedObj.mainMesh;
          threeMesh.position.copy(threePos);
          if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== propRadius) {
            threeMesh.geometry.dispose();
            threeMesh.geometry = new THREE.SphereGeometry(propRadius, 32, 32);
          }
          const material = threeMesh.material as THREE.MeshStandardMaterial;
          
          material.color.set(new THREE.Color(objData.color));
            
            const dirLightCastsShadowsInCurrentMode = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
            if (objData.name === "Sun") {
                material.emissive.set(new THREE.Color(objData.color));
                material.emissiveIntensity = 1.0;
                material.metalness = 0.0;
                material.roughness = 0.8;
                threeMesh.castShadow = false;
                threeMesh.receiveShadow = false;
            } else if (objData.name === "Earth" || objData.name === "Moon" || objData.name === "Jupiter" || objData.name === "Ceres") {
                material.metalness = 0.1;
                material.roughness = 0.7;
                material.emissive?.set(0x000000);
                threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
                threeMesh.receiveShadow = true;
            } else if (objData.name === "Black Hole" || objData.name === "Sagittarius A*") {
                material.color.set(0x000000);
                material.metalness = 0.0;
                material.roughness = 0.5;
                material.emissive?.set(0x000000);
                threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
                threeMesh.receiveShadow = false;
            } else { 
                material.metalness = 0.3;
                material.roughness = 0.6;
                material.emissive?.set(0x000000);
                threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
                threeMesh.receiveShadow = true;
            }
           material.needsUpdate = true;

          if (mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*') {
            const diskInnerRadius = propRadius * 1.5;
            const diskOuterRadius = propRadius * 5;
            if (mappedObj.accretionDiskMesh) {
              const diskMesh = mappedObj.accretionDiskMesh;
              if ((diskMesh.geometry as THREE.RingGeometry).parameters.innerRadius !== diskInnerRadius || 
                  (diskMesh.geometry as THREE.RingGeometry).parameters.outerRadius !== diskOuterRadius) {
                diskMesh.geometry.dispose();
                diskMesh.geometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
              }
              const diskMaterial = diskMesh.material as THREE.MeshBasicMaterial;
              diskMaterial.color.set(0xFFA500); 
              diskMaterial.opacity = 0.6;
              diskMaterial.blending = THREE.AdditiveBlending;
              diskMaterial.castShadow = false;
              diskMaterial.receiveShadow = false;
              diskMaterial.needsUpdate = true;
            } else { 
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
                accretionDiskMesh.castShadow = false;
                accretionDiskMesh.receiveShadow = false;
                threeMesh.add(accretionDiskMesh);
                mappedObj.accretionDiskMesh = accretionDiskMesh;
            }
          } else if (mappedObj.accretionDiskMesh) { 
             threeMesh.remove(mappedObj.accretionDiskMesh);
             mappedObj.accretionDiskMesh.geometry.dispose();
            (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
             delete mappedObj.accretionDiskMesh;
          }
        }
        trajectoryPointsRef.current.set(objData.id, [threePos.clone()]);
      });
      simulationObjectsRef.current = updatedSimMap;
      updateTrajectories(); 
      deformGrid(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationStatus, objects, isValidVector, updateTrajectories, deformGrid, showShadows, lightingMode]); 


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



