import { downloadReportPdf } from "@/lib/exports/pdf";
import { buildLfoSharePayload, type LfoShareInventory } from "@/lib/lfo/share-payload";

export function downloadLfoPdf(inventory: LfoShareInventory) {
  const payload = buildLfoSharePayload(inventory);
  downloadReportPdf({
    title: payload.title,
    subtitle: payload.subtitle,
    filename: payload.filename,
    blocks: payload.sections.map((section) => ({
      type: "table" as const,
      title: section.title,
      headers: ["Field", "Value"],
      rows: section.rows.map((row) => [row.label, row.value]),
    })),
  });
}
