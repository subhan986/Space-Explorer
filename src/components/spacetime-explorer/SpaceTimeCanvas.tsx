
// src/components/spacetime-explorer/SpaceTimeCanvas.tsx
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import type { SceneObject, ObjectType, LightingMode, Vector3, SupernovaRemnantType } from '@/types/spacetime';
import {
    GRID_SIZE, GRID_DIVISIONS, INITIAL_CAMERA_POSITION, G_CONSTANT,
    SUPERNOVA_DURATION, SUPERNOVA_MAX_RADIUS_MULTIPLIER, MAX_PARTICLES,
    SUPERNOVA_PARTICLE_EMISSION_INTERVAL, SUPERNOVA_PARTICLE_COUNT_PER_BURST,
    SUPERNOVA_SHOCKWAVE_DURATION, SUPERNOVA_SHOCKWAVE_MAX_RADIUS_FACTOR,
    SUPERNOVA_PARTICLE_COLORS
} from '@/lib/constants';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { useCustomization } from '@/contexts/CustomizationContext';

interface SpaceTimeCanvasProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  onObjectSelected?: (objectId: string | null) => void;
  showTrajectories: boolean;
  trajectoryLength: number;
  onObjectsCollidedAndMerged: (absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => void;
  onRemoveObject: (objectId: string) => void;
  showShadows: boolean;
  lightingMode: LightingMode;
  onSelectedObjectUpdate?: (objectState: SceneObject) => void;
  onSimulatedTimeDeltaUpdate?: (simDaysDelta: number) => void;
  onSupernovaEnd: (originalStarId: string, remnantType: SupernovaRemnantType, finalPosition: Vector3, finalVelocity: Vector3, originalMass: number) => void;
  onManualSupernovaProcessed: (objectId: string) => void;
}

interface SupernovaState {
  progress: number; // 0 to 1 for overall supernova
  duration: number; // seconds
  originalRadius: number;
  maxRadius: number;
  originalColor: THREE.Color;
  originalStarMass: number; // Store original mass for remnant decision
  particleSpawnTimer: number; 
  particleSpawnInterval: number;
  shockwaveProgress: number; // 0 to 1 for shockwave
  shockwaveMaxRadius: number;
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
  isGoingSupernova?: boolean;
  supernovaState?: SupernovaState;
  // isManuallyTriggeredSupernova is a prop from parent, not stored internally here long-term
}

interface MappedObject {
  mainMesh: THREE.Mesh;
  accretionDiskMesh?: THREE.Mesh;
  nameLabel?: CSS2DObject;
  objectName: string;
  shockwaveMesh?: THREE.Mesh;
}

interface ActiveParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifetime: number;
  initialLifetime: number;
  color: THREE.Color;
  size: number;
}


const SpaceTimeCanvas: React.FC<SpaceTimeCanvasProps> = ({
  objects,
  selectedObjectId,
  simulationStatus,
  simulationSpeed,
  onObjectSelected,
  showTrajectories,
  trajectoryLength,
  onObjectsCollidedAndMerged,
  onRemoveObject,
  showShadows,
  lightingMode,
  onSelectedObjectUpdate,
  onSimulatedTimeDeltaUpdate,
  onSupernovaEnd,
  onManualSupernovaProcessed,
}) => {
  const { settings: customizationSettings } = useCustomization();
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
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
    
  const isZoomingRef = useRef(false);
  const zoomTargetPositionRef = useRef(new THREE.Vector3());
  const zoomTargetLookAtRef = useRef(new THREE.Vector3());
  const zoomToObjectRadiusRef = useRef(1); 

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const cameraMoveSpeed = 100.0;

  const activeParticlesRef = useRef<ActiveParticle[]>([]);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const particleGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const particleMaterialRef = useRef<THREE.PointsMaterial | null>(null);

  // FPS Counter Refs
  const fpsDisplayRef = useRef<HTMLDivElement | null>(null);
  const fpsLastTimestampRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const currentFpsRef = useRef<number>(0);


  const isValidVector = useCallback((v: {x:number, y:number, z:number} | undefined): v is {x:number, y:number, z:number} => {
    return !!v && isFinite(v.x) && isFinite(v.y) && isFinite(v.z);
  },[]);

  const spawnCollisionParticles = useCallback((
    emissionPoint: THREE.Vector3, 
    obj1: SimulationObjectInternal | null, 
    obj2: SimulationObjectInternal | null, 
    isSupernovaEffect: boolean = false,
    supernovaEmitter?: SimulationObjectInternal 
    ) => {
    if (!particleSystemRef.current || activeParticlesRef.current.length >= MAX_PARTICLES) return;

    let numParticlesToSpawn: number;
    let baseSpeed: number;
    let particleColors: THREE.Color[];
    let particleLifetimes: { min: number, max: number };
    let particleSizes: {min: number, max: number};

    if (isSupernovaEffect && supernovaEmitter) {
        numParticlesToSpawn = SUPERNOVA_PARTICLE_COUNT_PER_BURST;
        baseSpeed = 100 + Math.random() * 250; 
        particleColors = SUPERNOVA_PARTICLE_COLORS.map(c => new THREE.Color(c));
        particleLifetimes = { min: 2.5, max: 5.0 };
        particleSizes = {min: 0.4, max: 1.2};
    } else if (obj1 && obj2) { 
        numParticlesToSpawn = Math.min(150, Math.max(20, Math.floor((obj1.mass + obj2.mass) * 0.05)));
        baseSpeed = 50 + Math.sqrt(obj1.mass + obj2.mass) * 0.5;
        particleColors = [new THREE.Color(obj1.color), new THREE.Color(obj2.color)];
        particleLifetimes = { min: 1.5, max: 2.5 };
        particleSizes = {min: 0.3, max: 0.7};
    } else {
        return; 
    }


    for (let i = 0; i < numParticlesToSpawn; i++) {
      if (activeParticlesRef.current.length >= MAX_PARTICLES) break;

      const lifetime = particleLifetimes.min + Math.random() * (particleLifetimes.max - particleLifetimes.min);
      const particleColor = particleColors[Math.floor(Math.random() * particleColors.length)];
      
      const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(baseSpeed + (Math.random() - 0.5) * baseSpeed * (isSupernovaEffect ? 0.8 : 0.5));

      const particle: ActiveParticle = {
        position: emissionPoint.clone().add(new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).multiplyScalar((obj1?.radius || 0) + (obj2?.radius || supernovaEmitter?.radius || 0) * (isSupernovaEffect ? 0.3 : 0.1))),
        velocity: velocity,
        lifetime: lifetime,
        initialLifetime: lifetime,
        color: particleColor,
        size: particleSizes.min + Math.random() * (particleSizes.max - particleSizes.min),
      };
      activeParticlesRef.current.push(particle);
    }
  }, []);


  const updatePhysics = useCallback((dt: number) => {
    if (!simulationObjectsRef.current) return;

    let simObjectsArray = Array.from(simulationObjectsRef.current.values());
    
    simObjectsArray.forEach(obj => {
      if (obj.isGoingSupernova || !isValidVector(obj.threePosition) || !isValidVector(obj.threeVelocity)) {
        return;
      }

      const totalForce = new THREE.Vector3(0, 0, 0);
      const forceExerters = simObjectsArray.filter(exerter => 
          exerter.id !== obj.id && 
          exerter.mass > 0 && 
          !exerter.isGoingSupernova && 
          isValidVector(exerter.threePosition)
      );

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
      if (mappedObj?.mainMesh && isValidVector(obj.threePosition) && !obj.isGoingSupernova) {
        mappedObj.mainMesh.position.copy(obj.threePosition);
      }
    });

    const mergeEvents: { absorbedId: string, absorberId: string, massToTransfer: number }[] = [];
    const involvedInMergeThisFrame = new Set<string>(); 

    const currentSimObjectsForCollision = Array.from(simulationObjectsRef.current.values());

    for (let i = 0; i < currentSimObjectsForCollision.length; i++) {
      const obj1 = currentSimObjectsForCollision[i];
      if (obj1.isGoingSupernova || involvedInMergeThisFrame.has(obj1.id) || !isValidVector(obj1.threePosition)) continue;

      for (let j = i + 1; j < currentSimObjectsForCollision.length; j++) {
        const obj2 = currentSimObjectsForCollision[j];
        if (obj2.isGoingSupernova || involvedInMergeThisFrame.has(obj2.id) || !isValidVector(obj2.threePosition)) continue;

        const distance = obj1.threePosition.distanceTo(obj2.threePosition);
        if (distance < obj1.radius + obj2.radius) {
          
          let starToNova: SimulationObjectInternal | null = null;
          let impactor: SimulationObjectInternal | null = null;
          
          const obj1IsPotentialStar = obj1.type === 'massive' && (obj1.name.toLowerCase().includes('star') || obj1.name.toLowerCase() === 'sun');
          const obj2IsPotentialStar = obj2.type === 'massive' && (obj2.name.toLowerCase().includes('star') || obj2.name.toLowerCase() === 'sun');

          if (obj1IsPotentialStar && obj1.type !== 'neutron_star' && obj1.type !== 'black_hole_remnant' && !obj2IsPotentialStar) {
            starToNova = obj1;
            impactor = obj2;
          } else if (obj2IsPotentialStar && obj2.type !== 'neutron_star' && obj2.type !== 'black_hole_remnant' && !obj1IsPotentialStar) {
            starToNova = obj2;
            impactor = obj1;
          }
          
          let supernovaTriggeredThisCollision = false;
          if (starToNova && impactor && !starToNova.isGoingSupernova && impactor.mass >= starToNova.mass) { 
              starToNova.isGoingSupernova = true;
              starToNova.supernovaState = {
                progress: 0,
                duration: SUPERNOVA_DURATION,
                originalRadius: starToNova.radius,
                maxRadius: starToNova.radius * SUPERNOVA_MAX_RADIUS_MULTIPLIER,
                originalColor: new THREE.Color(starToNova.color),
                originalStarMass: starToNova.mass,
                particleSpawnTimer: 0,
                particleSpawnInterval: SUPERNOVA_PARTICLE_EMISSION_INTERVAL,
                shockwaveProgress: 0,
                shockwaveMaxRadius: (starToNova.radius * SUPERNOVA_MAX_RADIUS_MULTIPLIER) * SUPERNOVA_SHOCKWAVE_MAX_RADIUS_FACTOR,
              };
              onRemoveObject(impactor.id); 
              involvedInMergeThisFrame.add(impactor.id);
              const impactPoint = starToNova.threePosition.clone().lerp(impactor.threePosition, starToNova.radius / (starToNova.radius + impactor.radius));
              spawnCollisionParticles(impactPoint, starToNova, impactor, false); 
              supernovaTriggeredThisCollision = true;
          }
          
          if (supernovaTriggeredThisCollision) {
            continue; 
          }

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
          
          const collisionPoint = obj1.threePosition.clone().lerp(obj2.threePosition, obj1.radius / (obj1.radius + obj2.radius));
          spawnCollisionParticles(collisionPoint, obj1, obj2, false);

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

  }, [isValidVector, onObjectsCollidedAndMerged, spawnCollisionParticles, onRemoveObject]);

  const updateParticles = useCallback((dt: number) => {
    if (!particleGeometryRef.current || !particleSystemRef.current) return;

    const positions: number[] = [];
    const colors: number[] = [];
    
    const newActiveParticles: ActiveParticle[] = [];

    for (let i = 0; i < activeParticlesRef.current.length; i++) {
      const p = activeParticlesRef.current[i];
      p.lifetime -= dt;

      if (p.lifetime > 0) {
        p.position.addScaledVector(p.velocity, dt);
        positions.push(p.position.x, p.position.y, p.position.z);
        colors.push(p.color.r, p.color.g, p.color.b);
        newActiveParticles.push(p);
      }
    }
    activeParticlesRef.current = newActiveParticles;

    if (positions.length > 0) {
      particleGeometryRef.current.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      particleGeometryRef.current.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      particleSystemRef.current.visible = true;
    } else {
      particleGeometryRef.current.deleteAttribute('position');
      particleGeometryRef.current.deleteAttribute('color');
      particleSystemRef.current.visible = false;
    }
    
    if (particleGeometryRef.current.attributes.position) particleGeometryRef.current.attributes.position.needsUpdate = true;
    if (particleGeometryRef.current.attributes.color) particleGeometryRef.current.attributes.color.needsUpdate = true;
    particleGeometryRef.current.computeBoundingSphere();
  }, []);

  const updateSupernovae = useCallback((dt: number) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    simulationObjectsRef.current.forEach(simObj => {
        if (simObj.isGoingSupernova && simObj.supernovaState) {
            const state = simObj.supernovaState;
            state.progress += dt / state.duration;
            state.shockwaveProgress += dt / SUPERNOVA_SHOCKWAVE_DURATION;

            const mappedObj = objectsMapRef.current.get(simObj.id);
            if (!mappedObj || !mappedObj.mainMesh) return;

            if (state.progress < 1) {
                const expansionProgress = Math.min(state.progress, 1); 
                const scaleFactor = 1 + (expansionProgress * (SUPERNOVA_MAX_RADIUS_MULTIPLIER - 1));
                mappedObj.mainMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const material = mappedObj.mainMesh.material as THREE.MeshStandardMaterial;
                material.emissive.lerpColors(state.originalColor, new THREE.Color(0xffffff), expansionProgress * 1.5); 
                material.emissiveIntensity = 1 + expansionProgress * 20; 
                material.color.set(0xffffff);
                material.needsUpdate = true;

                state.particleSpawnTimer += dt;
                if (state.particleSpawnTimer >= state.particleSpawnInterval) {
                    state.particleSpawnTimer = 0;
                    const numPointsOnSphere = 10; 
                    for(let i=0; i < numPointsOnSphere; i++) {
                        const randomDirection = new THREE.Vector3(
                            (Math.random() - 0.5) * 2,
                            (Math.random() - 0.5) * 2,
                            (Math.random() - 0.5) * 2
                        ).normalize();
                        const emissionPoint = simObj.threePosition.clone().addScaledVector(randomDirection, state.originalRadius * scaleFactor);
                        spawnCollisionParticles(emissionPoint, null, null, true, simObj);
                    }
                }

                if (!mappedObj.shockwaveMesh) {
                    const shockwaveGeo = new THREE.SphereGeometry(1, 32, 32); 
                    const shockwaveMat = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.7,
                        wireframe: false,
                    });
                    mappedObj.shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
                    mappedObj.shockwaveMesh.position.copy(simObj.threePosition);
                    scene.add(mappedObj.shockwaveMesh);
                }

                if (state.shockwaveProgress < 1) {
                    const currentShockwaveRadius = state.originalRadius * scaleFactor * SUPERNOVA_SHOCKWAVE_MAX_RADIUS_FACTOR * state.shockwaveProgress;
                    mappedObj.shockwaveMesh.scale.set(currentShockwaveRadius, currentShockwaveRadius, currentShockwaveRadius);
                    (mappedObj.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - state.shockwaveProgress);
                    (mappedObj.shockwaveMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
                } else if (mappedObj.shockwaveMesh.parent) {
                    scene.remove(mappedObj.shockwaveMesh);
                    mappedObj.shockwaveMesh.geometry.dispose();
                    (mappedObj.shockwaveMesh.material as THREE.Material).dispose();
                    delete mappedObj.shockwaveMesh;
                }

            } else { 
                onRemoveObject(simObj.id); 
                onSupernovaEnd(
                  simObj.id, 
                  'neutron_star', 
                  {...simObj.threePosition}, 
                  {...simObj.threeVelocity}, 
                  state.originalStarMass
                );
                
                if (mappedObj.shockwaveMesh && mappedObj.shockwaveMesh.parent) {
                    scene.remove(mappedObj.shockwaveMesh);
                    mappedObj.shockwaveMesh.geometry.dispose();
                    (mappedObj.shockwaveMesh.material as THREE.Material).dispose();
                    delete mappedObj.shockwaveMesh;
                }
                // simulationObjectsRef.current.delete(simObj.id); // This will be handled by the objects prop update
            }
        }
    });
  }, [onRemoveObject, spawnCollisionParticles, onSupernovaEnd]);


  const updateTrajectories = useCallback(() => {
    if (!sceneRef.current || !simulationObjectsRef.current) return;
    const scene = sceneRef.current;

    simulationObjectsRef.current.forEach(simObj => {
      if (simObj.isGoingSupernova || !isValidVector(simObj.threePosition)) {
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
      .filter(o => o.mass > 0 && !o.isGoingSupernova && isValidVector(o.threePosition));

    const positions = gridPlaneRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const originalPositions = (gridPlaneRef.current.geometry.userData.originalPositions as THREE.BufferAttribute | undefined);

    if (!originalPositions) return;

    const vertex = new THREE.Vector3();
    const maxDisplacement = 200; 

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

          const wellStrength = mo.mass * 0.1;
          const falloffFactor = Math.max(Math.pow(mo.radius * 7, 2), 200);

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

  const handleKeyboardCameraMovement = useCallback((deltaTime: number) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const moveDistance = cameraMoveSpeed * deltaTime * simulationSpeed; 

    const cameraOriginalPosition = camera.position.clone();
    let movedByKeyboard = false;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize(); 

    if (keysPressedRef.current['w']) {
      camera.position.addScaledVector(forward, moveDistance);
      movedByKeyboard = true;
    }
    if (keysPressedRef.current['s']) {
      camera.position.addScaledVector(forward, -moveDistance);
      movedByKeyboard = true;
    }
    if (keysPressedRef.current['a']) {
      camera.position.addScaledVector(right.clone().negate(), moveDistance);
      movedByKeyboard = true;
    }
    if (keysPressedRef.current['d']) {
      camera.position.addScaledVector(right, moveDistance);
      movedByKeyboard = true;
    }
    if (keysPressedRef.current['q']) { 
      camera.position.y += moveDistance;
      movedByKeyboard = true;
    }
    if (keysPressedRef.current['e']) { 
      camera.position.y -= moveDistance;
      movedByKeyboard = true;
    }

    if (movedByKeyboard) {
      isZoomingRef.current = false;
      const actualDeltaMovement = camera.position.clone().sub(cameraOriginalPosition);
      controls.target.add(actualDeltaMovement); 
    }
  }, [simulationSpeed]);


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const initialBgColor = new THREE.Color(0x0A0A1A); 
    scene.background = initialBgColor;
    scene.fog = new THREE.Fog(0x050510, 7000, 25000);

    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 50000);
    cameraRef.current = camera;
    camera.position.set(INITIAL_CAMERA_POSITION.x, INITIAL_CAMERA_POSITION.y, INITIAL_CAMERA_POSITION.z);
    camera.updateProjectionMatrix();

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current = renderer;
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

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
      color: new THREE.Color(customizationSettings.gridColor),
      wireframe: true,
      transparent: true,
      opacity: customizationSettings.gridOpacity,
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
    
    particleMaterialRef.current = new THREE.PointsMaterial({
        size: 0.8, 
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending, 
        depthWrite: false, 
    });
    particleGeometryRef.current = new THREE.BufferGeometry();
    particleSystemRef.current = new THREE.Points(particleGeometryRef.current, particleMaterialRef.current);
    particleSystemRef.current.visible = false; 
    scene.add(particleSystemRef.current);

    const fpsDiv = document.createElement('div');
    fpsDiv.style.position = 'absolute';
    fpsDiv.style.top = '10px';
    fpsDiv.style.left = '10px';
    fpsDiv.style.color = 'white';
    fpsDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
    fpsDiv.style.padding = '5px';
    fpsDiv.style.borderRadius = '3px';
    fpsDiv.style.fontFamily = 'Arial, sans-serif';
    fpsDiv.style.fontSize = '12px';
    fpsDiv.style.zIndex = '100';
    fpsDiv.textContent = 'FPS: ...';
    currentMount.appendChild(fpsDiv);
    fpsDisplayRef.current = fpsDiv;
    fpsLastTimestampRef.current = performance.now();


    const handleDoubleClick = (event: MouseEvent) => {
      if (!cameraRef.current || !sceneRef.current || !selectedObjectId || !mountRef.current || !onObjectSelected) return;
    
      const rect = mountRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(Array.from(objectsMapRef.current.values()).map(obj => obj.mainMesh), false);
    
      if (intersects.length > 0) {
        const clickedObjectMesh = intersects[0].object as THREE.Mesh;
        const clickedObjectId = clickedObjectMesh.name; 
    
        if (clickedObjectId === selectedObjectId) { 
          const simObj = simulationObjectsRef.current.get(selectedObjectId);
          if (simObj && isValidVector(simObj.threePosition)) {
            isZoomingRef.current = true;
            zoomTargetLookAtRef.current.copy(simObj.threePosition);
            zoomToObjectRadiusRef.current = simObj.radius;
            
            const direction = new THREE.Vector3();
            cameraRef.current.getWorldDirection(direction); 
            const distance = Math.max(simObj.radius * 5, 100); 
            
            const offsetDirection = cameraRef.current.position.clone().sub(simObj.threePosition).normalize();
            zoomTargetPositionRef.current.copy(simObj.threePosition).add(offsetDirection.multiplyScalar(distance));
          }
        } else {
           onObjectSelected(clickedObjectId); 
        }
      }
    };
    currentMount.addEventListener('dblclick', handleDoubleClick);

    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressedRef.current[event.key.toLowerCase()] = true;
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(event.key.toLowerCase())) {
        event.preventDefault();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressedRef.current[event.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);


    const resizeObserver = new ResizeObserver(() => {
      if (currentMount && cameraRef.current && rendererRef.current && labelRendererRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
        labelRendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    });
    resizeObserver.observe(currentMount);
    
    if (cameraRef.current && rendererRef.current && labelRendererRef.current) {
        cameraRef.current.aspect = currentMount.clientWidth / currentMount.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
        labelRendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
    }


    return () => {
      currentMount.removeEventListener('dblclick', handleDoubleClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      resizeObserver.unobserve(currentMount);
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      if (currentMount && rendererRef.current?.domElement && currentMount.contains(rendererRef.current.domElement)) currentMount.removeChild(rendererRef.current.domElement);
      if (currentMount && labelRendererRef.current?.domElement && currentMount.contains(labelRendererRef.current.domElement)) {
          currentMount.removeChild(labelRendererRef.current.domElement);
      }
      if (fpsDisplayRef.current && currentMount.contains(fpsDisplayRef.current)) {
        currentMount.removeChild(fpsDisplayRef.current);
      }
      fpsDisplayRef.current = null;

      rendererRef.current?.dispose();
      
      sceneRef.current?.clear(); 
      objectsMapRef.current.forEach(mappedObj => {
        mappedObj.mainMesh.geometry.dispose();
        if (mappedObj.mainMesh.material instanceof THREE.Material) mappedObj.mainMesh.material.dispose();
        else if (Array.isArray(mappedObj.mainMesh.material)) mappedObj.mainMesh.material.forEach(m => m.dispose());
        
        if (mappedObj.accretionDiskMesh) {
          mappedObj.accretionDiskMesh.geometry.dispose();
          if (mappedObj.accretionDiskMesh.material instanceof THREE.Material) mappedObj.accretionDiskMesh.material.dispose();
        }
        if (mappedObj.shockwaveMesh) {
            mappedObj.shockwaveMesh.geometry.dispose();
            if (mappedObj.shockwaveMesh.material instanceof THREE.Material) mappedObj.shockwaveMesh.material.dispose();
        }
        if (mappedObj.nameLabel) {
            mappedObj.mainMesh.remove(mappedObj.nameLabel); 
        }
      });
      trajectoriesRef.current.forEach(line => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      gridPlaneRef.current?.geometry.dispose();
      (gridPlaneRef.current?.material as THREE.Material)?.dispose();

      particleGeometryRef.current?.dispose();
      particleMaterialRef.current?.dispose();
      if (particleSystemRef.current && sceneRef.current) {
        sceneRef.current.remove(particleSystemRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (gridPlaneRef.current) {
      const material = gridPlaneRef.current.material as THREE.MeshStandardMaterial;
      material.color.set(new THREE.Color(customizationSettings.gridColor));
      material.opacity = customizationSettings.gridOpacity;
      material.needsUpdate = true; 
    }
  }, [customizationSettings.gridColor, customizationSettings.gridOpacity]);

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
        const simObjInternal = simulationObjectsRef.current.get(mappedObj.mainMesh.name); 
        if (simObjInternal && (simObjInternal.name === "Sun" || simObjInternal.type === 'neutron_star' || simObjInternal.type === 'black_hole_remnant')) { 
            mappedObj.mainMesh.castShadow = false; 
        } else {
            const dirLightCastsShadows = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
            mappedObj.mainMesh.castShadow = showShadows && dirLightCastsShadows;
        }
    });

  }, [lightingMode, showShadows]);


  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !controlsRef.current || !labelRendererRef.current) return;

    const renderer = rendererRef.current;
    const labelRenderer = labelRendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    let lastTimestamp = 0;
    const animate = (timestamp: number) => {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        
        const rawDeltaTime = lastTimestamp > 0 ? (timestamp - lastTimestamp) / 1000 : 1/60;
        lastTimestamp = timestamp;
        const effectiveDeltaTimeForPhysics = Math.min(rawDeltaTime, 1/30);
        const effectiveDeltaTimeForVisuals = rawDeltaTime; 

        frameCountRef.current++;
        const timeSinceLastFpsUpdate = timestamp - fpsLastTimestampRef.current;
        if (timeSinceLastFpsUpdate >= 1000) { 
            currentFpsRef.current = frameCountRef.current / (timeSinceLastFpsUpdate / 1000);
            frameCountRef.current = 0;
            fpsLastTimestampRef.current = timestamp;
            if (fpsDisplayRef.current) {
                fpsDisplayRef.current.textContent = `FPS: ${currentFpsRef.current.toFixed(1)}`;
            }
        }


        handleKeyboardCameraMovement(effectiveDeltaTimeForVisuals);

        if (isZoomingRef.current && controlsRef.current && cameraRef.current) {
          const lerpFactor = 0.07;
          cameraRef.current.position.lerp(zoomTargetPositionRef.current, lerpFactor);
          controlsRef.current.target.lerp(zoomTargetLookAtRef.current, lerpFactor);
    
          if (cameraRef.current.position.distanceTo(zoomTargetPositionRef.current) < zoomToObjectRadiusRef.current * 0.1  || 
              cameraRef.current.position.distanceTo(zoomTargetPositionRef.current) < 1 ) { 
            isZoomingRef.current = false;
            cameraRef.current.position.copy(zoomTargetPositionRef.current); 
            controlsRef.current.target.copy(zoomTargetLookAtRef.current); 
          }
        } else if (controlsRef.current && selectedObjectId && !isZoomingRef.current) {
          const selectedSimObj = simulationObjectsRef.current.get(selectedObjectId);
          if (selectedSimObj && isValidVector(selectedSimObj.threePosition) && !Object.values(keysPressedRef.current).some(pressed => pressed)) { 
             if (!selectedSimObj.isGoingSupernova) controlsRef.current.target.lerp(selectedSimObj.threePosition, 0.1); 
          }
        }
        controls.update();

        if (simulationStatus === 'running') {
            const dt = simulationSpeed * effectiveDeltaTimeForPhysics;
            
            updatePhysics(dt);
            updateSupernovae(dt);
            updateTrajectories();
            updateParticles(dt); 
            deformGrid();

            if (onSimulatedTimeDeltaUpdate) {
              const simDaysElapsed = effectiveDeltaTimeForPhysics * simulationSpeed; 
              onSimulatedTimeDeltaUpdate(simDaysElapsed);
            }

            objectsMapRef.current.forEach((mappedObj, objectId) => {
              const simObjInternal = simulationObjectsRef.current.get(objectId);
              if (simObjInternal && (mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*' || simObjInternal.type === 'black_hole_remnant') && mappedObj.accretionDiskMesh) {
                if (!simObjInternal.isGoingSupernova) mappedObj.accretionDiskMesh.rotation.y += 0.002 * simulationSpeed; 
              }
            });
            
            if (onSelectedObjectUpdate && selectedObjectId) {
              const simObjInternal = simulationObjectsRef.current.get(selectedObjectId);
              if (simObjInternal && !simObjInternal.isGoingSupernova) { 
                onSelectedObjectUpdate({
                  id: simObjInternal.id,
                  name: simObjInternal.name,
                  type: simObjInternal.type,
                  mass: simObjInternal.mass,
                  radius: simObjInternal.radius,
                  color: simObjInternal.color,
                  position: { x: simObjInternal.threePosition.x, y: simObjInternal.threePosition.y, z: simObjInternal.threePosition.z },
                  velocity: { x: simObjInternal.threeVelocity.x, y: simObjInternal.threeVelocity.y, z: simObjInternal.threeVelocity.z },
                });
              }
            }
        }
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
    };
    animate(0); 
    return () => { if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current); };
  }, [simulationStatus, simulationSpeed, updatePhysics, updateTrajectories, deformGrid, selectedObjectId, isValidVector, handleKeyboardCameraMovement, onSelectedObjectUpdate, onSimulatedTimeDeltaUpdate, updateParticles, updateSupernovae]);


  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const newSimMap = new Map(simulationObjectsRef.current); 
    const currentPropIds = new Set<string>();

    objects.forEach(objData => {
      currentPropIds.add(objData.id);
      let simObjInternal = newSimMap.get(objData.id);

      // Handle manual supernova trigger
      if (objData.isManuallyTriggeredSupernova && simObjInternal) {
        const isStar = simObjInternal.type === 'massive' && (simObjInternal.name.toLowerCase().includes('star') || simObjInternal.name.toLowerCase() === 'sun');
        if (isStar && !simObjInternal.isGoingSupernova) {
          simObjInternal.isGoingSupernova = true;
          simObjInternal.supernovaState = {
            progress: 0,
            duration: SUPERNOVA_DURATION,
            originalRadius: simObjInternal.radius,
            maxRadius: simObjInternal.radius * SUPERNOVA_MAX_RADIUS_MULTIPLIER,
            originalColor: new THREE.Color(simObjInternal.color),
            originalStarMass: simObjInternal.mass, // Use its own mass
            particleSpawnTimer: 0,
            particleSpawnInterval: SUPERNOVA_PARTICLE_EMISSION_INTERVAL,
            shockwaveProgress: 0,
            shockwaveMaxRadius: (simObjInternal.radius * SUPERNOVA_MAX_RADIUS_MULTIPLIER) * SUPERNOVA_SHOCKWAVE_MAX_RADIUS_FACTOR,
          };
          onManualSupernovaProcessed(objData.id); // Notify parent to reset the trigger
        } else if (simObjInternal.isGoingSupernova) {
            // Already going supernova, reset flag if it's still true from parent
             onManualSupernovaProcessed(objData.id);
        }
      }


      if (simObjInternal?.isGoingSupernova && simulationStatus === 'running') {
        if (!newSimMap.has(objData.id)) {
            newSimMap.set(objData.id, simObjInternal);
        }
        return; 
      }


      let mappedObj = objectsMapRef.current.get(objData.id);
      let threeMesh = mappedObj?.mainMesh;

      const propPos = isValidVector(objData.position) ? objData.position : {x:0, y:0, z:0};
      const propVel = isValidVector(objData.velocity) ? objData.velocity : {x:0, y:0, z:0};
      const propRadius = (objData.radius && objData.radius > 0.01) ? objData.radius : 0.01;
      const propMass = (typeof objData.mass === 'number' && isFinite(objData.mass)) ? objData.mass : 0;

      if (!simObjInternal || !threeMesh) { 
        const newThreePosition = new THREE.Vector3(propPos.x, propPos.y, propPos.z);
        const newThreeVelocity = new THREE.Vector3(propVel.x, propVel.y, propVel.z);
        simObjInternal = {
          id: objData.id, type: objData.type, mass: propMass,
          threePosition: newThreePosition, threeVelocity: newThreeVelocity,
          radius: propRadius, color: objData.color, name: objData.name,
          isGoingSupernova: false, 
        };
        newSimMap.set(objData.id, simObjInternal);

        if (mappedObj) { 
            if (mappedObj.nameLabel) mappedObj.mainMesh.remove(mappedObj.nameLabel);
            scene.remove(mappedObj.mainMesh);
            mappedObj.mainMesh.geometry.dispose();
            const oldMaterial = mappedObj.mainMesh.material as THREE.MeshStandardMaterial;
            oldMaterial.dispose();
            if (mappedObj.shockwaveMesh && mappedObj.shockwaveMesh.parent) {
                scene.remove(mappedObj.shockwaveMesh);
                mappedObj.shockwaveMesh.geometry.dispose();
                (mappedObj.shockwaveMesh.material as THREE.Material).dispose();
            }
            if (mappedObj.accretionDiskMesh) {
                mappedObj.mainMesh.remove(mappedObj.accretionDiskMesh); 
                mappedObj.accretionDiskMesh.geometry.dispose();
                (mappedObj.accretionDiskMesh.material as THREE.Material).dispose();
            }
            objectsMapRef.current.delete(objData.id);
        }

        const geometry = new THREE.SphereGeometry(simObjInternal.radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
             color: new THREE.Color(simObjInternal.color),
        });
        material.map = null; 
        material.emissiveMap = null;
        
        if (simObjInternal.name === "Sun" || simObjInternal.type === 'neutron_star') {
            material.emissive.set(new THREE.Color(simObjInternal.color));
            material.emissiveIntensity = simObjInternal.type === 'neutron_star' ? 2.0 : 1.0; 
            material.metalness = 0.0;
            material.roughness = 0.8;
        } else if (simObjInternal.type === 'orbiter' && (simObjInternal.name === "Earth" || simObjInternal.name === "Moon" || simObjInternal.name === "Jupiter" || simObjInternal.name === "Ceres" || simObjInternal.name === "Mercury" || simObjInternal.name === "Venus" || simObjInternal.name === "Mars" || simObjInternal.name === "Saturn" || simObjInternal.name === "Uranus" || simObjInternal.name === "Neptune")) {
            material.metalness = 0.1;
            material.roughness = 0.7;
        } else if (simObjInternal.name === "Black Hole" || simObjInternal.name === "Sagittarius A*" || simObjInternal.type === 'black_hole_remnant') {
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
        if (simObjInternal.name === "Sun" || simObjInternal.type === 'neutron_star' || simObjInternal.type === 'black_hole_remnant') {
            threeMesh.castShadow = false;
            threeMesh.receiveShadow = false;
        } else if (simObjInternal.name === "Black Hole" || simObjInternal.name === "Sagittarius A*") {
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode; 
            threeMesh.receiveShadow = false; 
        } else { 
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = true;
        }

        scene.add(threeMesh);
        threeMesh.position.copy(newThreePosition); 
        
        const newMappedObject: MappedObject = { mainMesh: threeMesh, objectName: objData.name };

        const labelDiv = document.createElement('div');
        labelDiv.className = 'object-name-label';
        labelDiv.textContent = simObjInternal.name;
        labelDiv.style.display = ''; 
        const nameLabel = new CSS2DObject(labelDiv);
        nameLabel.position.set(0, simObjInternal.radius * 1.5 + 5, 0); 
        threeMesh.add(nameLabel);
        newMappedObject.nameLabel = nameLabel;

        if (objData.name === 'Black Hole' || objData.name === 'Sagittarius A*' || objData.type === 'black_hole_remnant') {
            const diskInnerRadius = simObjInternal.radius * 1.5; 
            const diskOuterRadius = simObjInternal.radius * 5;   
            const diskGeometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
            const diskMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xFFE066, 
                side: THREE.DoubleSide, 
                transparent: true, 
                opacity: 0.7, 
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

        if (simObjInternal.name !== objData.name) {
            simObjInternal.name = objData.name;
            if (mappedObj.nameLabel) {
                mappedObj.nameLabel.element.textContent = simObjInternal.name;
            }
        }
        mappedObj.objectName = objData.name; 
        simObjInternal.type = objData.type;

        if (mappedObj.nameLabel) {
           mappedObj.nameLabel.element.style.display = ''; 
        }

        if (simObjInternal.radius !== propRadius) {
           simObjInternal.radius = propRadius;
           if (!simObjInternal.isGoingSupernova) { 
             threeMesh.geometry.dispose(); 
             threeMesh.geometry = new THREE.SphereGeometry(simObjInternal.radius, 32, 32);
             visualReset = true;
           }

           if (mappedObj.nameLabel) { 
                mappedObj.nameLabel.position.set(0, simObjInternal.radius * 1.5 + 5, 0);
           }

           if ((mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*' || simObjInternal.type === 'black_hole_remnant') && mappedObj.accretionDiskMesh) {
             mappedObj.accretionDiskMesh.geometry.dispose();
             const diskInnerRadius = simObjInternal.radius * 1.5;
             const diskOuterRadius = simObjInternal.radius * 5; 
             mappedObj.accretionDiskMesh.geometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
           }
        }

        const material = threeMesh.material as THREE.MeshStandardMaterial;
        material.map = null; 
        material.emissiveMap = null; 
                
        if (simObjInternal.color !== objData.color || material.color.getHexString() !== new THREE.Color(objData.color).getHexString().substring(1)) { 
             if (!simObjInternal.isGoingSupernova) material.color.set(new THREE.Color(objData.color));
             visualReset = true; 
        }
        simObjInternal.color = objData.color; 

        const dirLightCastsShadowsInCurrentMode = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
        if (simObjInternal.name === "Sun" || simObjInternal.type === 'neutron_star') {
            if (!simObjInternal.isGoingSupernova) material.emissive.set(new THREE.Color(simObjInternal.color)); 
            if (!simObjInternal.isGoingSupernova) material.emissiveIntensity = simObjInternal.type === 'neutron_star' ? 2.0 : 1.0;
            material.metalness = 0.0;
            material.roughness = 0.8;
            threeMesh.castShadow = false;
            threeMesh.receiveShadow = false;
        } else if (simObjInternal.type === 'orbiter' && (simObjInternal.name === "Earth" || simObjInternal.name === "Moon" || simObjInternal.name === "Jupiter" || simObjInternal.name === "Ceres" || simObjInternal.name === "Mercury" || simObjInternal.name === "Venus" || simObjInternal.name === "Mars" || simObjInternal.name === "Saturn" || simObjInternal.name === "Uranus" || simObjInternal.name === "Neptune")) { 
            material.metalness = 0.1;
            material.roughness = 0.7;
            if (!simObjInternal.isGoingSupernova) material.emissive?.set(0x000000);
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = true;
        } else if (simObjInternal.name === "Black Hole" || simObjInternal.name === "Sagittarius A*" || simObjInternal.type === 'black_hole_remnant') {
            if (!simObjInternal.isGoingSupernova) material.color.set(0x000000); 
            material.metalness = 0.0;
            material.roughness = 0.5;
            if (!simObjInternal.isGoingSupernova) material.emissive?.set(0x000000);
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = false;
        } else { 
            material.metalness = 0.3;
            material.roughness = 0.6;
            if (!simObjInternal.isGoingSupernova) material.emissive?.set(0x000000);
            threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
            threeMesh.receiveShadow = true;
        }
        
        if(visualReset || material.color.getHexString() !== new THREE.Color(objData.color).getHexString().substring(1) ) { 
            material.needsUpdate = true;
        }
        
        if (mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*' || objData.type === 'black_hole_remnant') {
            if (!mappedObj.accretionDiskMesh) { 
                const diskInnerRadius = simObjInternal.radius * 1.5;
                const diskOuterRadius = simObjInternal.radius * 5;
                const diskGeometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
                const diskMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFFE066, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.7, 
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
                diskMaterial.color.set(0xFFE066); 
                diskMaterial.opacity = 0.7; 
                diskMaterial.blending = THREE.AdditiveBlending;
                diskMaterial.castShadow = false; 
                diskMaterial.receiveShadow = false;
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

        
        if (simulationStatus !== 'running' || simObjInternal.mass !== propMass || simObjInternal.isGoingSupernova) {
            simObjInternal.mass = propMass;
            if(simObjInternal.isGoingSupernova && !objData.isGoingSupernova) { 
                simObjInternal.isGoingSupernova = false;
                simObjInternal.supernovaState = undefined;
                threeMesh.scale.set(1,1,1); 
                if (mappedObj.shockwaveMesh && mappedObj.shockwaveMesh.parent) {
                    scene.remove(mappedObj.shockwaveMesh);
                    mappedObj.shockwaveMesh.geometry.dispose();
                    (mappedObj.shockwaveMesh.material as THREE.Material).dispose();
                    delete mappedObj.shockwaveMesh;
                }
            }

            if (simulationStatus !== 'running' || (simObjInternal.mass !== propMass && propMass !== undefined)) { 
                if (isValidVector(propPos)) simObjInternal.threePosition.set(propPos.x, propPos.y, propPos.z);
                if (isValidVector(propVel)) simObjInternal.threeVelocity.set(propVel.x, propVel.y, propVel.z);
                if (isValidVector(simObjInternal.threePosition)) threeMesh.position.copy(simObjInternal.threePosition);
                corePhysicsStateReset = true;
            }
        }


        if (corePhysicsStateReset || (visualReset && simulationStatus !== 'running')) {
            trajectoryPointsRef.current.set(objData.id, isValidVector(simObjInternal.threePosition) ? [simObjInternal.threePosition.clone()] : []);
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

    simulationObjectsRef.current.forEach((simObjInternal, id) => {
      if (!currentPropIds.has(id)) {
        
        const mappedObjToRemove = objectsMapRef.current.get(id);
        if (mappedObjToRemove) {
          if (mappedObjToRemove.nameLabel) mappedObjToRemove.mainMesh.remove(mappedObjToRemove.nameLabel); 
          scene.remove(mappedObjToRemove.mainMesh); 
          mappedObjToRemove.mainMesh.geometry.dispose();
          const oldMaterial = mappedObjToRemove.mainMesh.material as THREE.MeshStandardMaterial;
          oldMaterial.dispose();
          if (mappedObjToRemove.shockwaveMesh && mappedObjToRemove.shockwaveMesh.parent) {
            scene.remove(mappedObjToRemove.shockwaveMesh);
            mappedObjToRemove.shockwaveMesh.geometry.dispose();
            (mappedObjToRemove.shockwaveMesh.material as THREE.Material).dispose();
          }
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
  }, [objects, simulationStatus, isValidVector, deformGrid, updateTrajectories, showShadows, lightingMode, onManualSupernovaProcessed]); 

  useEffect(() => {
    if (simulationStatus === 'stopped') {
      isZoomingRef.current = false; 
      trajectoriesRef.current.forEach((line) => {
        if (line.parent) sceneRef.current?.remove(line);
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
      trajectoriesRef.current.clear();
      trajectoryPointsRef.current.clear();

      activeParticlesRef.current = [];
      if (particleGeometryRef.current) {
        particleGeometryRef.current.deleteAttribute('position');
        particleGeometryRef.current.deleteAttribute('color');
        if (particleSystemRef.current) particleSystemRef.current.visible = false;
      }


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
          isGoingSupernova: false, 
          supernovaState: undefined,
        });

        const mappedObj = objectsMapRef.current.get(objData.id);
        if (mappedObj?.mainMesh) {
          const threeMesh = mappedObj.mainMesh;
          threeMesh.position.copy(threePos);
          threeMesh.scale.set(1,1,1); 
          if ((threeMesh.geometry as THREE.SphereGeometry).parameters.radius !== propRadius) {
            threeMesh.geometry.dispose();
            threeMesh.geometry = new THREE.SphereGeometry(propRadius, 32, 32);
          }
          if (mappedObj.nameLabel) { 
            mappedObj.nameLabel.position.set(0, propRadius * 1.5 + 5, 0);
            if (mappedObj.nameLabel.element.textContent !== objData.name) {
                 mappedObj.nameLabel.element.textContent = objData.name;
            }
            mappedObj.nameLabel.element.style.display = ''; 
          }


          const material = threeMesh.material as THREE.MeshStandardMaterial;
          material.map = null; 
          material.emissiveMap = null;
          
          material.color.set(new THREE.Color(objData.color));
            
            const dirLightCastsShadowsInCurrentMode = lightingMode === "Realistic Solar" || lightingMode === "Dramatic Edge";
            if (objData.name === "Sun" || objData.type === 'neutron_star') {
                material.emissive.set(new THREE.Color(objData.color));
                material.emissiveIntensity = objData.type === 'neutron_star' ? 2.0 : 1.0;
                material.metalness = 0.0;
                material.roughness = 0.8;
                threeMesh.castShadow = false;
                threeMesh.receiveShadow = false;
            } else if (objData.type === 'orbiter' && (objData.name === "Earth" || objData.name === "Moon" || objData.name === "Jupiter" || objData.name === "Ceres" || objData.name === "Mercury" || objData.name === "Venus" || objData.name === "Mars" || objData.name === "Saturn" || objData.name === "Uranus" || objData.name === "Neptune")) { 
                material.metalness = 0.1;
                material.roughness = 0.7;
                material.emissive?.set(0x000000);
                threeMesh.castShadow = showShadows && dirLightCastsShadowsInCurrentMode;
                threeMesh.receiveShadow = true;
            } else if (objData.name === "Black Hole" || objData.name === "Sagittarius A*" || objData.type === 'black_hole_remnant') {
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
           
            if (mappedObj.shockwaveMesh && mappedObj.shockwaveMesh.parent && sceneRef.current) {
                sceneRef.current.remove(mappedObj.shockwaveMesh);
                mappedObj.shockwaveMesh.geometry.dispose();
                (mappedObj.shockwaveMesh.material as THREE.Material).dispose();
                delete mappedObj.shockwaveMesh;
            }


          if ((mappedObj.objectName === 'Black Hole' || mappedObj.objectName === 'Sagittarius A*' || objData.type === 'black_hole_remnant') && mappedObj.accretionDiskMesh) {
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
              diskMaterial.color.set(0xFFE066); 
              diskMaterial.opacity = 0.7; 
              diskMaterial.blending = THREE.AdditiveBlending;
              diskMaterial.castShadow = false;
              diskMaterial.receiveShadow = false;
              diskMaterial.needsUpdate = true;
            } else { 
                const diskGeometry = new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 64);
                const diskMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xFFE066, 
                    side: THREE.DoubleSide, 
                    transparent: true, 
                    opacity: 0.7, 
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
    <div ref={mountRef} className="w-full h-full rounded-lg shadow-xl bg-background relative" />
  );
};

export default SpaceTimeCanvas;
