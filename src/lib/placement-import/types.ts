/** Core fields: farmName, houseNo, datePlaced, numberSent, farmCode (code left of name). */
export type PlacementRow = {
  datePlaced: string; // YYYY-MM-DD
  farmCode: string;
  farmName: string;
  flockId: string;
  houseNo: number;
  numberSent: number;
};

export type PlacementFarmGroup = {
  key: string;
  farmCode: string;
  farmName: string;
  rowCount: number;
  houseNumbers: number[];
  flockIds: string[];
};

export type ExistingFarmRef = {
  id: string;
  farmName: string;
  farmNumber: string | null;
};

export type FarmMatchKind = "exact" | "code" | "fuzzy" | "none";

export type PlacementFarmMatch = {
  kind: FarmMatchKind;
  farm: ExistingFarmRef | null;
  /** True when names differ but we think it's the same farm. */
  nameDiffers: boolean;
};

export type PlacementFarmPreview = PlacementFarmGroup & {
  match: PlacementFarmMatch;
  isMyFarm: boolean;
};
