"use client";

import type { ReactNode } from "react";
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
import { formatNumber, formatPct } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

export type CumulativePoint = { birdAgeInDays: number; cumulative: number; label?: string };
export type HouseBarPoint = { houseLabel: string; mortality: number; culls: number; total: number };
export type HouseByDateMatrix = {
  dates: string[];
  rows: Array<{ houseLabel: string; byDate: Record<string, number> }>;
};
export type FarmRow = {
  farmName: string;
  kind?: "farm" | "house";
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

function TileHeader({
  title,
  extra,
  onCopy,
  onShare,
  copyDisabled,
  shareDisabled,
  copyLabel,
  shareLabel,
}: {
  title: string;
  extra?: ReactNode;
  onCopy: () => void;
  onShare: () => void;
  copyDisabled?: boolean;
  shareDisabled?: boolean;
  copyLabel: string;
  shareLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="font-bold">{title}</h3>
        {extra}
      </div>
      <CopyShareRow
        onCopy={onCopy}
        onShare={onShare}
        copyDisabled={copyDisabled}
        shareDisabled={shareDisabled}
        copyLabel={copyLabel}
        shareLabel={shareLabel}
      />
    </div>
  );
}

export function MortalityCharts({
  cumulativeByAge,
  byHouse,
  byHouseByDate,
  byFarm,
  displayCumulativeByAge,
  displayByHouse,
  displayByHouseByDate,
  allFarms = false,
  displayFarmName,
  filterLabel,
}: {
  cumulativeByAge: CumulativePoint[];
  byHouse: HouseBarPoint[];
  byHouseByDate: HouseByDateMatrix;
  byFarm: FarmRow[];
  displayCumulativeByAge?: CumulativePoint[];
  displayByHouse?: HouseBarPoint[];
  displayByHouseByDate?: HouseByDateMatrix;
  allFarms?: boolean;
  displayFarmName?: string | null;
  filterLabel: string;
}) {
  const shownCumulative = displayCumulativeByAge ?? cumulativeByAge;
  const shownByHouse = displayByHouse ?? byHouse;
  const shownByDate = displayByHouseByDate ?? byHouseByDate;
  const entityHeader = allFarms ? "Farm" : "House";

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
      title: "Mortality by Date",
      subtitle: filterLabel,
      filename: `mortality-by-date-${Date.now()}.pdf`,
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

  async function copyPercentage() {
    if (byFarm.length === 0) return;
    const header = [entityHeader, "Placed", "Mortality", "Culls", "Total", "%"].join("\t");
    const lines = byFarm.map((f) =>
      [f.farmName, f.placed, f.mortality, f.culls, f.total, f.pct.toFixed(2)].join("\t"),
    );
    await navigator.clipboard.writeText([header, ...lines].join("\n"));
  }

  function sharePercentagePdf() {
    if (byFarm.length === 0) return;
    downloadReportPdf({
      title: "Mortality by Percentage",
      subtitle: filterLabel,
      filename: `mortality-by-percentage-${Date.now()}.pdf`,
      blocks: [
        {
          type: "table",
          headers: [entityHeader, "Placed", "Mortality", "Culls", "Total", "%"],
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

  async function copyByHouse() {
    if (byHouse.length === 0) return;
    const header = ["House", "Mortality", "Culls", "Total"].join("\t");
    const lines = byHouse.map((h) => [h.houseLabel, h.mortality, h.culls, h.total].join("\t"));
    await navigator.clipboard.writeText([header, ...lines].join("\n"));
  }

  function shareByHousePdf() {
    if (byHouse.length === 0) return;
    downloadReportPdf({
      title: "Mortality by House",
      subtitle: filterLabel,
      filename: `mortality-by-house-${Date.now()}.pdf`,
      blocks: [
        {
          type: "table",
          headers: ["House", "Mortality", "Culls", "Total"],
          rows: byHouse.map((h) => [h.houseLabel, h.mortality, h.culls, h.total]),
        },
      ],
    });
  }

  async function copyCumulative() {
    if (cumulativeByAge.length === 0) return;
    const header = ["Bird age (days)", "Cumulative mortality"].join("\t");
    const lines = cumulativeByAge.map((p) => [p.birdAgeInDays, p.cumulative].join("\t"));
    await navigator.clipboard.writeText([header, ...lines].join("\n"));
  }

  function shareCumulativePdf() {
    if (cumulativeByAge.length === 0) return;
    downloadReportPdf({
      title: "Cumulative Mortality by Bird Age",
      subtitle: filterLabel,
      filename: `mortality-by-age-${Date.now()}.pdf`,
      blocks: [
        {
          type: "table",
          headers: ["Age (days)", "Cumulative"],
          rows: cumulativeByAge.map((p) => [p.birdAgeInDays, p.cumulative]),
        },
      ],
    });
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
        [entityHeader, "Placed", "Mortality", "Culls", "Total", "Pct"],
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
          title: "Mortality by Percentage",
          headers: [entityHeader, "Placed", "Mortality", "Culls", "Total", "%"],
          rows: byFarm.map((f) => [
            f.farmName,
            f.placed,
            f.mortality,
            f.culls,
            f.total,
            f.pct.toFixed(2),
          ]),
        },
        {
          title: "Mortality by Date",
          headers: ["House", ...byHouseByDate.dates.map(formatDateHeader), "Total"],
          rows: byHouseByDate.rows.map((row) => {
            const values = byHouseByDate.dates.map((d) => row.byDate[d] ?? 0);
            const total = values.reduce((sum, n) => sum + n, 0);
            return [row.houseLabel, ...values, total];
          }),
        },
        {
          title: "Mortality by House",
          headers: ["House", "Mortality", "Culls", "Total"],
          rows: byHouse.map((h) => [h.houseLabel, h.mortality, h.culls, h.total]),
        },
        {
          title: "Cumulative Mortality by Bird Age",
          headers: ["Age (days)", "Cumulative"],
          rows: cumulativeByAge.map((p) => [p.birdAgeInDays, p.cumulative]),
        },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <TileHeader
          title="Mortality by Percentage"
          onCopy={() => void copyPercentage()}
          onShare={sharePercentagePdf}
          copyDisabled={byFarm.length === 0}
          shareDisabled={byFarm.length === 0}
          copyLabel="Copy mortality by percentage"
          shareLabel="Share mortality by percentage PDF"
        />
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="py-1 pr-3 font-semibold">{entityHeader}</th>
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
              {byFarm.map((f, index) => (
                <tr key={`${f.kind ?? "farm"}-${f.farmName}-${index}`} className="border-t border-stone-100">
                  <td
                    className={`py-2 pr-3 ${
                      f.kind === "house" ? "pl-4 font-medium text-stone-700" : "font-semibold"
                    }`}
                  >
                    {f.farmName}
                  </td>
                  <td className="py-2 pr-3">{formatNumber(f.placed)}</td>
                  <td className="py-2 pr-3">{formatNumber(f.total)}</td>
                  <td className="py-2">{formatPct(f.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <TileHeader
          title="Mortality by Date"
          onCopy={() => void copyHouseByDate()}
          onShare={shareHouseByDatePdf}
          copyDisabled={byHouseByDate.rows.length === 0 || byHouseByDate.dates.length === 0}
          shareDisabled={!mortalityMatrixHasData(byHouseByDate)}
          copyLabel="Copy mortality by date"
          shareLabel="Share mortality by date PDF"
        />
        <div className="mt-3 overflow-x-auto">
          {shownByDate.rows.length === 0 || shownByDate.dates.length === 0 ? (
            <p className="text-sm text-stone-500">No data for current filters.</p>
          ) : (
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold">House</th>
                  {shownByDate.dates.map((d) => (
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
                {shownByDate.rows.map((row) => {
                  const total = shownByDate.dates.reduce(
                    (sum, d) => sum + (row.byDate[d] ?? 0),
                    0,
                  );
                  return (
                    <tr key={row.houseLabel} className="border-t border-stone-100">
                      <td className="sticky left-0 z-10 bg-white py-2 pr-3 font-semibold text-stone-900">
                        {row.houseLabel}
                      </td>
                      {shownByDate.dates.map((d) => {
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
        <TileHeader
          title="Mortality by House"
          onCopy={() => void copyByHouse()}
          onShare={shareByHousePdf}
          copyDisabled={byHouse.length === 0}
          shareDisabled={byHouse.length === 0}
          copyLabel="Copy mortality by house"
          shareLabel="Share mortality by house PDF"
        />
        <div className="mt-4 h-72 w-full">
          {shownByHouse.length === 0 ? (
            <p className="text-sm text-stone-500">No data for current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shownByHouse}>
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

      <Card>
        <TileHeader
          title="Cumulative Mortality by Bird Age"
          extra={
            displayFarmName ? (
              <p className="mt-1 text-sm font-semibold text-stone-800">{displayFarmName}</p>
            ) : null
          }
          onCopy={() => void copyCumulative()}
          onShare={shareCumulativePdf}
          copyDisabled={cumulativeByAge.length === 0}
          shareDisabled={cumulativeByAge.length === 0}
          copyLabel="Copy cumulative mortality"
          shareLabel="Share cumulative mortality PDF"
        />
        <div className="mt-4 h-72 w-full">
          {shownCumulative.length === 0 ? (
            <p className="text-sm text-stone-500">No data for current filters.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={shownCumulative}>
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

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={exportCsv}>
          Export CSV
        </Button>
        <Button type="button" variant="secondary" onClick={exportPdf}>
          Export PDF
        </Button>
      </div>
    </div>
  );
}
