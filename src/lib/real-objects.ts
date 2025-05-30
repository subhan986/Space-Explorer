
// src/lib/real-objects.ts
import type { SceneObject, Vector3 } from '@/types/spacetime';
import { GRID_SIZE } from './constants';

export interface RealObjectDefinition extends Omit<Partial<SceneObject>, 'id' | 'position' | 'velocity' > {
  name: string;
  type: 'massive' | 'orbiter';
  mass: number; // Scaled mass for simulation
  radius: number; // Visual radius for simulation
  color: string; // Fallback color
  basePosition?: Vector3; // Optional base position if not orbiting
  baseVelocity?: Vector3; // Optional base velocity
  orbits?: 'Sun' | 'Earth'; // Hints for orbital placement
  realMassKg?: string; // Informational: Real mass in kg
}

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 150000, // Increased slightly to be the dominant mass
    radius: 30,
    color: '#FFD700', // Yellow
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '1.989 × 10³⁰ kg',
  },
  MERCURY: {
    name: 'Mercury',
    type: 'orbiter',
    mass: 10, // Scaled mass
    radius: 2,  // Visual radius
    color: '#A9A9A9', // DarkGray
    orbits: 'Sun',
    realMassKg: '3.285 × 10²³ kg',
  },
  VENUS: {
    name: 'Venus',
    type: 'orbiter',
    mass: 80,
    radius: 4.5,
    color: '#FFF8DC', // Cornsilk (yellowish-white)
    orbits: 'Sun',
    realMassKg: '4.867 × 10²⁴ kg',
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 100, // Scaled mass, reference for others
    radius: 5,
    color: '#4169E1', // Blue
    orbits: 'Sun',
    realMassKg: '5.972 × 10²⁴ kg',
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 1, // Very light compared to Earth
    radius: 1.5, // Made slightly larger for visibility relative to Earth
    color: '#FFFFFF', // White
    orbits: 'Earth',
    realMassKg: '7.342 × 10²² kg',
  },
  MARS: {
    name: 'Mars',
    type: 'orbiter',
    mass: 20,
    radius: 3,
    color: '#FF4500', // OrangeRed
    orbits: 'Sun',
    realMassKg: '6.39 × 10²³ kg',
  },
  JUPITER: {
    name: 'Jupiter',
    type: 'orbiter',
    mass: 10000,
    radius: 20, // Kept existing radius, it's visually distinct
    color: '#D2B48C', // Tan/Orange-ish
    orbits: 'Sun',
    realMassKg: '1.898 × 10²⁷ kg',
  },
  SATURN: {
    name: 'Saturn',
    type: 'orbiter',
    mass: 6000,
    radius: 18,
    color: '#F0E68C', // Khaki (pale yellow)
    orbits: 'Sun',
    realMassKg: '5.683 × 10²⁶ kg',
  },
  URANUS: {
    name: 'Uranus',
    type: 'orbiter',
    mass: 1500,
    radius: 10,
    color: '#AFEEEE', // PaleTurquoise (blue-green)
    orbits: 'Sun',
    realMassKg: '8.681 × 10²⁵ kg',
  },
  NEPTUNE: {
    name: 'Neptune',
    type: 'orbiter',
    mass: 1700,
    radius: 9.5,
    color: '#0000CD', // MediumBlue
    orbits: 'Sun',
    realMassKg: '1.024 × 10²⁶ kg',
  },
  ISS: {
    name: 'ISS',
    type: 'orbiter',
    mass: 0.1,
    radius: 1.5,
    color: '#C0C0C0', // Silver
    orbits: 'Earth',
    realMassKg: '~4.2 × 10⁵ kg',
  },
  HALLEYS_COMET: {
    name: "Halley's Comet",
    type: 'orbiter',
    mass: 0.1,
    radius: 2.0,
    color: '#ADD8E6', // Light Blue / Icy
    basePosition: { x: GRID_SIZE / 3, y: 0, z: GRID_SIZE / 3 },
    baseVelocity: { x: -20, y: 5, z: -15 },
    realMassKg: '~2.2 × 10¹⁴ kg',
  },
  CERES: {
    name: 'Ceres',
    type: 'orbiter',
    mass: 50,
    radius: 4,
    color: '#808080', // Gray
    orbits: 'Sun',
    realMassKg: '9.39 × 10²⁰ kg',
  },
  BLACK_HOLE: {
    name: 'Black Hole',
    type: 'massive',
    mass: 500000,
    radius: 15,
    color: '#000000', // Black
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: 'N/A (conceptual)',
  },
  SAGITTARIUS_A_STAR: {
    name: 'Sagittarius A*',
    type: 'massive',
    mass: 5000000,
    radius: 20,
    color: '#000000', // Black
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '~8.6 × 10³⁶ kg (4.3 million solar masses)',
  },
};
