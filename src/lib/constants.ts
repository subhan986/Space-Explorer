
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

export const MAX_PARTICLES = 10000; // Maximum number of particles for collision/supernova effects

// Supernova Constants
export const SUPERNOVA_DURATION = 3.0; // seconds
export const SUPERNOVA_MAX_RADIUS_MULTIPLIER = 20; // Star expands to this times its original radius
export const SUPERNOVA_PARTICLE_COUNT_PER_BURST = 50; // Particles per emission burst
export const SUPERNOVA_PARTICLE_EMISSION_INTERVAL = 0.03; // Time in seconds between particle bursts
export const SUPERNOVA_SHOCKWAVE_DURATION = 1.5; // seconds, typically shorter than full supernova
export const SUPERNOVA_SHOCKWAVE_MAX_RADIUS_FACTOR = 3; // Factor of final supernova expanded radius

// Remnant Creation Constants
// These are example thresholds and properties, adjust as needed for desired simulation behavior.
// Masses are based on the *original* star's mass before supernova.
export const NEUTRON_STAR_MIN_ORIGINAL_MASS = 75000; // e.g., if original star mass was >= this
export const BLACK_HOLE_MIN_ORIGINAL_MASS = 250000; // e.g., if original star mass was >= this

export const NEUTRON_STAR_COLOR = '#ADD8E6'; // Light Blue / White
export const NEUTRON_STAR_RADIUS_SIM = 1.5; // Very small visual radius
export const NEUTRON_STAR_MASS_SIM_FACTOR = 0.3; // e.g., 30% of original star's mass

export const BLACK_HOLE_REMNANT_COLOR = '#000000';
export const BLACK_HOLE_REMNANT_RADIUS_SIM = 5; // Small, but larger than neutron star
export const BLACK_HOLE_REMNANT_MASS_SIM_FACTOR = 0.5; // e.g., 50% of original star's mass
export const REMNANT_VELOCITY_KICK_MAGNITUDE = 5; // Small random velocity after supernova

// Particle colors for supernova debris (representing different elements)
export const SUPERNOVA_PARTICLE_COLORS = [
    '#FFFFFF', '#FFFFE0', '#FFD700', '#FFA500', '#FF4500', '#FF6347', '#ADD8E6', '#90EE90'
    // White, LightYellow (Helium), Gold (Carbon/Oxygen), Orange, OrangeRed, Tomato (Iron), LightBlue (Lighter elements), LightGreen (Silicon/Sulfur)
];
