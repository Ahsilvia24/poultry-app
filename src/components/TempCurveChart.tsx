import { TEMP_CURVE } from "@/lib/tools/temp-curve";

export function TempCurveChart() {
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full min-w-[16rem] text-left text-sm">
        <thead className="bg-stone-100 text-stone-700">
          <tr>
            <th className="px-3 py-2 font-semibold">Day</th>
            <th className="px-3 py-2 font-semibold">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Summer</span>
            </th>
            <th className="px-3 py-2 font-semibold">Winter</th>
          </tr>
        </thead>
        <tbody>
          {TEMP_CURVE.map((row) => (
            <tr key={row.day} className="border-t border-stone-100">
              <td className="px-3 py-2 font-semibold text-stone-900">{row.day}</td>
              <td className="bg-amber-50/80 px-3 py-2 font-medium text-amber-950">
                {row.summerF}°F
              </td>
              <td className="px-3 py-2 font-medium text-stone-800">{row.winterF}°F</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
