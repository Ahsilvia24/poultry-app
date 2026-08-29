import {
  BIG_BIRD_COOL_CELLS,
  CHORE_TIME_COOL_PAD_SETTINGS,
  MIST_AND_COOL_CELLS,
  type CoolCellStage,
} from "@/lib/tools/cool-cells";

function formatDiff(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function CoolCellSettingsTable({
  rows,
  diffLabel,
}: {
  rows: CoolCellStage[];
  diffLabel: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-stone-100 text-stone-700">
          <tr>
            <th className="px-3 py-2 font-semibold">Day</th>
            <th className="w-[5.5rem] py-2 pl-0 pr-2.5 text-left font-semibold">{diffLabel}</th>
            <th className="py-2 pl-6 pr-3 font-semibold">On</th>
            <th className="px-3 py-2 font-semibold">Off</th>
            <th className="px-3 py-2 font-semibold">On temp</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const prev = rows[i - 1];
            const showDay = !prev || prev.day !== row.day;
            const groupStart = showDay;
            return (
              <tr
                key={`${row.day}-${row.diff}-${row.onSec}`}
                className={
                  groupStart && i > 0
                    ? "border-t-2 border-stone-200"
                    : "border-t border-stone-100"
                }
              >
                <td className="px-3 py-1.5 font-semibold text-stone-900">
                  {showDay ? row.day : ""}
                </td>
                <td className="px-2.5 py-1.5 font-medium tabular-nums text-stone-800">
                  {formatDiff(row.diff)}
                </td>
                <td className="py-1.5 pl-6 pr-3 tabular-nums text-stone-800">{row.onSec}</td>
                <td className="px-3 py-1.5 tabular-nums text-stone-800">{row.offSec}</td>
                <td className="px-3 py-1.5 font-medium tabular-nums text-stone-900">
                  {row.onTemp != null ? row.onTemp : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const scheduleNote =
  "All stages run 9:00 AM–10:00 PM and only operate cool cells up to 80% RH.";

export function CoolCellsChart() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800">Big Bird</p>
        <CoolCellSettingsTable rows={BIG_BIRD_COOL_CELLS} diffLabel="Temp diff" />
        <p className="text-xs text-stone-500">{scheduleNote}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800">Tunnel Diff Cool Cells</p>
        <CoolCellSettingsTable rows={MIST_AND_COOL_CELLS} diffLabel="Tunnel diff" />
        <p className="text-xs text-stone-500">{scheduleNote}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-stone-800">Chore Time</p>
        <p className="text-xs text-stone-500">Cool pad controller setpoints</p>
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {CHORE_TIME_COOL_PAD_SETTINGS.map((row) => (
                <tr key={row.label} className="border-t border-stone-100 first:border-0">
                  <td className="px-3 py-2 text-stone-700">{row.label}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-stone-900">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
