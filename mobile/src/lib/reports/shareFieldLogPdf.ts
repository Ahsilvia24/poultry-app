import { buildFieldLogPdfBytes } from "./buildFieldLogPdf";
import type { FieldLogWeek } from "./field-log";
import { savePdfBytes } from "./savePdf";

export async function shareFieldLogPdf(opts: {
  weeks: FieldLogWeek[];
  subtitle: string;
}) {
  if (opts.weeks.length === 0) {
    throw new Error("No field log weeks in this date range.");
  }

  const bytes = await buildFieldLogPdfBytes({
    title: "Field Log",
    subtitle: opts.subtitle,
    weeks: opts.weeks,
  });
  await savePdfBytes(bytes, `field-log-${Date.now()}.pdf`);
}
