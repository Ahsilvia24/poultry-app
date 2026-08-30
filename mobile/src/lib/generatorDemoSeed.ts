/** Weekly exercise increments used by the (now sample-farm-only) generator seed. */
export const GENERATOR_EXERCISE_HOURS = [0.8, 0.9, 1.0, 1.1] as const;
export const GENERATOR_DEMO_WEEKS = 6;

/** Sample farms that may keep seeded hour-meter history. Never treat user farms as these. */
export const DEMO_GENERATOR_FARM_NAMES = new Set([
  "Oak Hollow",
  "Ash Grove",
  "Willow Bend",
  "Cedar Creek",
  "Pine Ridge",
  "Maple Grove",
  "Bay View",
  "Sunrise Farms",
  "River Bend",
  "Triple Place",
  "Triple Place Demo",
]);

export type DemoGeneratorHours = [
  number | null,
  number | null,
  number | null,
  number | null,
];

export function isDemoGeneratorFarmName(name: string): boolean {
  return DEMO_GENERATOR_FARM_NAMES.has(name.trim());
}

export function farmNameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % 80;
  }
  return hash;
}

export function generatorDemoReading(
  baseHours: number,
  genIndex: number,
  weekFromOldest: number,
): number {
  let reading = baseHours + genIndex * 18;
  for (let i = 0; i < weekFromOldest; i++) {
    reading =
      Math.round((reading + GENERATOR_EXERCISE_HOURS[(i + genIndex) % 4]) * 10) / 10;
  }
  return reading;
}

export function seededDemoHoursForWeek(
  farmName: string,
  genCount: number,
  weekFromOldest: number,
): DemoGeneratorHours {
  const baseHours = 90 + farmNameHash(farmName);
  const hours: DemoGeneratorHours = [null, null, null, null];
  const count = Math.max(0, Math.min(4, genCount));
  for (let g = 0; g < count; g++) {
    hours[g] = generatorDemoReading(baseHours, g, weekFromOldest);
  }
  return hours;
}
