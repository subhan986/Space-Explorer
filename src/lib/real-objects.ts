
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

// Using generic 1024x512 placeholders for textures.
// The data-ai-hint would be associated with finding actual textures based on object name.
// e.g., "sun texture", "earth map", "moon surface".
const placeholderTexture = 'https://placehold.co/1024x512.png';

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 100000,
    radius: 30,
    color: '#FFD700', 
    textureUrl: placeholderTexture, // data-ai-hint="sun texture"
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 300, 
    radius: 8,
    color: '#4169E1', 
    textureUrl: placeholderTexture, // data-ai-hint="earth map"
    orbits: 'Sun', 
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 3, 
    radius: 2.5,
    color: '#C0C0C0', 
    textureUrl: placeholderTexture, // data-ai-hint="moon surface"
    orbits: 'Earth', 
  },
  BLACK_HOLE: {
    name: 'Black Hole',
    type: 'massive',
    mass: 500000, 
    radius: 15,    
    color: '#000000', 
    // No texture for black hole, color will be used.
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
  },
};
