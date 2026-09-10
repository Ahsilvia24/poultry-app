import { buildLfoSharePayload, type LfoShareInventory } from "../lfo/share-payload";
import { buildLfoPdfBytes } from "./buildLfoPdf";
import { savePdfBytes } from "./savePdf";

export async function shareLfoPdf(inventory: LfoShareInventory) {
  const payload = buildLfoSharePayload(inventory);
  if (payload.sections.length === 0) {
    throw new Error("This LFO does not have data to export yet.");
  }
  const bytes = await buildLfoPdfBytes(payload);
  await savePdfBytes(bytes, payload.filename);
}
