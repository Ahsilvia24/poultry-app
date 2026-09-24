import { buildLfoPdfBytes } from "@/lib/exports/buildLfoPdf";
import { buildLfoSharePayload, type LfoShareInventory } from "@/lib/lfo/share-payload";
import { sharePdfBytes } from "@/lib/serviceForms/sharePdf";

export async function shareLfoPdf(inventory: LfoShareInventory) {
  const payload = buildLfoSharePayload(inventory);
  const bytes = await buildLfoPdfBytes(payload);
  return sharePdfBytes(bytes, payload.filename);
}

export async function downloadLfoPdf(inventory: LfoShareInventory) {
  return shareLfoPdf(inventory);
}
