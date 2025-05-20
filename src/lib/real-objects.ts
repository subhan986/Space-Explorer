
// src/lib/real-objects.ts
import type { SceneObject, Vector3 } from '@/types/spacetime';

export interface RealObjectDefinition extends Omit<Partial<SceneObject>, 'id' | 'position' | 'velocity'> {
  name: string;
  type: 'massive' | 'orbiter';
  mass: number;
  radius: number;
  color: string; // Fallback color if texture fails or for trajectories
  textureUrl?: string; // URL for the object's texture
  basePosition?: Vector3; // Optional base position if not orbiting
  baseVelocity?: Vector3; // Optional base velocity
  orbits?: 'Sun' | 'Earth'; // Hints for orbital placement
}

// Using dimensioned placeholders for textures.
// For example, 2048x1024 is a common size for equirectangular texture maps.

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 100000,
    radius: 30,
    color: '#FFD700',
    textureUrl: 'https://placehold.co/2048x1024.png', // Represents sun surface texture
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 300,
    radius: 8,
    color: '#4169E1',
    textureUrl: 'https://placehold.co/2048x1024.png', // Represents Earth map texture
    orbits: 'Sun',
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 3,
    radius: 2.5,
    color: '#C0C0C0',
    textureUrl: 'https://placehold.co/1024x512.png', // Represents Moon surface texture
    orbits: 'Earth',
  },
  BLACK_HOLE: {
    name: 'Black Hole',
    type: 'massive',
    mass: 500000,
    radius: 15,
    color: '#000000',
    // No texture for black hole sphere, color will be used.
    // Accretion disk will be added visually in SpaceTimeCanvas.
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
  },
};
