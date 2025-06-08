
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type ObjectType = 'massive' | 'orbiter' | 'neutron_star' | 'black_hole_remnant';

export interface BaseObject {
  id: string;
  type: ObjectType;
  name: string;
  position: Vector3;
  velocity: Vector3;
  radius: number; // For visual representation
  color: string; // Hex color string
  mass: number; // All objects have a mass, can be 0 for tracer/massless particles
  isManuallyTriggeredSupernova?: boolean; // Flag to manually trigger a supernova
  hasLife?: boolean; // For randomly generated systems
}

export interface MassiveObject extends BaseObject {
  type: 'massive';
}

export interface OrbiterObject extends BaseObject {
  type: 'orbiter';
}

export interface NeutronStarObject extends BaseObject {
    type: 'neutron_star';
}

export interface BlackHoleRemnantObject extends BaseObject {
    type: 'black_hole_remnant';
}

export type SceneObject = MassiveObject | OrbiterObject | NeutronStarObject | BlackHoleRemnantObject;

export interface SimulationConfig {
  simulationSpeed: number;
  showTrajectories: boolean;
  trajectoryLength: number;
}

export type LightingMode = "Realistic Solar" | "Ambient Glow" | "Dramatic Edge";

export interface SavedSimulationState {
  objects: SceneObject[];
  simulationSpeed: number;
  showTrajectories: boolean;
  trajectoryLength: number;
  lightingMode: LightingMode;
  showShadows: boolean;
  simulatedDate?: string; // Changed from Date to string for serialization
}

// Type for the remnant created after a supernova
export type SupernovaRemnantType = 'neutron_star' | 'black_hole_remnant' | 'none'; // 'none' if it completely dissipates (future)
