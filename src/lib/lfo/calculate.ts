/** Inputs for last-feed-order math (formula TBD). */
export type LfoHouseInventoryInput = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
};

export type LfoCalculateInput = {
  orderDate: string;
  houses: LfoHouseInventoryInput[];
};

/** Result shape — fill in when the LFO formula is provided. */
export type LfoCalculateResult = {
  /** Placeholder until formula is wired. */
  ready: false;
};

/**
 * Last feed order calculation.
 * Stub: returns not-ready until the feed-order formula is supplied.
 */
export function calculateLastFeedOrder(_input: LfoCalculateInput): LfoCalculateResult {
  return { ready: false };
}
