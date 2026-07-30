import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import type { AnyServiceForm } from "./types";
import { buildServiceFormPdf } from "./pdfFill";

/** Build a PDF on the original Bachoco form template and open the share sheet. */
export async function shareServiceFormPdf(form: AnyServiceForm) {
  const uri = await buildServiceFormPdf(form);
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(
      "PDF ready",
      "Sharing is not available on this device. The PDF was generated but could not be exported.",
    );
    return uri;
  }
  // iOS share sheet includes Save to Files, AirDrop, Mail, Messages, etc.
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "Save or share service form PDF",
    UTI: "com.adobe.pdf",
  });
  return uri;
}
