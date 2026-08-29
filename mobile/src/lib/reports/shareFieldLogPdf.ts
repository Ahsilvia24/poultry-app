import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { fieldLogWeeksToHtml, type FieldLogWeek } from "./field-log";
import { printHtmlDocument } from "./printHtml";

/** US Letter landscape at 72 PPI — week columns need the extra width. */
const LANDSCAPE_LETTER = { width: 792, height: 612 };

export async function shareFieldLogPdf(opts: {
  weeks: FieldLogWeek[];
  subtitle: string;
}) {
  if (opts.weeks.length === 0) {
    Alert.alert("Nothing to share", "No field log weeks in this date range.");
    return;
  }

  const html = fieldLogWeeksToHtml({
    title: "Field Log",
    subtitle: opts.subtitle,
    weeks: opts.weeks,
  });

  if (Platform.OS === "web") {
    await printHtmlDocument(html);
    return;
  }

  const result = await Print.printToFileAsync({
    html,
    width: LANDSCAPE_LETTER.width,
    height: LANDSCAPE_LETTER.height,
  });
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert(
      "PDF ready",
      "Sharing is not available on this device. The PDF was generated but could not be exported.",
    );
    return;
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Save or share field log",
    UTI: "com.adobe.pdf",
  });
}
