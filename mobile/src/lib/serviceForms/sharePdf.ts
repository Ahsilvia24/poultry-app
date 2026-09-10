import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import type { AnyServiceForm } from "./types";
import { buildServiceFormPdf } from "./pdfFill";
import { savePdfBytes } from "../reports/savePdf";

/** Build a PDF on the original Bachoco form template and open the share sheet. */
export async function shareServiceFormPdf(form: AnyServiceForm) {
  const { uri, bytes, filename } = await buildServiceFormPdf(form);

  if (Platform.OS === "web") {
    await savePdfBytes(bytes, filename);
    return filename;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(
      "Sharing is not available on this device. The PDF was generated but could not be exported.",
    );
  }
  // iOS share sheet includes Save to Files, AirDrop, Mail, Messages, etc.
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Save or share service form PDF",
    UTI: "com.adobe.pdf",
  });
  return uri;
}
