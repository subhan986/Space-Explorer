
// src/lib/real-objects.ts
import type { SceneObject, Vector3 } from '@/types/spacetime';
import { GRID_SIZE } from './constants';

export interface RealObjectDefinition extends Omit<Partial<SceneObject>, 'id' | 'position' | 'velocity'> {
  name: string;
  type: 'massive' | 'orbiter';
  mass: number; // Scaled mass for simulation
  radius: number; // Visual radius for simulation
  color: string; // Fallback color if texture fails or for trajectories
  textureUrl?: string; // URL for the object's texture
  basePosition?: Vector3; // Optional base position if not orbiting
  baseVelocity?: Vector3; // Optional base velocity
  orbits?: 'Sun' | 'Earth'; // Hints for orbital placement
  realMassKg?: string; // Informational: Real mass in kg
}

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 100000, // Scaled simulation mass
    radius: 30,
    color: '#FFD700', // Yellow
    textureUrl: 'https://placehold.co/2048x1024.png', // data-ai-hint="sun surface"
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '1.989 × 10³⁰ kg',
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 300, // Scaled simulation mass
    radius: 8,
    color: '#4169E1', // Blue
    textureUrl: 'https://placehold.co/2048x1024.png', // data-ai-hint="earth map"
    orbits: 'Sun',
    realMassKg: '5.972 × 10²⁴ kg',
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 3, // Scaled simulation mass
    radius: 2.5,
    color: '#FFFFFF', // White
    textureUrl: 'https://placehold.co/1024x512.png', // data-ai-hint="moon surface"
    orbits: 'Earth',
    realMassKg: '7.342 × 10²² kg',
  },
  BLACK_HOLE: { // Generic Black Hole
    name: 'Black Hole',
    type: 'massive',
    mass: 500000, // Scaled simulation mass
    radius: 15,
    color: '#000000', // Black
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: 'N/A (conceptual)',
  },
  JUPITER: {
    name: 'Jupiter',
    type: 'orbiter', // Usually orbits the Sun in our solar system context
    mass: 95, // Scaled simulation mass (Real: 1.898 × 10²⁷ kg)
    radius: 25, // Visually large
    color: '#D2B48C', // Tan/Orange-ish
    textureUrl: 'https://placehold.co/2048x1024.png', // data-ai-hint="jupiter texture gas giant"
    orbits: 'Sun',
    realMassKg: '1.898 × 10²⁷ kg',
  },
  ISS: {
    name: 'ISS',
    type: 'orbiter',
    mass: 0.1, // Very light for simulation, effectively a tracer with some mass
    radius: 0.5, // Visually very small
    color: '#C0C0C0', // Silver
    orbits: 'Earth',
    realMassKg: '~4.2 × 10⁵ kg',
  },
  HALLEYS_COMET: {
    name: "Halley's Comet",
    type: 'orbiter',
    mass: 0.1, // Very light
    radius: 1, // Visually small
    color: '#ADD8E6', // Light Blue / Icy
    // Special initial conditions set in ControlPanel
    basePosition: { x: GRID_SIZE / 3, y: 0, z: GRID_SIZE / 3 },
    baseVelocity: { x: -20, y: 5, z: -15 }, // Example fly-by velocity
    realMassKg: '~2.2 × 10¹⁴ kg',
  },
  CERES: {
    name: 'Ceres',
    type: 'orbiter', // Dwarf planet in asteroid belt, orbits Sun
    mass: 5, // Scaled simulation mass
    radius: 4,
    color: '#808080', // Gray
    textureUrl: 'https://placehold.co/1024x512.png', // data-ai-hint="ceres texture rock asteroid"
    orbits: 'Sun',
    realMassKg: '9.39 × 10²⁰ kg',
  },
  SAGITTARIUS_A_STAR: {
    name: 'Sagittarius A*',
    type: 'massive',
    mass: 5000000, // Significantly more massive for simulation
    radius: 20, // Visually larger black hole
    color: '#000000', // Black
    basePosition: { x: 0, y: 0, z: 0 }, // Typically at the center
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '~8.6 × 10³⁶ kg (4.3 million solar masses)',
  },
};
