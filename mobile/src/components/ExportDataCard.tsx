import { useState } from "react";
import { Alert, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  buildMobileBackup,
  mobileBackupFileName,
  mobileBackupJson,
} from "../lib/dataExport";
import { colors, styles } from "../theme";
import { Card, PrimaryButton } from "./ui";

/** Share/copy a JSON backup of all phone SQLite farm data. */
export function ExportDataCard() {
  const [exporting, setExporting] = useState(false);
  const [lastExportNote, setLastExportNote] = useState<string | null>(null);

  async function exportData() {
    if (exporting) return;
    setExporting(true);
    setLastExportNote(null);
    try {
      const backup = buildMobileBackup();
      const json = mobileBackupJson(backup);
      const fileName = mobileBackupFileName(new Date(backup.exportedAt));
      const farmCount = backup.counts.farms ?? 0;
      const mortCount = backup.counts.daily_mortality ?? 0;

      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const uri = `${cacheDir}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/json",
            dialogTitle: "Export PoultryTech data",
            UTI: "public.json",
          });
          setLastExportNote(
            `Shared ${fileName} (${farmCount} farms, ${mortCount} mortality days). Import on web → Settings.`,
          );
          return;
        }
      }

      await Clipboard.setStringAsync(json);
      try {
        await Share.share({ message: json, title: fileName });
      } catch {
        // Clipboard alone is enough
      }
      setLastExportNote(
        `Copied backup JSON (${farmCount} farms, ${mortCount} mortality days). Save as a .json file, then import on web → Settings.`,
      );
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Could not export data");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card>
      <Text style={{ fontWeight: "800", fontSize: 16 }}>Export phone data</Text>
      <Text style={[styles.muted, { marginTop: 6, lineHeight: 20 }]}>
        Backup farms, houses, flocks, mortality, visits, issues, litter, feed, and LFO from this
        phone. On the web app open Settings → Import phone backup.
      </Text>
      <View style={{ marginTop: 14 }}>
        <PrimaryButton label={exporting ? "Exporting…" : "Export data"} onPress={exportData} />
      </View>
      {lastExportNote ? (
        <Text style={[styles.muted, { marginTop: 10, lineHeight: 18, color: colors.text }]}>
          {lastExportNote}
        </Text>
      ) : null}
    </Card>
  );
}
