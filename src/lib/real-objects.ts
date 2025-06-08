
// src/lib/real-objects.ts
import type { Vector3 } from '@/types/spacetime';
import { GRID_SIZE } from './constants';

export interface CompositionComponent {
  name: string;
  value: string; // e.g., "78.08%" or "1.9E-09 M EARTH"
  iconColor?: string; // Hex or HSL string for the dot icon
}

export interface RealObjectDefinition extends Omit<Partial<SceneObject>, 'id' | 'position' | 'velocity' > {
  name: string;
  type: 'massive' | 'orbiter';
  mass: number; // Scaled mass for simulation
  radius: number; // Visual radius for simulation
  color: string; // Fallback color
  description?: string; // Short descriptive text
  composition?: CompositionComponent[]; // Updated: Array of composition components
  basePosition?: Vector3; // Optional base position if not orbiting
  baseVelocity?: Vector3; // Optional base velocity
  orbits?: 'Sun' | 'Earth'; // Hints for orbital placement
  realMassKg?: string; // Informational: Real mass in kg
  massEarthUnits?: string; // e.g., "0.815 M EARTH"
  radiusEarthUnits?: string; // e.g., "0.95 R EARTH"
  density?: string; // e.g., "5.24 g/cm³"
  avgTemperature?: string; // e.g., "424 °C"
  typicalSpeedKmS?: string; // e.g., "34.8 km/s" (for display, live speed is calculated)
  rotationalPeriod?: string; // e.g., "243 day"
  orbitalPeriodDisplay?: string; // e.g., "7.38 month" (for display)
  isPlanet?: boolean; // To help with subtitles like "Planet orbiting..."
}

export const REAL_OBJECT_DEFINITIONS: Record<string, RealObjectDefinition> = {
  SUN: {
    name: 'Sun',
    type: 'massive',
    mass: 150000,
    radius: 30,
    color: '#FFD700', // Yellow
    description: 'The star at the center of our Solar System, a nearly perfect sphere of hot plasma.',
    composition: [
      { name: 'Hydrogen', value: '~73%', iconColor: '#FFFACD' },
      { name: 'Helium', value: '~25%', iconColor: '#FFDAB9' },
      { name: 'Oxygen', value: '0.77%', iconColor: '#ADD8E6' },
      { name: 'Carbon', value: '0.29%', iconColor: '#A9A9A9' },
      { name: 'Iron', value: '0.16%', iconColor: '#B0C4DE' },
    ],
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: '1.989 × 10³⁰ kg',
    isPlanet: false,
  },
  MERCURY: {
    name: 'Mercury',
    type: 'orbiter',
    mass: 10,
    radius: 2,
    color: '#A9A9A9', // DarkGray
    description: 'The smallest planet in the Solar System and the closest to the Sun.',
    composition: [
      { name: 'Oxygen', value: '42%', iconColor: '#ADD8E6' },
      { name: 'Sodium', value: '29%', iconColor: '#FAFAD2' },
      { name: 'Hydrogen', value: '22%', iconColor: '#FFFACD' },
      { name: 'Helium', value: '6%', iconColor: '#FFDAB9' },
      { name: 'Potassium', value: '0.5%', iconColor: '#FFE4E1' },
    ], // Atmospheric composition
    orbits: 'Sun',
    realMassKg: '3.285 × 10²³ kg',
    massEarthUnits: '0.055 M EARTH',
    radiusEarthUnits: '0.383 R EARTH',
    density: '5.43 g/cm³',
    avgTemperature: '167 °C',
    typicalSpeedKmS: '47.4 km/s',
    rotationalPeriod: '58.6 days',
    orbitalPeriodDisplay: '88 days',
    isPlanet: true,
  },
  VENUS: {
    name: 'Venus',
    type: 'orbiter',
    mass: 80,
    radius: 4.5,
    color: '#FFF8DC', // Cornsilk
    description: "Earth's 'sister planet' due to similar size and mass, with a dense, toxic atmosphere.",
    composition: [
      { name: 'Carbon Dioxide', value: '96.5%', iconColor: '#A9A9A9' },
      { name: 'Nitrogen', value: '3.5%', iconColor: '#87CEEB' },
      { name: 'Sulfur Dioxide', value: '0.015%', iconColor: '#FFFFE0' }, // LightYellow for SO2
      { name: 'Argon', value: '0.007%', iconColor: '#D3D3D3' },
      { name: 'Water Vapor', value: '0.002%', iconColor: '#E0FFFF' },
    ], // Atmospheric composition
    orbits: 'Sun',
    realMassKg: '4.867 × 10²⁴ kg',
    massEarthUnits: '0.815 M EARTH',
    radiusEarthUnits: '0.949 R EARTH',
    density: '5.24 g/cm³',
    avgTemperature: '464 °C',
    typicalSpeedKmS: '35.0 km/s',
    rotationalPeriod: '243 days (retrograde)',
    orbitalPeriodDisplay: '224.7 days',
    isPlanet: true,
  },
  EARTH: {
    name: 'Earth',
    type: 'orbiter',
    mass: 100,
    radius: 5,
    color: '#4169E1', // Blue
    description: 'Our home planet, the only known astronomical object to harbor life.',
    composition: [ // Atmospheric composition by volume
      { name: 'Nitrogen', value: '78.08%', iconColor: '#87CEEB' },
      { name: 'Oxygen', value: '20.95%', iconColor: '#ADD8E6' },
      { name: 'Argon', value: '0.93%', iconColor: '#D3D3D3' },
      { name: 'Carbon Dioxide', value: '0.04%', iconColor: '#A9A9A9' },
      { name: 'Water Vapor', value: '~1% (variable)', iconColor: '#E0FFFF' },
      { name: 'Trace Gases', value: '<0.01%', iconColor: '#F5F5F5' },
    ],
    orbits: 'Sun',
    realMassKg: '5.972 × 10²⁴ kg',
    massEarthUnits: '1 M EARTH',
    radiusEarthUnits: '1 R EARTH',
    density: '5.51 g/cm³',
    avgTemperature: '15 °C',
    typicalSpeedKmS: '29.8 km/s',
    rotationalPeriod: '23.9 hours',
    orbitalPeriodDisplay: '365.25 days',
    isPlanet: true,
  },
  MOON: {
    name: 'Moon',
    type: 'orbiter',
    mass: 1, // Sim mass
    radius: 1.5, // Sim radius
    color: '#FFFFFF', // White
    description: "Earth's only natural satellite. Its surface is cratered and dusty.",
    composition: [ // Surface composition (approximate)
      { name: 'Oxygen', value: '43%', iconColor: '#ADD8E6'},
      { name: 'Silicon', value: '21%', iconColor: '#C0C0C0'}, // Silver for Silicon
      { name: 'Aluminum', value: '10%', iconColor: '#DCDCDC'}, // Gainsboro for Aluminum
      { name: 'Calcium', value: '9%', iconColor: '#F5F5DC'}, // Beige for Calcium
      { name: 'Iron', value: '9%', iconColor: '#B0C4DE'},
      { name: 'Magnesium', value: '5%', iconColor: '#E6E6FA'}, // Lavender for Magnesium
      { name: 'Titanium', value: '2%', iconColor: '#778899'}, // LightSlateGray for Titanium
    ],
    orbits: 'Earth',
    realMassKg: '7.342 × 10²² kg',
    massEarthUnits: '0.0123 M EARTH',
    radiusEarthUnits: '0.273 R EARTH',
    density: '3.34 g/cm³',
    avgTemperature: '-20 °C (varies greatly)',
    typicalSpeedKmS: '1.022 km/s (orbital)',
    rotationalPeriod: '27.3 days (synchronous)',
    orbitalPeriodDisplay: '27.3 days (around Earth)',
    isPlanet: false,
  },
  MARS: {
    name: 'Mars',
    type: 'orbiter',
    mass: 20,
    radius: 3,
    color: '#FF4500', // OrangeRed
    description: 'The "Red Planet", known for its rusty appearance and potential for past life.',
    composition: [ // Atmospheric composition
      { name: 'Carbon Dioxide', value: '95.32%', iconColor: '#A9A9A9' },
      { name: 'Nitrogen', value: '2.7%', iconColor: '#87CEEB' },
      { name: 'Argon', value: '1.6%', iconColor: '#D3D3D3' },
      { name: 'Oxygen', value: '0.13%', iconColor: '#ADD8E6' },
      { name: 'Carbon Monoxide', value: '0.08%', iconColor: '#B0B0B0' },
    ],
    orbits: 'Sun',
    realMassKg: '6.39 × 10²³ kg',
    massEarthUnits: '0.107 M EARTH',
    radiusEarthUnits: '0.532 R EARTH',
    density: '3.93 g/cm³',
    avgTemperature: '-65 °C',
    typicalSpeedKmS: '24.1 km/s',
    rotationalPeriod: '24.6 hours',
    orbitalPeriodDisplay: '687 days',
    isPlanet: true,
  },
  JUPITER: {
    name: 'Jupiter',
    type: 'orbiter',
    mass: 10000,
    radius: 20,
    color: '#D2B48C', // Tan
    description: 'The largest planet in the Solar System, a gas giant with a Great Red Spot.',
    composition: [ // Atmospheric composition (upper atmosphere)
      { name: 'Hydrogen', value: '~89.8%', iconColor: '#FFFACD' },
      { name: 'Helium', value: '~10.2%', iconColor: '#FFDAB9' },
      { name: 'Methane', value: '0.3%', iconColor: '#90EE90' }, // LightGreen for Methane
      { name: 'Ammonia', value: '0.026%', iconColor: '#F0FFFF' }, // Azure for Ammonia
    ],
    orbits: 'Sun',
    realMassKg: '1.898 × 10²⁷ kg',
    massEarthUnits: '317.8 M EARTH',
    radiusEarthUnits: '11.21 R EARTH',
    density: '1.33 g/cm³',
    avgTemperature: '-145 °C (cloud tops)',
    typicalSpeedKmS: '13.1 km/s',
    rotationalPeriod: '9.9 hours',
    orbitalPeriodDisplay: '11.86 years',
    isPlanet: true,
  },
  SATURN: {
    name: 'Saturn',
    type: 'orbiter',
    mass: 6000,
    radius: 18,
    color: '#F0E68C', // Khaki
    description: 'Known for its prominent ring system, a gas giant primarily composed of hydrogen and helium.',
    composition: [ // Atmospheric composition
      { name: 'Hydrogen', value: '~96.3%', iconColor: '#FFFACD' },
      { name: 'Helium', value: '~3.25%', iconColor: '#FFDAB9' },
      { name: 'Methane', value: '0.45%', iconColor: '#90EE90' },
      { name: 'Ammonia', value: '0.0125%', iconColor: '#F0FFFF' },
    ],
    orbits: 'Sun',
    realMassKg: '5.683 × 10²⁶ kg',
    massEarthUnits: '95.2 M EARTH',
    radiusEarthUnits: '9.45 R EARTH',
    density: '0.687 g/cm³',
    avgTemperature: '-178 °C (cloud tops)',
    typicalSpeedKmS: '9.7 km/s',
    rotationalPeriod: '10.7 hours',
    orbitalPeriodDisplay: '29.45 years',
    isPlanet: true,
  },
  URANUS: {
    name: 'Uranus',
    type: 'orbiter',
    mass: 1500,
    radius: 10,
    color: '#AFEEEE', // PaleTurquoise
    description: 'An ice giant with a unique tilt, appearing blue-green due to methane in its atmosphere.',
    composition: [ // Atmospheric composition
      { name: 'Hydrogen', value: '~82.5%', iconColor: '#FFFACD' },
      { name: 'Helium', value: '~15.2%', iconColor: '#FFDAB9' },
      { name: 'Methane', value: '2.3%', iconColor: '#90EE90' }, // Methane gives it its blue color
    ],
    orbits: 'Sun',
    realMassKg: '8.681 × 10²⁵ kg',
    massEarthUnits: '14.5 M EARTH',
    radiusEarthUnits: '4.01 R EARTH',
    density: '1.27 g/cm³',
    avgTemperature: '-214 °C (cloud tops)',
    typicalSpeedKmS: '6.8 km/s',
    rotationalPeriod: '17.2 hours (retrograde)',
    orbitalPeriodDisplay: '84 years',
    isPlanet: true,
  },
  NEPTUNE: {
    name: 'Neptune',
    type: 'orbiter',
    mass: 1700,
    radius: 9.5,
    color: '#0000CD', // MediumBlue
    description: 'The most distant planet from the Sun, an ice giant known for its strong winds.',
    composition: [ // Atmospheric composition
      { name: 'Hydrogen', value: '~80%', iconColor: '#FFFACD' },
      { name: 'Helium', value: '~19%', iconColor: '#FFDAB9' },
      { name: 'Methane', value: '1.5%', iconColor: '#90EE90' },
    ],
    orbits: 'Sun',
    realMassKg: '1.024 × 10²⁶ kg',
    massEarthUnits: '17.1 M EARTH',
    radiusEarthUnits: '3.88 R EARTH',
    density: '1.64 g/cm³',
    avgTemperature: '-218 °C (cloud tops)',
    typicalSpeedKmS: '5.4 km/s',
    rotationalPeriod: '16.1 hours',
    orbitalPeriodDisplay: '164.8 years',
    isPlanet: true,
  },
  ISS: {
    name: 'ISS',
    type: 'orbiter',
    mass: 0.1, // Very small mass for simulation purposes, effectively a tracer
    radius: 1.5, // Visual size
    color: '#C0C0C0', // Silver
    description: 'International Space Station, a habitable artificial satellite in low Earth orbit.',
    composition: [{ name: 'Various Metals & Composites', value: '100%', iconColor: '#BEBEBE' }],
    orbits: 'Earth', // This will need specific logic if we want it to orbit Earth in presets
    realMassKg: '~4.2 × 10⁵ kg', // Approx. 420 metric tons
    isPlanet: false,
  },
  HALLEYS_COMET: {
    name: "Halley's Comet",
    type: 'orbiter',
    mass: 0.1, // Simulation mass, very small
    radius: 2.0, // Visual size
    color: '#ADD8E6', // Light Blue, to represent icy nature
    description: 'A famous short-period comet, visible from Earth every 75–79 years.',
    composition: [
        { name: 'Water Ice', value: '~80%', iconColor: '#E0FFFF' }, // LightCyan for water ice
        { name: 'Carbon Monoxide Ice', value: '~10%', iconColor: '#F0F8FF' }, // AliceBlue for CO ice
        { name: 'Dust & Rock', value: '~10%', iconColor: '#8B4513' }, // SaddleBrown for dust/rock
    ],
    // For a preset, we'd give it a specific initial position and velocity
    // to simulate its eccentric orbit, rather than a simple 'orbits: Sun'.
    basePosition: { x: GRID_SIZE / 3, y: 0, z: GRID_SIZE / 3 }, // Example starting far out
    baseVelocity: { x: -20, y: 5, z: -15 }, // Example velocity for an incoming path
    realMassKg: '~2.2 × 10¹⁴ kg',
    isPlanet: false,
  },
  CERES: {
    name: 'Ceres',
    type: 'orbiter',
    mass: 50, // Simulation mass
    radius: 4,  // Visual radius
    color: '#808080', // Gray
    description: 'The largest object in the asteroid belt, classified as a dwarf planet.',
    composition: [
        { name: 'Water Ice', value: 'up to 25% (mantle)', iconColor: '#E0FFFF' },
        { name: 'Rock & Silicates', value: 'core & crust', iconColor: '#A0522D' }, // Sienna for rock
    ],
    orbits: 'Sun', // It's in the asteroid belt orbiting the Sun
    realMassKg: '9.39 × 10²⁰ kg',
    massEarthUnits: '0.00015 M EARTH',
    radiusEarthUnits: '0.074 R EARTH', // Approx 473 km radius
    density: '2.16 g/cm³',
    avgTemperature: '-105 °C',
    typicalSpeedKmS: '17.9 km/s',
    rotationalPeriod: '9.07 hours',
    orbitalPeriodDisplay: '4.6 years',
    isPlanet: false, // It's a dwarf planet
  },
  BLACK_HOLE: {
    name: 'Black Hole', // Generic black hole for presets
    type: 'massive',
    mass: 500000, // Very high simulation mass
    radius: 15,    // Visual radius (event horizon would be smaller relative to mass)
    color: '#000000', // Black
    description: 'A region of spacetime where gravity is so strong that nothing, not even light, can escape.',
    composition: [{ name: 'Singularity', value: 'N/A', iconColor: '#101010' }],
    basePosition: { x: 0, y: 0, z: 0 },
    baseVelocity: { x: 0, y: 0, z: 0 },
    realMassKg: 'N/A (conceptual)',
    isPlanet: false,
  },
  SAGITTARIUS_A_STAR: {
      name: 'Sagittarius A*',
      type: 'massive',
      mass: 5000000, // Extremely massive for simulation
      radius: 20, // Visual representation
      color: '#000000', // Black
      description: 'The supermassive black hole at the Galactic Center of the Milky Way.',
      composition: [{ name: 'Singularity', value: 'N/A', iconColor: '#101010'}],
      basePosition: { x: 0, y: 0, z: 0 },
      baseVelocity: { x: 0, y: 0, z: 0 },
      realMassKg: '~8.6 × 10³⁶ kg (4.3 million solar masses)',
      isPlanet: false,
  },
};
