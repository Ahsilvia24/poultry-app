import type { PlacementFarmMatch } from "@/lib/placement-import/types";

export type CatchRow = {
  /** Ending kill / catch date as yyyy-MM-dd */
  catchDate: string;
  farmName: string;
  houseNo: number;
  /** Optional Farm-Entity / farm code from the sheet — used only for matching. */
  farmCode?: string | null;
};

export type CatchFarmGroup = {
  key: string;
  farmName: string;
  farmCode: string | null;
  rowCount: number;
  houseNumbers: number[];
  catchDates: string[];
};

export type CatchFarmPreview = CatchFarmGroup & {
  match: PlacementFarmMatch;
  isMyFarm: boolean;
};
