import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  generatorReportToHtml,
  type GeneratorReportViewFarm,
} from "./generator-log";

/** Print only the report HTML — never the surrounding app chrome. */
function printHtmlDocument(html: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Printing is not available"));
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      iframe.remove();
      reject(new Error("Could not open print frame"));
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      iframe.remove();
      resolve();
    };

    doc.open();
    doc.write(html);
    doc.close();
    win.onafterprint = finish;
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 50);
    window.setTimeout(finish, 60_000);
  });
}

export async function shareGeneratorReportPdf(opts: {
  farms: GeneratorReportViewFarm[];
  subtitle: string;
}) {
  if (opts.farms.length === 0) {
    Alert.alert("Nothing to share", "No generator hours logged in this date range.");
    return;
  }

  const html = generatorReportToHtml({
    title: "Generator Hours",
    subtitle: opts.subtitle,
    farms: opts.farms,
  });

  if (Platform.OS === "web") {
    await printHtmlDocument(html);
    return;
  }

  const result = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(
      "PDF ready",
      "Sharing is not available on this device. The PDF was generated but could not be exported.",
    );
    return;
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Save or share generator report",
    UTI: "com.adobe.pdf",
  });
}
