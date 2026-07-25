"use client";

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
import { downloadMortalityPdf } from "@/lib/exports/pdf";
import { MORTALITY_CAUSE_LABELS, formatNumber, formatPct } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

export type CumulativePoint = { birdAgeInDays: number; cumulative: number; label?: string };
export type HouseBarPoint = { houseLabel: string; mortality: number; culls: number; total: number };
export type CauseRow = { cause: string; count: number; pct: number };
export type FarmRow = {
  farmName: string;
  placed: number;
  mortality: number;
  culls: number;
  total: number;
  pct: number;
};

export function MortalityCharts({
  cumulativeByAge,
  byHouse,
  byCause,
  byFarm,
  filterLabel,
}: {
  cumulativeByAge: CumulativePoint[];
  byHouse: HouseBarPoint[];
  byCause: CauseRow[];
  byFarm: FarmRow[];
  filterLabel: string;
}) {
  function exportCsv() {
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
                <XAxis dataKey="birdAgeInDays" label={{ value: "Bird age (days)", position: "insideBottom", offset: -2 }} />
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
