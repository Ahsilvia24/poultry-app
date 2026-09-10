export type FeedMillHouse = {
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
  orderLbs: number | null;
  reclaimLbs: number | null;
};

function formatCount(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

function formatBinLine(houseNumber: number, side: "a" | "b", pounds: number): string {
  const amount = !Number.isFinite(pounds) || pounds <= 0 ? "empty" : `${formatCount(pounds)} lbs`;
  return `H${houseNumber}${side}- ${amount}`;
}

/** Clipboard text for the Feed Mill Data button on a saved LFO. */
export function formatFeedMillData(houses: FeedMillHouse[]): string {
  const sorted = [...houses].sort((a, b) => a.houseNumber - b.houseNumber);
  const lines = ["Current Inventory"];
  for (const house of sorted) {
    lines.push(formatBinLine(house.houseNumber, "a", house.binAPounds));
    lines.push(formatBinLine(house.houseNumber, "b", house.binBPounds));
  }
  lines.push("LFO");
  for (const house of sorted) {
    const order = house.orderLbs ?? 0;
    const reclaim = house.reclaimLbs ?? 0;
    if (order > 0) {
      lines.push(`H${house.houseNumber}- ${formatCount(order)} lbs`);
    } else if (reclaim > 0) {
      lines.push(`H${house.houseNumber}- ${formatCount(reclaim)} reclaim`);
    }
  }
  return lines.join("\n");
}
