
// src/lib/preset-scenarios.ts
import type { SceneObject } from '@/types/spacetime';
import { REAL_OBJECT_DEFINITIONS } from './real-objects';
import {
  G_CONSTANT,
  SUN_SIMULATION_MASS,
  MERCURY_ORBIT_RADIUS, VENUS_ORBIT_RADIUS, EARTH_ORBIT_RADIUS,
  MARS_ORBIT_RADIUS, JUPITER_ORBIT_RADIUS, SATURN_ORBIT_RADIUS,
  URANUS_ORBIT_RADIUS, NEPTUNE_ORBIT_RADIUS
  // MOON_ORBIT_RADIUS_AROUND_EARTH, // Moon constant no longer needed here
} from './constants';

// Helper to calculate orbital velocity
const calculateOrbitalVelocity = (centralMass: number, distance: number): number => {
  if (centralMass <= 0 || distance <= 0) return 0;
  const speed = Math.sqrt((G_CONSTANT * centralMass) / distance);
  return isFinite(speed) ? speed : 0;
};

const getPlanetWithOrbit = (
  planetKey: keyof typeof REAL_OBJECT_DEFINITIONS,
  orbitalRadius: number,
  centralMass: number,
  angleDegrees: number // Initial angle in degrees
): SceneObject => {
  const planetDef = REAL_OBJECT_DEFINITIONS[planetKey];
  if (!planetDef) throw new Error(`Planet definition not found for ${planetKey}`);

  const angleRadians = angleDegrees * (Math.PI / 180);
  const positionX = orbitalRadius * Math.cos(angleRadians);
  const positionZ = orbitalRadius * Math.sin(angleRadians); // Orbit in XZ plane

  const velocityMagnitude = calculateOrbitalVelocity(centralMass, orbitalRadius);
  // Velocity perpendicular to the position vector for circular orbit in XZ plane
  const velocityX = -velocityMagnitude * Math.sin(angleRadians);
  const velocityZ = velocityMagnitude * Math.cos(angleRadians);

  return {
    id: `preset_${planetDef.name.toLowerCase().replace(/\s+/g, '')}`,
    type: planetDef.type,
    name: planetDef.name,
    mass: planetDef.mass,
    radius: planetDef.radius,
    color: planetDef.color,
    position: { x: positionX, y: 0, z: positionZ },
    velocity: { x: velocityX, y: 0, z: velocityZ },
  };
};


export const PRESET_SCENARIOS: Record<string, { name: string; description: string; objects: SceneObject[] }> = {
  realSolarSystem: {
    name: "Real Solar System",
    description: "The Sun and 8 planets in approximate orbits.", // Updated description
    objects: (() => {
      const sun = {
        ...REAL_OBJECT_DEFINITIONS.SUN,
        id: 'preset_sun_rss',
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      } as SceneObject;

      const planets: SceneObject[] = [
        getPlanetWithOrbit('MERCURY', MERCURY_ORBIT_RADIUS, SUN_SIMULATION_MASS, 0),
        getPlanetWithOrbit('VENUS', VENUS_ORBIT_RADIUS, SUN_SIMULATION_MASS, 45),
        getPlanetWithOrbit('EARTH', EARTH_ORBIT_RADIUS, SUN_SIMULATION_MASS, 90),
        getPlanetWithOrbit('MARS', MARS_ORBIT_RADIUS, SUN_SIMULATION_MASS, 135),
        getPlanetWithOrbit('JUPITER', JUPITER_ORBIT_RADIUS, SUN_SIMULATION_MASS, 180),
        getPlanetWithOrbit('SATURN', SATURN_ORBIT_RADIUS, SUN_SIMULATION_MASS, 225),
        getPlanetWithOrbit('URANUS', URANUS_ORBIT_RADIUS, SUN_SIMULATION_MASS, 270),
        getPlanetWithOrbit('NEPTUNE', NEPTUNE_ORBIT_RADIUS, SUN_SIMULATION_MASS, 315),
      ];

      // Moon creation logic removed
      // const earth = planets.find(p => p.name === 'Earth');
      // let moon: SceneObject | null = null;
      // if (earth) {
      //   const moonDef = REAL_OBJECT_DEFINITIONS.MOON;
      //   const moonOrbitalVelocity = calculateOrbitalVelocity(earth.mass, MOON_ORBIT_RADIUS_AROUND_EARTH);
      //   moon = {
      //     id: 'preset_moon_rss',
      //     type: moonDef.type,
      //     name: moonDef.name,
      //     mass: moonDef.mass,
      //     radius: moonDef.radius,
      //     color: moonDef.color,
      //     position: {
      //       x: earth.position.x + MOON_ORBIT_RADIUS_AROUND_EARTH,
      //       y: earth.position.y,
      //       z: earth.position.z,
      //     },
      //     velocity: {
      //       x: earth.velocity.x,
      //       y: earth.velocity.y,
      //       z: earth.velocity.z + moonOrbitalVelocity,
      //     },
      //   };
      // }

      return [sun, ...planets]; // Removed Moon from the return array
    })(),
  },
  binaryPair: {
    name: "Binary Pair",
    description: "Two stars orbiting their common center of mass.",
    objects: [
      {
        id: 'preset_starA', type: 'massive', name: 'Star Alpha', mass: 80000,
        radius: 25, color: '#FF8C00',
        position: { x: -150, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 13 }
      },
      {
        id: 'preset_starB', type: 'massive', name: 'Star Beta', mass: 60000,
        radius: 20, color: '#ADD8E6',
        position: { x: 200, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: -10 }
      }
    ]
  },
  cometSlingshot: {
    name: "Comet Slingshot",
    description: "A comet passing by a massive star for a gravitational assist.",
    objects: [
        {
            id: 'preset_heavyStar', type: 'massive', name: 'Graviton Prime', mass: 200000,
            radius: 40, color: '#DC143C',
            position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }
        },
        {
            id: 'preset_comet', type: 'orbiter', name: 'Icarus Comet', mass: 1,
            radius: 2, color: '#E0FFFF',
            position: { x: 800, y: 0, z: -800 }, velocity: { x: -15, y: 0, z: 5 }
        },
    ]
  }
};

