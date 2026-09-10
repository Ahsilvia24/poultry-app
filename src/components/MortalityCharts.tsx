"use client";

import { CopyShareRow } from "@/components/CopyShareIcons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { downloadCsv, toCsv } from "@/lib/exports/csv";
import { downloadMortalityPdf, downloadReportPdf } from "@/lib/exports/pdf";
import {
  mortalityMatrixHasData,
  mortalityMatrixToTable,
} from "@/lib/reports/mortality-matrix";
import { MORTALITY_CAUSE_LABELS, formatNumber, formatPct } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

export type CumulativePoint = { birdAgeInDays: number; cumulative: number; label?: string };
export type HouseBarPoint = { houseLabel: string; mortality: number; culls: number; total: number };
export type HouseByDateMatrix = {
  dates: string[];
  rows: Array<{ houseLabel: string; byDate: Record<string, number> }>;
};
export type CauseRow = { cause: string; count: number; pct: number };
export type FarmRow = {
  farmName: string;
  placed: number;
  mortality: number;
  culls: number;
  total: number;
  pct: number;
};

function formatDateHeader(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MortalityCharts({
  cumulativeByAge,
  byHouse,
  byHouseByDate,
  byCause,
  byFarm,
  filterLabel,
}: {
  cumulativeByAge: CumulativePoint[];
  byHouse: HouseBarPoint[];
  byHouseByDate: HouseByDateMatrix;
  byCause: CauseRow[];
  byFarm: FarmRow[];
  filterLabel: string;
}) {
  function houseByDateTsv() {
    const header = ["House", ...byHouseByDate.dates.map(formatDateHeader), "Total"];
    const lines = byHouseByDate.rows.map((row) => {
      const values = byHouseByDate.dates.map((d) => row.byDate[d] ?? 0);
      const total = values.reduce((sum, n) => sum + n, 0);
      return [row.houseLabel, ...values, total].join("\t");
    });
    return [header.join("\t"), ...lines].join("\n");
  }

  function shareHouseByDatePdf() {
    if (!mortalityMatrixHasData(byHouseByDate)) return;
    const table = mortalityMatrixToTable(byHouseByDate, "House");
    downloadReportPdf({
      title: "Mortality",
      subtitle: filterLabel,
      filename: `mortality-report-${Date.now()}.pdf`,
      orientation: "landscape",
      blocks: [
        {
          type: "table",
          headers: table.headers,
          rows: table.rows,
        },
      ],
    });
  }

  async function copyHouseByDate() {
    if (byHouseByDate.rows.length === 0 || byHouseByDate.dates.length === 0) return;
    await navigator.clipboard.writeText(houseByDateTsv());
  }

  function exportCsv() {
    const houseDateHeaders = ["House", ...byHouseByDate.dates, "Total"];
    const houseDateRows = byHouseByDate.rows.map((row) => {
      const values = byHouseByDate.dates.map((d) => row.byDate[d] ?? 0);
      const total = values.reduce((sum, n) => sum + n, 0);
      return [row.houseLabel, ...values, total];
    });

    const csv = [
      toCsv(
        ["Bird age (days)", "Cumulative mortality"],
        cumulativeByAge.map((p) => [p.birdAgeInDays, p.cumulative]),
      ),
      "",
      toCsv(
        ["House", "Mortality", "Culls", "Total"],
        byHouse.map((h) => [h.houseLabel, h.mortality, h.culls, h.total]),
      ),
      "",
      toCsv(houseDateHeaders, houseDateRows),
      "",
      toCsv(
        ["Cause", "Count", "Pct"],
        byCause.map((c) => [MORTALITY_CAUSE_LABELS[c.cause] ?? c.cause, c.count, c.pct.toFixed(2)]),
      ),
      "",
      toCsv(
        ["Farm", "Placed", "Mortality", "Culls", "Total", "Pct"],
        byFarm.map((f) => [f.farmName, f.placed, f.mortality, f.culls, f.total, f.pct.toFixed(2)]),
      ),
    ].join("\n");
    downloadCsv(`mortality-report-${Date.now()}.csv`, csv);
  }

  function exportPdf() {
    downloadMortalityPdf({
      title: "Mortality report",
      subtitle: filterLabel,
      filename: `mortality-report-${Date.now()}.pdf`,
      sections: [
        {
          title: "Cumulative by bird age",
          headers: ["Age (days)", "Cumulative"],
          rows: cumulativeByAge.map((p) => [p.birdAgeInDays, p.cumulative]),
        },
        {
          title: "By house",
          headers: ["House", "Mortality", "Culls", "Total"],
          rows: byHouse.map((h) => [h.houseLabel, h.mortality, h.culls, h.total]),
        },
        {
          title: "By house and date",
          headers: ["House", ...byHouseByDate.dates.map(formatDateHeader), "Total"],
          rows: byHouseByDate.rows.map((row) => {
            const values = byHouseByDate.dates.map((d) => row.byDate[d] ?? 0);
            const total = values.reduce((sum, n) => sum + n, 0);
            return [row.houseLabel, ...values, total];
          }),
        },
        {
          title: "By cause",
          headers: ["Cause", "Count", "%"],
          rows: byCause.map((c) => [
            MORTALITY_CAUSE_LABELS[c.cause] ?? c.cause,
            c.count,
            c.pct.toFixed(2),
          ]),
        },
        {
          title: "By farm",
          headers: ["Farm", "Placed", "Mortality", "Culls", "Total", "%"],
          rows: byFarm.map((f) => [
            f.farmName,
            f.placed,
            f.mortality,
            f.culls,
            f.total,
            f.pct.toFixed(2),
          ]),
        },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={exportCsv}>
          Export CSV
        </Button>
        <Button type="button" variant="secondary" onClick={exportPdf}>
          Export PDF
        </Button>
      </div>

      <Card>
        <h3 className="font-bold">Cumulative mortality by bird age</h3>
        <div className="mt-4 h-72 w-full">
          {cumulativeByAge.length === 0 ? (
            <p className="text-sm text-stone-500">No data for current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeByAge}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis
                  dataKey="birdAgeInDays"
                  label={{ value: "Bird age (days)", position: "insideBottom", offset: -2 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative loss"
                  stroke="#047857"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-bold">Mortality by house and date</h3>
            <p className="mt-1 text-sm text-stone-500">
              Total daily loss (mortality + culls) for the selected date range.
            </p>
          </div>
          <CopyShareRow
            onCopy={() => void copyHouseByDate()}
            onShare={shareHouseByDatePdf}
            copyDisabled={byHouseByDate.rows.length === 0 || byHouseByDate.dates.length === 0}
            shareDisabled={!mortalityMatrixHasData(byHouseByDate)}
            copyLabel="Copy mortality report"
            shareLabel="Share mortality report PDF"
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          {byHouseByDate.rows.length === 0 || byHouseByDate.dates.length === 0 ? (
            <p className="text-sm text-stone-500">No data for current filters.</p>
          ) : (
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold">House</th>
                  {byHouseByDate.dates.map((d) => (
                    <th
                      key={d}
                      className="whitespace-nowrap px-2 py-2 text-center font-semibold tabular-nums"
                    >
                      {formatDateHeader(d)}
                    </th>
                  ))}
                  <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {byHouseByDate.rows.map((row) => {
                  const total = byHouseByDate.dates.reduce(
                    (sum, d) => sum + (row.byDate[d] ?? 0),
                    0,
                  );
                  return (
                    <tr key={row.houseLabel} className="border-t border-stone-100">
                      <td className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold text-stone-900">
                        {row.houseLabel}
                      </td>
                      {byHouseByDate.dates.map((d) => {
                        const n = row.byDate[d] ?? 0;
                        return (
                          <td
                            key={d}
                            className={`px-2 py-2 text-center tabular-nums ${
                              n > 0 ? "font-semibold text-stone-900" : "text-stone-300"
                            }`}
                          >
                            {n}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-stone-900">
                        {formatNumber(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="font-bold">Mortality by house</h3>
        <div className="mt-4 h-72 w-full">
          {byHouse.length === 0 ? (
            <p className="text-sm text-stone-500">No data for current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byHouse}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="houseLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="mortality" name="Mortality" stackId="a" fill="#047857" />
                <Bar dataKey="culls" name="Culls" stackId="a" fill="#a8a29e" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="font-bold">By cause</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-stone-500">
                <tr>
                  <th className="py-1 pr-3 font-semibold">Cause</th>
                  <th className="py-1 pr-3 font-semibold">Count</th>
                  <th className="py-1 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {byCause.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 text-stone-500">
                      No data
                    </td>
                  </tr>
                ) : null}
                {byCause.map((c) => (
                  <tr key={c.cause} className="border-t border-stone-100">
                    <td className="py-2 pr-3">{MORTALITY_CAUSE_LABELS[c.cause] ?? c.cause}</td>
                    <td className="py-2 pr-3">{formatNumber(c.count)}</td>
                    <td className="py-2">{formatPct(c.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="font-bold">By farm</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-stone-500">
                <tr>
                  <th className="py-1 pr-3 font-semibold">Farm</th>
                  <th className="py-1 pr-3 font-semibold">Placed</th>
                  <th className="py-1 pr-3 font-semibold">Total</th>
                  <th className="py-1 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {byFarm.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 text-stone-500">
                      No data
                    </td>
                  </tr>
                ) : null}
                {byFarm.map((f) => (
                  <tr key={f.farmName} className="border-t border-stone-100">
                    <td className="py-2 pr-3 font-semibold">{f.farmName}</td>
                    <td className="py-2 pr-3">{formatNumber(f.placed)}</td>
                    <td className="py-2 pr-3">{formatNumber(f.total)}</td>
                    <td className="py-2">{formatPct(f.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
