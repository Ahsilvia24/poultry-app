import { buildLfoPdfBytes } from "@/lib/exports/buildLfoPdf";
import { buildLfoSharePayload, type LfoShareInventory } from "@/lib/lfo/share-payload";
import { downloadPdfBytes } from "@/lib/serviceForms/sharePdf";

export async function downloadLfoPdf(inventory: LfoShareInventory) {
  const payload = buildLfoSharePayload(inventory);
  const bytes = await buildLfoPdfBytes(payload);
  downloadPdfBytes(bytes, payload.filename);
}
