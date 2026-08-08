import { useCallback, useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { colors, styles } from "../theme";
import { Card, Chip, PrimaryButton } from "./ui";

const STORAGE_KEY = "poultry.dashboard.scheduleImports";

type ImportType = "placement" | "catch" | "settlement";

type StoredImport = {
  id: string;
  importType: ImportType;
  originalName: string;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string;
};

const TYPE_OPTIONS: Array<{ id: ImportType; label: string }> = [
  { id: "placement", label: "Placement" },
  { id: "catch", label: "Catch Schedule" },
  { id: "settlement", label: "Settlements" },
];

function typeLabel(type: ImportType) {
  return TYPE_OPTIONS.find((t) => t.id === type)?.label ?? type;
}

function formatBytes(n: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function readStored(): Promise<StoredImport[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredImport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ScheduleImportCard() {
  const [importType, setImportType] = useState<ImportType>("placement");
  const [items, setItems] = useState<StoredImport[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setItems(await readStored());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const shown = items.filter((item) => item.importType === importType);

  async function onUpload() {
    if (busy) return;
    if (importType !== "placement") {
      Alert.alert(
        "Coming next",
        `${typeLabel(importType)} import comes next. Start with Placement.`,
      );
      return;
    }

    setBusy(true);
    setNote(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "application/pdf",
          "image/*",
          "text/*",
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
      });
      if (picked.canceled || !picked.assets?.[0]) return;

      const asset = picked.assets[0];
      const id = `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const ext = asset.name?.includes(".")
        ? asset.name.slice(asset.name.lastIndexOf("."))
        : "";
      const dir = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}schedule-imports/`;
      if (!dir) throw new Error("No storage directory available");
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = `${dir}${id}${ext}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });

      const next: StoredImport = {
        id,
        importType,
        originalName: asset.name || "placement-import",
        uri: dest,
        mimeType: asset.mimeType ?? null,
        sizeBytes: asset.size ?? null,
        uploadedAt: new Date().toISOString(),
      };
      const all = [next, ...(await readStored())];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setItems(all);
      setNote(
        `Saved ${next.originalName}. Tell me how you want the Placement fields mapped next.`,
      );
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not save file");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={[styles.muted, { lineHeight: 20 }]}>
        Import Placement, Catch Schedule, or Settlements. Start with a Placement file —
        next you’ll tell us which fields to pull.
      </Text>

      <View style={[styles.row, { marginTop: 12, marginBottom: 4, flexWrap: "wrap" }]}>
        {TYPE_OPTIONS.map((type) => (
          <Chip
            key={type.id}
            label={type.label}
            active={importType === type.id}
            onPress={() => {
              setImportType(type.id);
              setNote(null);
            }}
          />
        ))}
      </View>

      {importType !== "placement" ? (
        <Text style={[styles.muted, { marginBottom: 12, fontSize: 12 }]}>
          {typeLabel(importType)} mapping comes next. Upload Placement first.
        </Text>
      ) : (
        <Text style={[styles.muted, { marginBottom: 12, fontSize: 12 }]}>
          PDF, photo, or spreadsheet is fine for now.
        </Text>
      )}

      <PrimaryButton
        label={busy ? "Uploading…" : "Upload for import"}
        onPress={onUpload}
      />

      {note ? (
        <Text style={[styles.muted, { marginTop: 10, lineHeight: 18, color: colors.text }]}>
          {note}
        </Text>
      ) : null}

      {shown.length > 0 ? (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: "#e7e5e4", paddingTop: 12 }}>
          <Text style={{ fontWeight: "800", color: colors.text, marginBottom: 6 }}>
            Uploaded {typeLabel(importType).toLowerCase()}
          </Text>
          {shown.map((item) => (
            <View key={item.id} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: "700", color: colors.text }}>{item.originalName}</Text>
              <Text style={[styles.muted, { fontSize: 12 }]}>
                {formatBytes(item.sizeBytes)} · {new Date(item.uploadedAt).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
