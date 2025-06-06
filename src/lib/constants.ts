
import type { Vector3 } from '@/types/spacetime';

export const DEFAULT_MASSIVE_OBJECT_RADIUS = 10;
export const DEFAULT_ORBITER_OBJECT_RADIUS = 2;
export const DEFAULT_MASSIVE_OBJECT_COLOR = '#FFD700'; // Gold
export const DEFAULT_ORBITER_OBJECT_COLOR = '#00BFFF'; // DeepSkyBlue

export const INITIAL_CAMERA_POSITION: Vector3 = { x: 0, y: 2000, z: 5000 };
export const GRID_SIZE = 20000;
export const GRID_DIVISIONS = 50;

export const MIN_SIMULATION_SPEED = 0.1;
export const MAX_SIMULATION_SPEED = 5.0;
export const DEFAULT_SIMULATION_SPEED = 1.0;

export const DEFAULT_TRAJECTORY_LENGTH = 200;

export const G_CONSTANT = 1; // Gravitational constant - Reduced for more stable orbits
export const DEFAULT_ORBITAL_DISTANCE_OFFSET = 50; // Default additional distance for orbiters from massive objects

// Orbital Radii for "Real Solar System" preset (approximate simulation units)
export const SUN_SIMULATION_MASS = 150000; // Anchor mass for orbital calculations

export const MERCURY_ORBIT_RADIUS = 150;
export const VENUS_ORBIT_RADIUS = 220;
export const EARTH_ORBIT_RADIUS = 300;
export const MARS_ORBIT_RADIUS = 450;
export const JUPITER_ORBIT_RADIUS = 800;
export const SATURN_ORBIT_RADIUS = 1300;
export const URANUS_ORBIT_RADIUS = 1900;
export const NEPTUNE_ORBIT_RADIUS = 2500;

export const MOON_ORBIT_RADIUS_AROUND_EARTH = 10; // Reduced from 30 for stability

