import * as Sharing from "expo-sharing";
import type { AnyServiceForm } from "./types";
import { buildServiceFormPdf } from "./pdfFill";

/** Build a fillable PDF (original Bachoco template + AcroForm fields) and open the share sheet. */
export async function shareServiceFormPdf(form: AnyServiceForm) {
  const uri = await buildServiceFormPdf(form);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share service form PDF",
      UTI: "com.adobe.pdf",
    });
  }
  return uri;
}
