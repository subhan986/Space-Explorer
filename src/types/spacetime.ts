
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
  textureUrl?: string; // Optional URL for object texture
}

export interface MassiveObject extends BaseObject {
  type: 'massive';
  // Mass is inherited. MassiveObjects typically have a larger default mass.
}

export interface OrbiterObject extends BaseObject {
  type: 'orbiter';
  // Mass is inherited. OrbiterObjects typically have a smaller default mass, or 0 for tracers.
}

export type SceneObject = MassiveObject | OrbiterObject;

export interface SimulationConfig {
  simulationSpeed: number;
  showTrajectories: boolean;
  trajectoryLength: number;
}

export interface AISuggestion {
  suggestedMass: number;
  suggestedVelocity: number;
  explanation: string;
}
