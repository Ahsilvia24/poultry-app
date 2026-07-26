import { BIG_BIRD_LIGHTING_PROGRAM } from "@/lib/tools/lights";

export function LightsChart() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">Big Bird lighting program</p>
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead className="bg-stone-100 text-stone-700">
            <tr>
              <th className="px-3 py-2 font-semibold">Age (days)</th>
              <th className="px-3 py-2 font-semibold">Hours light</th>
              <th className="px-3 py-2 font-semibold">Hours dark</th>
              <th className="px-3 py-2 font-semibold">Center lights</th>
              <th className="px-3 py-2 font-semibold">Intensity</th>
            </tr>
          </thead>
          <tbody>
            {BIG_BIRD_LIGHTING_PROGRAM.map((row) => (
              <tr key={row.ageLabel} className="border-t border-stone-100">
                <td className="px-3 py-1.5 font-semibold text-stone-900">{row.ageLabel}</td>
                <td className="px-3 py-1.5 tabular-nums text-stone-800">{row.hoursLight}</td>
                <td className="px-3 py-1.5 tabular-nums text-stone-800">{row.hoursDark}</td>
                <td className="px-3 py-1.5 capitalize text-stone-800">{row.centerLights}</td>
                <td className="px-3 py-1.5 font-medium text-stone-900">{row.intensity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 text-xs text-stone-500">
        <p>* Brood lights ON days 1–7 only.</p>
        <p>* 24 hours prior to sell, the lights should be left on.</p>
      </div>
    </div>
  );
}
