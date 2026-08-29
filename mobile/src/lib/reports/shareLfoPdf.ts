import { Alert } from "react-native";
import { buildLfoSharePayload, type LfoShareInventory } from "../lfo/share-payload";
import { buildLfoPdfBytes } from "./buildLfoPdf";
import { savePdfBytes } from "./savePdf";

export async function shareLfoPdf(inventory: LfoShareInventory) {
  const payload = buildLfoSharePayload(inventory);
  if (payload.sections.length === 0) {
    Alert.alert("Nothing to share", "This LFO does not have data to export yet.");
    return;
  }
  const bytes = await buildLfoPdfBytes(payload);
  await savePdfBytes(bytes, payload.filename);
}
