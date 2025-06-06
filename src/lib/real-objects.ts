
// src/lib/real-objects.ts
import type { SceneObject, Vector3 } from '@/types/spacetime';
import { GRID_SIZE } from './constants';

export interface RealObjectDefinition extends Omit<Partial<SceneObject>, 'id' | 'position' | 'velocity' > {
  name: string;
  type: 'massive' | 'orbiter';
  mass: number; // Scaled mass for simulation
  radius: number; // Visual radius for simulation
  color: string; // Fallback color
  description?: string; // Short descriptive text
  composition?: string; // Primary composition
  basePosition?: Vector3; // Optional base position if not orbiting
  baseVelocity?: Vector3; // Optional base velocity
  orbits?: 'Sun' | 'Earth'; // Hints for orbital placement
  realMassKg?: string; // Informational: Real mass in kg
}

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 150000,
    radius: 30,
    color: '#FFD700', // Yellow
    description: 'The star at the center of our Solar System, a nearly perfect sphere of hot plasma.',
    composition: 'Hydrogen (73%), Helium (25%), Other Metals (2%)',
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '1.989 × 10³⁰ kg',
  },
  MERCURY: {
    name: 'Mercury',
    type: 'orbiter',
    mass: 10,
    radius: 2,
    color: '#A9A9A9', // DarkGray
    description: 'The smallest planet in the Solar System and the closest to the Sun.',
    composition: 'Rocky, Metallic Core',
    orbits: 'Sun',
    realMassKg: '3.285 × 10²³ kg',
  },
  VENUS: {
    name: 'Venus',
    type: 'orbiter',
    mass: 80,
    radius: 4.5,
    color: '#FFF8DC', // Cornsilk
    description: "Earth's 'sister planet' due to similar size and mass, with a dense, toxic atmosphere.",
    composition: 'Rocky, Dense Atmosphere (CO2)',
    orbits: 'Sun',
    realMassKg: '4.867 × 10²⁴ kg',
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 100,
    radius: 5,
    color: '#4169E1', // Blue
    description: 'Our home planet, the only known astronomical object to harbor life.',
    composition: 'Rocky, Silicates, Liquid Water Oceans',
    orbits: 'Sun',
    realMassKg: '5.972 × 10²⁴ kg',
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 1,
    radius: 1.5,
    color: '#FFFFFF', // White
    description: "Earth's only natural satellite.",
    composition: 'Rocky, Silicates',
    orbits: 'Earth',
    realMassKg: '7.342 × 10²² kg',
  },
  MARS: {
    name: 'Mars',
    type: 'orbiter',
    mass: 20,
    radius: 3,
    color: '#FF4500', // OrangeRed
    description: 'The "Red Planet", known for its rusty appearance and potential for past life.',
    composition: 'Rocky, Iron Oxide Dust',
    orbits: 'Sun',
    realMassKg: '6.39 × 10²³ kg',
  },
  JUPITER: {
    name: 'Jupiter',
    type: 'orbiter',
    mass: 10000,
    radius: 20,
    color: '#D2B48C', // Tan
    description: 'The largest planet in the Solar System, a gas giant with a Great Red Spot.',
    composition: 'Gas Giant (Hydrogen, Helium)',
    orbits: 'Sun',
    realMassKg: '1.898 × 10²⁷ kg',
  },
  SATURN: {
    name: 'Saturn',
    type: 'orbiter',
    mass: 6000,
    radius: 18,
    color: '#F0E68C', // Khaki
    description: 'Known for its prominent ring system, a gas giant primarily composed of hydrogen and helium.',
    composition: 'Gas Giant (Hydrogen, Helium), Ice Rings',
    orbits: 'Sun',
    realMassKg: '5.683 × 10²⁶ kg',
  },
  URANUS: {
    name: 'Uranus',
    type: 'orbiter',
    mass: 1500,
    radius: 10,
    color: '#AFEEEE', // PaleTurquoise
    description: 'An ice giant with a unique tilt, appearing blue-green due to methane in its atmosphere.',
    composition: 'Ice Giant (Water, Methane, Ammonia Ices)',
    orbits: 'Sun',
    realMassKg: '8.681 × 10²⁵ kg',
  },
  NEPTUNE: {
    name: 'Neptune',
    type: 'orbiter',
    mass: 1700,
    radius: 9.5,
    color: '#0000CD', // MediumBlue
    description: 'The most distant planet from the Sun, an ice giant known for its strong winds.',
    composition: 'Ice Giant (Water, Methane, Ammonia Ices)',
    orbits: 'Sun',
    realMassKg: '1.024 × 10²⁶ kg',
  },
  ISS: {
    name: 'ISS',
    type: 'orbiter',
    mass: 0.1,
    radius: 1.5,
    color: '#C0C0C0', // Silver
    description: 'International Space Station, a habitable artificial satellite in low Earth orbit.',
    composition: 'Man-made structure',
    orbits: 'Earth',
    realMassKg: '~4.2 × 10⁵ kg',
  },
  HALLEYS_COMET: {
    name: "Halley's Comet",
    type: 'orbiter',
    mass: 0.1,
    radius: 2.0,
    color: '#ADD8E6', // Light Blue
    description: 'A famous short-period comet, visible from Earth every 75–79 years.',
    composition: 'Ice, Dust, Rock',
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
    description: 'The largest object in the asteroid belt, classified as a dwarf planet.',
    composition: 'Rocky, Icy Mantle',
    orbits: 'Sun',
    realMassKg: '9.39 × 10²⁰ kg',
  },
  BLACK_HOLE: {
    name: 'Black Hole',
    type: 'massive',
    mass: 500000,
    radius: 15,
    color: '#000000', // Black
    description: 'A region of spacetime where gravity is so strong that nothing, not even light, can escape.',
    composition: 'Singularity',
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
    description: 'The supermassive black hole at the Galactic Center of the Milky Way.',
    composition: 'Singularity',
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '~8.6 × 10³⁶ kg (4.3 million solar masses)',
  },
};

    