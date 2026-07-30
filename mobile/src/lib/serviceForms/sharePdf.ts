import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { AnyServiceForm } from "./types";
import { serviceFormPdfHtml } from "./pdf";

export async function shareServiceFormPdf(form: AnyServiceForm) {
  const html = serviceFormPdfHtml(form);
  const file = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Share service form PDF",
      UTI: "com.adobe.pdf",
    });
  }
  return file.uri;
}
