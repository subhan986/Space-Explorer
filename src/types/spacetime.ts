
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type ObjectType = 'massive' | 'orbiter';

export interface BaseObject {
  id: string;
  type: ObjectType;
  name: string;
  position: Vector3;
  velocity: Vector3;
  radius: number; // For visual representation
  color: string; // Hex color string
  mass: number; // All objects have a mass, can be 0 for tracer/massless particles
}

export interface MassiveObject extends BaseObject {
  type: 'massive';
}

export interface OrbiterObject extends BaseObject {
  type: 'orbiter';
}

export type SceneObject = MassiveObject | OrbiterObject;

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
  // Future: camera position, selected object ID, etc.
}
