
// src/lib/preset-scenarios.ts
import type { SceneObject } from '@/types/spacetime';
import { REAL_OBJECT_DEFINITIONS } from './real-objects';
import {
  G_CONSTANT,
  SUN_SIMULATION_MASS,
  MERCURY_ORBIT_RADIUS, VENUS_ORBIT_RADIUS, EARTH_ORBIT_RADIUS,
  MARS_ORBIT_RADIUS, JUPITER_ORBIT_RADIUS, SATURN_ORBIT_RADIUS,
  URANUS_ORBIT_RADIUS, NEPTUNE_ORBIT_RADIUS
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
    id: `preset_${planetDef.name.toLowerCase().replace(/\s+/g, '')}_${Date.now()}`, // Ensure unique IDs for presets
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
    description: "The Sun and 8 planets in approximate orbits.",
    objects: (() => {
      const sun = {
        ...REAL_OBJECT_DEFINITIONS.SUN,
        id: `preset_sun_rss_${Date.now()}`,
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
      return [sun, ...planets];
    })(),
  },
  binaryPair: {
    name: "Binary Pair",
    description: "Two stars orbiting their common center of mass.",
    objects: [
      {
        id: `preset_starA_${Date.now()}`, type: 'massive', name: 'Star Alpha', mass: 80000,
        radius: 25, color: '#FF8C00',
        position: { x: -150, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 13 }
      },
      {
        id: `preset_starB_${Date.now()}`, type: 'massive', name: 'Star Beta', mass: 60000,
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
            id: `preset_heavyStar_cs_${Date.now()}`, type: 'massive', name: 'Graviton Prime', mass: 200000,
            radius: 40, color: '#DC143C',
            position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }
        },
        {
            id: `preset_comet_cs_${Date.now()}`, type: 'orbiter', name: 'Icarus Comet', mass: 1,
            radius: 2, color: '#E0FFFF',
            position: { x: 800, y: 0, z: -800 }, velocity: { x: -15, y: 0, z: 5 }
        },
    ]
  },
  sunSupernova: {
    name: "Sun's Demise (Supernova)",
    description: "Our Sun is impacted by a rogue object, triggering a supernova.",
    objects: [
      {
        ...(REAL_OBJECT_DEFINITIONS.SUN), // Spread the Sun's properties
        id: `preset_sun_sn_${Date.now()}`,
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      },
      {
        id: `preset_impactor_sun_${Date.now()}`,
        type: 'orbiter', // Must be non-star to fit collision logic
        name: 'Rogue Impactor',
        mass: REAL_OBJECT_DEFINITIONS.SUN.mass, // Mass to trigger supernova
        radius: 1, // Visually small
        color: '#303030', // Dark, inconspicuous
        position: { x: REAL_OBJECT_DEFINITIONS.SUN.radius + 2, y: 0, z: 0 }, // Start very close
        velocity: { x: -50, y: 0, z: 0 }, // Move directly towards the Sun
      }
    ]
  },
  blackHoleGenesis: {
    name: "Black Hole Genesis",
    description: "A very massive star collapses into a black hole after a supernova.",
    objects: [
      {
        id: `preset_massive_star_bhg_${Date.now()}`,
        type: 'massive',
        name: 'Star Gigantus',
        mass: 300000, // Above BLACK_HOLE_MIN_ORIGINAL_MASS (250000)
        radius: 50,
        color: '#ADD8E6', // Light Blue supergiant
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      },
      {
        id: `preset_impactor_bhg_${Date.now()}`,
        type: 'orbiter',
        name: 'Catalyst Impactor',
        mass: 300000, // Match star's mass to trigger
        radius: 2,
        color: '#404040',
        position: { x: 50 + 3, y: 0, z: 0 }, // Star radius + impactor radius + small gap
        velocity: { x: -75, y: 0, z: 0 }, // Fast impact
      }
    ]
  },
  neutronStarForge: {
    name: "Neutron Star Forge",
    description: "A heavy star undergoes supernova and forms a dense neutron star.",
    objects: [
      {
        id: `preset_heavy_star_nsf_${Date.now()}`,
        type: 'massive',
        name: 'Star Magnus',
        mass: 100000, // Between NEUTRON_STAR_MIN_ORIGINAL_MASS (75k) and BLACK_HOLE_MIN_ORIGINAL_MASS (250k)
        radius: 35,
        color: '#FFDEAD', // NavajoWhite, a large star
        position: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
      },
      {
        id: `preset_impactor_nsf_${Date.now()}`,
        type: 'orbiter',
        name: 'Trigger Impactor',
        mass: 100000, // Match star's mass to trigger
        radius: 1.5,
        color: '#383838',
        position: { x: 35 + 2.5, y: 0, z: 0 }, // Star radius + impactor radius + small gap
        velocity: { x: -60, y: 0, z: 0 }, // Fast impact
      }
    ]
  }
};

    