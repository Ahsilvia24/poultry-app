import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { AnyServiceForm } from "./types";
import { buildServiceFormPdf } from "./pdfFill";
import { savePdfBytes } from "../reports/savePdf";

function bytesFromBase64(base64: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Build a PDF on the original Bachoco form template and open the share sheet. */
export async function shareServiceFormPdf(form: AnyServiceForm) {
  const uri = await buildServiceFormPdf(form);
  const filename = uri.split("/").pop() || "service-form.pdf";

  if (Platform.OS === "web") {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await savePdfBytes(bytesFromBase64(base64), filename);
    return uri;
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
