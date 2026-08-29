import { buildFieldLogPdfBytes } from "./buildFieldLogPdf";
import { fieldLogHasVisits, type FieldLogWeek } from "./field-log";
import { savePdfBytes } from "./savePdf";

export async function shareFieldLogPdf(opts: {
  weeks: FieldLogWeek[];
  subtitle: string;
}) {
  if (!fieldLogHasVisits(opts.weeks)) {
    throw new Error("No visits logged in this date range.");
  }

  const bytes = await buildFieldLogPdfBytes({
    title: "Field Log",
    subtitle: opts.subtitle,
    weeks: opts.weeks,
  });
  await savePdfBytes(bytes, `field-log-${Date.now()}.pdf`);
}
