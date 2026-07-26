import {
  MAX_COOLING_APPARENT_TEMPS,
  MAX_COOLING_OUTSIDE_TEMPS_F,
  maxCoolingZone,
} from "@/lib/tools/max-cooling";
import { cn } from "@/lib/utils";

const zoneClass: Record<ReturnType<typeof maxCoolingZone>, string> = {
  normal: "bg-white text-stone-800",
  caution: "bg-amber-200 text-amber-950",
  danger: "bg-red-600 text-white",
};

export function MaxCoolingChart() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-stone-200">
        <table className="w-full table-fixed border-collapse text-center text-[11px] leading-tight sm:text-xs">
          <colgroup>
            <col className="w-8" />
            {MAX_COOLING_OUTSIDE_TEMPS_F.map((t) => (
              <col key={t} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-stone-100 text-stone-600">
              <th className="border-b border-r border-stone-200 px-0.5 py-1.5 text-[10px] font-semibold">
                RH%
              </th>
              <th
                colSpan={MAX_COOLING_OUTSIDE_TEMPS_F.length}
                className="border-b border-stone-200 px-1 py-1.5 text-[10px] font-semibold sm:text-xs"
              >
                Outside temperature
              </th>
            </tr>
            <tr className="bg-stone-50 text-stone-700">
              <th className="border-b border-r border-stone-200 px-0.5 py-1" />
              {MAX_COOLING_OUTSIDE_TEMPS_F.map((t) => (
                <th key={t} className="border-b border-stone-200 px-0.5 py-1 font-semibold">
                  {t}°
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MAX_COOLING_APPARENT_TEMPS.map((row) => (
              <tr key={row.humidityPct}>
                <th className="border-r border-stone-100 bg-stone-50 px-0.5 py-1 font-semibold text-stone-800">
                  {row.humidityPct}
                </th>
                {row.tempsF.map((temp, i) => (
                  <td
                    key={`${row.humidityPct}-${MAX_COOLING_OUTSIDE_TEMPS_F[i]}`}
                    className={cn(
                      "border border-stone-100 px-0.5 py-1 font-semibold tabular-nums",
                      zoneClass[maxCoolingZone(temp)],
                    )}
                  >
                    {temp}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-stone-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-stone-200 bg-white" />
          Normal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-200" />
          Caution (86–89°F)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-600" />
          Danger (90°F+)
        </span>
      </div>
    </div>
  );
}
