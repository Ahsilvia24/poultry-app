import type { ExistingFarmRef, FarmMatchKind, PlacementFarmMatch } from "@/lib/placement-import/types";

export type CatchRow = {
  catchDate: string; // YYYY-MM-DD
  farmCode: string;
  farmName: string;
  flockId: string;
  houseNo: number;
  /** Optional head count / birds to catch when present in the file. */
  headCount: number | null;
};

export type CatchFarmGroup = {
  key: string;
  farmCode: string;
  farmName: string;
  rowCount: number;
  houseNumbers: number[];
  flockIds: string[];
  catchDates: string[];
};

export type CatchFarmPreview = CatchFarmGroup & {
  match: PlacementFarmMatch;
  isMyFarm: boolean;
};

export type { ExistingFarmRef, FarmMatchKind, PlacementFarmMatch };
