import { format, parseISO } from "date-fns";
import { DeleteFlockButton, ReactivateFlockButton } from "@/components/FarmOpsForms";
import { Card } from "@/components/ui";
import { formatNumber, formatPct } from "@/lib/utils";
import type { ReplicaHistoryRow } from "@/lib/offline/selectReports";

function avg(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-stone-500">{label}</p>
      <p className="font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function FlockMetrics({ row }: { row: ReplicaHistoryRow }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
      <Metric label="Placement" value={format(parseISO(row.placementDate), "MMM d, yyyy")} />
      <Metric label="Catch" value={row.catchDate ? format(parseISO(row.catchDate), "MMM d, yyyy") : "—"} />
      <Metric label="Market age (days)" value={row.marketAge ?? "—"} />
      <Metric label="Birds" value={formatNumber(row.placed)} />
      <Metric label="Mortality %" value={formatPct(row.mortPct)} />
      <Metric label="Livability %" value={row.livability != null ? formatPct(row.livability) : "—"} />
      <Metric label="Avg weight" value={row.weight != null ? row.weight.toFixed(2) : "—"} />
      <Metric label="FCR" value={row.fcr != null ? row.fcr.toFixed(3) : "—"} />
      <Metric label="Feed (lbs)" value={formatNumber(row.feedLbs)} />
      <Metric
        label="Condemnation %"
        value={row.condemnation != null ? formatPct(row.condemnation) : "—"}
      />
      <Metric
        label="Last cleanout before placement"
        value={row.lastCleanout ? format(parseISO(row.lastCleanout), "MMM d, yyyy") : "—"}
      />
      <Metric label="Status" value={row.flockStatus} />
    </div>
  );
}

export function FarmHistoryReplica({ rows }: { rows: ReplicaHistoryRow[] }) {
  const current = rows.find((row) => row.flockStatus === "ACTIVE") ?? rows[0] ?? null;
  const previousThree = rows
    .filter((row) => row.flockId !== current?.flockId && row.flockStatus !== "ACTIVE")
    .slice(0, 3);

  return (
    <div>
      {current ? (
        <Card className="mb-6">
          <h2 className="text-lg font-bold">
            {current.flockStatus === "ACTIVE" ? "Current flock" : "Latest flock"} —{" "}
            {current.flockNumber}
          </h2>
          <FlockMetrics row={current} />
          {current.flockStatus !== "ACTIVE" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ReactivateFlockButton flockId={current.flockId} flockNumber={current.flockNumber} />
              <DeleteFlockButton flockId={current.flockId} flockNumber={current.flockNumber} />
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="mb-6">
          <p className="text-stone-600">No flocks recorded for this farm.</p>
        </Card>
      )}

      <h2 className="text-xl font-bold">Previous 3 Flocks</h2>
      {previousThree.length === 0 ? (
        <Card className="mt-3">
          <p className="text-stone-600">No completed previous flocks to compare.</p>
        </Card>
      ) : (
        <div className="mt-3 space-y-4">
          {previousThree.map((row) => (
            <Card key={row.flockId}>
              <h3 className="font-bold">Flock {row.flockNumber}</h3>
              <FlockMetrics row={row} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ReactivateFlockButton flockId={row.flockId} flockNumber={row.flockNumber} />
                <DeleteFlockButton flockId={row.flockId} flockNumber={row.flockNumber} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {current && previousThree.length > 0 ? (
        <Card className="mt-6">
          <h2 className="text-lg font-bold">Comparison Notes</h2>
          <div className="mt-3 space-y-3 text-sm text-stone-700">
            <p>
              Farm total mortality for current flock is{" "}
              <span className="font-semibold">{formatPct(current.mortPct)}</span>
              {" vs previous flock average of "}
              <span className="font-semibold">
                {formatPct(avg(previousThree.map((p) => p.mortPct)) ?? 0)}
              </span>
              .
            </p>
            <p>
              Livability current{" "}
              <span className="font-semibold">
                {current.livability != null ? formatPct(current.livability) : "—"}
              </span>
              {" · prior avg "}
              <span className="font-semibold">
                {formatPct(avg(previousThree.map((p) => p.livability)) ?? 0)}
              </span>
              .
            </p>
          </div>
        </Card>
      ) : null}

      <h2 className="mt-8 text-xl font-bold">All Flocks</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-100 text-stone-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Flock</th>
              <th className="px-3 py-2 font-semibold">Placement</th>
              <th className="px-3 py-2 font-semibold">Catch</th>
              <th className="px-3 py-2 font-semibold">Age</th>
              <th className="px-3 py-2 font-semibold">Birds</th>
              <th className="px-3 py-2 font-semibold">Mort %</th>
              <th className="px-3 py-2 font-semibold">Livability</th>
              <th className="px-3 py-2 font-semibold">Feed lbs</th>
              <th className="px-3 py-2 font-semibold">Last cleanout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.flockId} className="border-t border-stone-100">
                <td className="px-3 py-2 font-semibold">{row.flockNumber}</td>
                <td className="px-3 py-2">{row.placementDate}</td>
                <td className="px-3 py-2">{row.catchDate ?? "—"}</td>
                <td className="px-3 py-2">{row.marketAge ?? "—"}</td>
                <td className="px-3 py-2">{formatNumber(row.placed)}</td>
                <td className="px-3 py-2">{formatPct(row.mortPct)}</td>
                <td className="px-3 py-2">
                  {row.livability != null ? formatPct(row.livability) : "—"}
                </td>
                <td className="px-3 py-2">{formatNumber(row.feedLbs)}</td>
                <td className="px-3 py-2">{row.lastCleanout ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
