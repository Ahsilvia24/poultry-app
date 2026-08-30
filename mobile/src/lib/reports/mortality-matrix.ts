export type MortalityReportMatrix = {
  dates: string[];
  rows: Array<{ houseLabel: string; byDate: Record<string, number> }>;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMortalityReportDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${MONTHS[m - 1]} ${d}`;
}

export function mortalityMatrixHasData(matrix: MortalityReportMatrix): boolean {
  return matrix.rows.length > 0 && matrix.dates.length > 0;
}

export function mortalityMatrixToTable(
  matrix: MortalityReportMatrix,
  rowHeaderLabel: string,
): { headers: string[]; rows: Array<Array<string | number>> } {
  const headers = [
    rowHeaderLabel,
    ...matrix.dates.map(formatMortalityReportDate),
    "Tot",
  ];
  const rows = matrix.rows.map((row) => {
    const values = matrix.dates.map((d) => row.byDate[d] ?? 0);
    const total = values.reduce((sum, n) => sum + n, 0);
    return [row.houseLabel, ...values, total];
  });
  return { headers, rows };
}
