
// src/lib/random-solar-system-generator.ts

import type { SceneObject } from '@/types/spacetime';
import { G_CONSTANT } from './constants';

// --- Helper Functions ---
function getRandomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function getRandomIntInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomColor(): string {
  const r = Math.floor(getRandomInRange(50, 255)).toString(16).padStart(2, '0');
  const g = Math.floor(getRandomInRange(50, 255)).toString(16).padStart(2, '0');
  const b = Math.floor(getRandomInRange(50, 255)).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function calculateOrbitalVelocityMagnitude(centralMass: number, distance: number): number {
  if (centralMass <= 0 || distance <= 0) return 0;
  const speed = Math.sqrt((G_CONSTANT * centralMass) / distance);
  return isFinite(speed) ? speed : 0;
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const PLANET_SUFFIXES = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"];


// --- Generation Constants ---
const STAR_MASS_MIN = 75000;
const STAR_MASS_MAX = 300000;
const STAR_RADIUS_FACTOR = 0.035; // Adjusted for visual scale

const PLANET_COUNT_MIN = 2;
const PLANET_COUNT_MAX = 7;
const PLANET_MASS_MIN = 5;
const PLANET_MASS_MAX = 2000;
const PLANET_RADIUS_FACTOR = 0.25; // Adjusted
const PLANET_MIN_ORBIT_DIST_FROM_STAR_FACTOR = 5; // Multiplier of star radius
const PLANET_ORBIT_SPACING_MIN_FACTOR = 1.5; // Multiplier of previous orbit dist
const PLANET_ORBIT_SPACING_MAX_FACTOR = 3.0; // Multiplier of previous orbit dist
const LIFE_CHANCE_PERCENTAGE = 0.20; // 20% chance of life

const MOON_COUNT_MIN = 0;
const MOON_COUNT_MAX = 3;
const MOON_MASS_MIN_FACTOR = 0.0005; // % of planet mass, adjusted
const MOON_MASS_MAX_FACTOR = 0.02;  // % of planet mass, adjusted
const MOON_RADIUS_FACTOR = 0.18; // Adjusted
const MOON_MIN_ORBIT_DIST_FROM_PLANET_FACTOR = 2.0; // Multiplier of planet radius
const MOON_ORBIT_SPACING_MIN_FACTOR = 1.2; // Multiplier of previous moon orbit dist or planet radius
const MOON_ORBIT_SPACING_MAX_FACTOR = 2.0;

let systemCounter = 0;

export function generateRandomSolarSystem(): SceneObject[] {
  systemCounter++;
  const objects: SceneObject[] = [];
  const systemName = `System ${ROMAN_NUMERALS[getRandomIntInRange(0, ROMAN_NUMERALS.length -1)]}${systemCounter}`;

  // 1. Generate Star
  const starMass = getRandomInRange(STAR_MASS_MIN, STAR_MASS_MAX);
  const starRadius = Math.max(15, Math.pow(starMass, 1 / 3) * STAR_RADIUS_FACTOR); // Ensure min radius
  const starColor = `hsl(${getRandomInRange(15, 55)}, 100%, ${getRandomInRange(60, 80)}%)`; // Brighter Yellows, Oranges

  const star: SceneObject = {
    id: `star_${systemName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
    type: 'massive',
    name: `${systemName} Prime`,
    mass: starMass,
    radius: starRadius,
    color: starColor,
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  };
  objects.push(star);

  // 2. Generate Planets
  const numPlanets = getRandomIntInRange(PLANET_COUNT_MIN, PLANET_COUNT_MAX);
  let lastPlanetOrbitDistance = starRadius * PLANET_MIN_ORBIT_DIST_FROM_STAR_FACTOR;

  for (let i = 0; i < numPlanets; i++) {
    const planetMass = getRandomInRange(PLANET_MASS_MIN, PLANET_MASS_MAX);
    const planetRadius = Math.max(1.5, Math.pow(planetMass, 1 / 3) * PLANET_RADIUS_FACTOR); // Ensure min radius
    const hasLife = Math.random() < LIFE_CHANCE_PERCENTAGE;
    let planetColor = getRandomColor();
    if (hasLife) {
        const lifeHue = getRandomInRange(90, 160); // Greens to teals/cyans
        planetColor = `hsl(${lifeHue}, ${getRandomInRange(50,75)}%, ${getRandomInRange(45,65)}%)`;
    }

    const orbitSpacingFactor = getRandomInRange(PLANET_ORBIT_SPACING_MIN_FACTOR, PLANET_ORBIT_SPACING_MAX_FACTOR);
    const currentPlanetOrbitDistance = lastPlanetOrbitDistance * orbitSpacingFactor + planetRadius * 2;
    lastPlanetOrbitDistance = currentPlanetOrbitDistance;

    const orbitalAngle = getRandomInRange(0, 2 * Math.PI); // Radians

    const planetX = currentPlanetOrbitDistance * Math.cos(orbitalAngle);
    const planetZ = currentPlanetOrbitDistance * Math.sin(orbitalAngle);

    const orbitalSpeed = calculateOrbitalVelocityMagnitude(starMass, currentPlanetOrbitDistance);
    const velocityX = -orbitalSpeed * Math.sin(orbitalAngle);
    const velocityZ = orbitalSpeed * Math.cos(orbitalAngle);
    
    const planetNameSuffix = PLANET_SUFFIXES[i % PLANET_SUFFIXES.length] || `P${i+1}`;
    const planetName = `${systemName} ${planetNameSuffix}${hasLife ? " (Bio)" : ""}`;

    const planet: SceneObject = {
      id: `planet_${systemName.toLowerCase().replace(/\s+/g, '_')}_${planetNameSuffix}_${Date.now()}`,
      type: 'orbiter',
      name: planetName,
      mass: planetMass,
      radius: planetRadius,
      color: planetColor,
      position: { x: planetX, y: 0, z: planetZ },
      velocity: { x: velocityX, y: 0, z: velocityZ },
      hasLife: hasLife,
    };
    objects.push(planet);

    // 3. Generate Moons for this Planet
    const numMoons = planetMass > 200 ? getRandomIntInRange(MOON_COUNT_MIN, MOON_COUNT_MAX) : getRandomIntInRange(0,1) ; // More massive planets more likely to have moons
    let lastMoonOrbitDistance = planetRadius * MOON_MIN_ORBIT_DIST_FROM_PLANET_FACTOR;

    if (planetMass > 30) { 
        for (let j = 0; j < numMoons; j++) {
            const moonMass = Math.max(0.1, getRandomInRange(planetMass * MOON_MASS_MIN_FACTOR, planetMass * MOON_MASS_MAX_FACTOR));
            const moonRadius = Math.max(0.3, Math.pow(moonMass, 1/3) * MOON_RADIUS_FACTOR);
            const moonColor = `hsl(${getRandomInRange(0,360)}, ${getRandomInRange(0,10)}%, ${getRandomInRange(30,70)}%)`; // Muted/Grayish colors

            const moonOrbitSpacingFactor = getRandomInRange(MOON_ORBIT_SPACING_MIN_FACTOR, MOON_ORBIT_SPACING_MAX_FACTOR);
            const currentMoonOrbitDistance = lastMoonOrbitDistance * moonOrbitSpacingFactor + moonRadius * 2;
            lastMoonOrbitDistance = currentMoonOrbitDistance;
            
            const moonOrbitalAngle = getRandomInRange(0, 2 * Math.PI);

            const moonRelativeX = currentMoonOrbitDistance * Math.cos(moonOrbitalAngle);
            const moonRelativeZ = currentMoonOrbitDistance * Math.sin(moonOrbitalAngle);

            const moonOrbitalSpeed = calculateOrbitalVelocityMagnitude(planetMass, currentMoonOrbitDistance);
            const moonRelativeVelX = -moonOrbitalSpeed * Math.sin(moonOrbitalAngle);
            const moonRelativeVelZ = moonOrbitalSpeed * Math.cos(moonOrbitalAngle);

            const moon: SceneObject = {
                id: `moon_${planet.id}_${j}_${Date.now()}_${Math.random().toString(36).substring(2,5)}`,
                type: 'orbiter',
                name: `${planet.name} ${String.fromCharCode(97 + j)}`, 
                mass: moonMass,
                radius: moonRadius,
                color: moonColor,
                position: { 
                    x: planet.position.x + moonRelativeX, 
                    y: planet.position.y, 
                    z: planet.position.z + moonRelativeZ 
                },
                velocity: { 
                    x: planet.velocity.x + moonRelativeVelX, 
                    y: planet.velocity.y, 
                    z: planet.velocity.z + moonRelativeVelZ
                },
            };
            objects.push(moon);
        }
    }
  }
  return objects;
}
