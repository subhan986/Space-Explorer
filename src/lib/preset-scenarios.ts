
// src/lib/preset-scenarios.ts
import type { SceneObject } from '@/types/spacetime';
import { G_CONSTANT, DEFAULT_MASSIVE_OBJECT_RADIUS, DEFAULT_ORBITER_OBJECT_RADIUS, DEFAULT_ORBITAL_DISTANCE_OFFSET } from './constants';

// Helper to calculate orbital velocity
const calculateOrbitalVelocity = (centralMass: number, distance: number): number => {
  if (centralMass <= 0 || distance <= 0) return 0;
  const speed = Math.sqrt((G_CONSTANT * centralMass) / distance);
  return isFinite(speed) ? speed : 0;
};

export const PRESET_SCENARIOS: Record<string, { name: string; description: string; objects: SceneObject[] }> = {
  simpleSolarSystem: {
    name: "Simple Solar System",
    description: "A central star with two planets in basic orbits.",
    objects: [
      { 
        id: 'preset_sun1', type: 'massive', name: 'Solara', mass: 100000, 
        radius: 30, color: '#FFD700', 
        position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } 
      },
      (() => {
        const centralMass = 100000;
        const planetRadius = 8;
        const sunRadius = 30;
        const distance = sunRadius + planetRadius + DEFAULT_ORBITAL_DISTANCE_OFFSET + 150; // 30 + 8 + 50 + 150 = 238
        const velocityZ = calculateOrbitalVelocity(centralMass, distance);
        return { 
          id: 'preset_planet1', type: 'orbiter', name: 'Planet A', mass: 300, 
          radius: planetRadius, color: '#4169E1', 
          position: { x: distance, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: velocityZ } 
        };
      })(),
      (() => {
        const centralMass = 100000;
        const planetRadius = 4;
        const sunRadius = 30;
        const distance = sunRadius + planetRadius + DEFAULT_ORBITAL_DISTANCE_OFFSET + 300; // 30 + 4 + 50 + 300 = 384
        const velocityZ = calculateOrbitalVelocity(centralMass, distance);
        return { 
          id: 'preset_planet2', type: 'orbiter', name: 'Planet B', mass: 50, 
          radius: planetRadius, color: '#808080', 
          position: { x: -distance, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -velocityZ } 
        };
      })(),
    ]
  },
  binaryPair: {
    name: "Binary Pair",
    description: "Two stars orbiting their common center of mass.",
    objects: [
      { 
        id: 'preset_starA', type: 'massive', name: 'Star Alpha', mass: 80000, 
        radius: 25, color: '#FF8C00', // DarkOrange
        position: { x: -150, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 13 } // Approximate for stability
      },
      { 
        id: 'preset_starB', type: 'massive', name: 'Star Beta', mass: 60000, 
        radius: 20, color: '#ADD8E6', // LightBlue
        position: { x: 200, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -10 } // Approximate for stability
      }
    ]
  },
  cometSlingshot: {
    name: "Comet Slingshot",
    description: "A comet passing by a massive star for a gravitational assist.",
    objects: [
        { 
            id: 'preset_heavyStar', type: 'massive', name: 'Graviton Prime', mass: 200000, 
            radius: 40, color: '#DC143C', // Crimson
            position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } 
        },
        { 
            id: 'preset_comet', type: 'orbiter', name: 'Icarus Comet', mass: 1, 
            radius: 2, color: '#E0FFFF', // LightCyan
            position: { x: 800, y: 0, z: -800 }, velocity: { x: -15, y: 0, z: 5 } 
        },
    ]
  }
};
