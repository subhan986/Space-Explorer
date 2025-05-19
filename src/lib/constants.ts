
import type { Vector3 } from '@/types/spacetime';

export const DEFAULT_MASSIVE_OBJECT_RADIUS = 10;
export const DEFAULT_ORBITER_OBJECT_RADIUS = 2;
export const DEFAULT_MASSIVE_OBJECT_COLOR = '#FFD700'; // Gold
export const DEFAULT_ORBITER_OBJECT_COLOR = '#00BFFF'; // DeepSkyBlue

export const INITIAL_CAMERA_POSITION: Vector3 = { x: 0, y: 50, z: 150 };
export const GRID_SIZE = 200;
export const GRID_DIVISIONS = 20;

export const MIN_SIMULATION_SPEED = 0.1;
export const MAX_SIMULATION_SPEED = 5.0;
export const DEFAULT_SIMULATION_SPEED = 1.0;

export const DEFAULT_TRAJECTORY_LENGTH = 200;

export const G_CONSTANT = 50; // Gravitational constant
export const DEFAULT_ORBITAL_DISTANCE_OFFSET = 50; // Default additional distance for orbiters from massive objects
