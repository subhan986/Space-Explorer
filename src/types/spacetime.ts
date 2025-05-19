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
}

export interface MassiveObject extends BaseObject {
  type: 'massive';
  mass: number;
}

export interface OrbiterObject extends BaseObject {
  type: 'orbiter';
  // Orbiters might have a very small, fixed mass, or mass might be ignored for simplicity
  mass?: number; 
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
