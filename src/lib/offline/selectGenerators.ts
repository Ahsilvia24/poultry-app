import type { OfflineSnapshot } from "@/lib/offline/types";

export type GeneratorLogRow = {
  id: string;
  logDate: string;
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

export type GeneratorsPageModel = {
  farmId: string;
  farmName: string;
  logs: GeneratorLogRow[];
};

export function selectGenerators(
  snapshot: OfflineSnapshot,
  farmId: string,
): GeneratorsPageModel | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const logs = (snapshot.generatorLogs ?? [])
    .filter((row) => row.farmId === farmId)
    .slice()
    .sort((a, b) => {
      const date = b.logDate.slice(0, 10).localeCompare(a.logDate.slice(0, 10));
      if (date !== 0) return date;
      return b.id.localeCompare(a.id);
    })
    .map((row) => ({
      id: row.id,
      logDate: row.logDate.slice(0, 10),
      gen1Hours: row.gen1Hours,
      gen2Hours: row.gen2Hours,
      gen3Hours: row.gen3Hours,
      gen4Hours: row.gen4Hours,
    }));
  return { farmId: farm.id, farmName: farm.farmName, logs };
}
