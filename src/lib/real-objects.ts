
// src/lib/real-objects.ts
import type { SceneObject, Vector3 } from '@/types/spacetime';

export interface RealObjectDefinition extends Omit<Partial<SceneObject>, 'id' | 'position' | 'velocity'> {
  name: string;
  type: 'massive' | 'orbiter';
  mass: number;
  radius: number;
  color: string;
  basePosition?: Vector3; // Optional base position if not orbiting
  baseVelocity?: Vector3; // Optional base velocity
  orbits?: 'Sun' | 'Earth'; // Hints for orbital placement
}

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 100000,
    radius: 30,
    color: '#FFD700', // Yellow/Gold
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 300, // Scaled mass
    radius: 8,
    color: '#4169E1', // Royal Blue
    orbits: 'Sun', // Indicates it should try to orbit a Sun-like object
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 3, // Scaled mass (approx 1/100th of scaled Earth)
    radius: 2.5,
    color: '#C0C0C0', // Silver
    orbits: 'Earth', // Indicates it should try to orbit an Earth-like object
  },
  BLACK_HOLE: {
    name: 'Black Hole',
    type: 'massive',
    mass: 500000, // Very high mass
    radius: 15,    // Visual radius for event horizon
    color: '#000000', // Black
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
  },
};
