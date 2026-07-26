export type LightingProgramRow = {
  ageLabel: string;
  hoursLight: number;
  hoursDark: number;
  centerLights: "on" | "off";
  intensity: string;
};

/** Big Bird lighting program by bird age. */
export const BIG_BIRD_LIGHTING_PROGRAM: LightingProgramRow[] = [
  {
    ageLabel: "1–7",
    hoursLight: 24,
    hoursDark: 0,
    centerLights: "on",
    intensity: "Full",
  },
  {
    ageLabel: "8–21",
    hoursLight: 20,
    hoursDark: 4,
    centerLights: "off",
    intensity: "Full",
  },
  { ageLabel: "22", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: "1 fc" },
  { ageLabel: "23", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: ".75 fc" },
  { ageLabel: "24", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: ".50 fc" },
  { ageLabel: "28", hoursLight: 18, hoursDark: 6, centerLights: "off", intensity: ".25 fc" },
  { ageLabel: "42", hoursLight: 20, hoursDark: 4, centerLights: "off", intensity: ".25 fc" },
  {
    ageLabel: "Day before kill",
    hoursLight: 24,
    hoursDark: 0,
    centerLights: "off",
    intensity: "Full",
  },
];
