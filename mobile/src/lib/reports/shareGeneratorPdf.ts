import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  generatorReportToHtml,
  type GeneratorReportViewFarm,
} from "./generator-log";

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

  const result = await Print.printToFileAsync({ html });
  if (Platform.OS === "web") return;

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
