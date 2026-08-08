import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { colors, styles } from "../theme";
import { Card, Chip, PrimaryButton } from "./ui";
import {
  groupPlacementFarms,
  parsePlacementSheetRows,
  type PlacementRow,
} from "../lib/placementImport/parse";
import { matchPlacementFarm } from "../lib/placementImport/match";
import {
  importPlacementRows,
  listFarmsForPlacementMatch,
} from "../repos/data";

type ImportType = "placement" | "catch" | "settlement";

type FarmPreview = {
  key: string;
  farmCode: string;
  farmName: string;
  rowCount: number;
  houseNumbers: number[];
  flockIds: string[];
  isMyFarm: boolean;
  matchName: string | null;
  nameDiffers: boolean;
  matchKind: string;
};

const TYPE_OPTIONS: Array<{ id: ImportType; label: string }> = [
  { id: "placement", label: "Placement" },
  { id: "catch", label: "Catch Schedule" },
  { id: "settlement", label: "Settlements" },
];

function typeLabel(type: ImportType) {
  return TYPE_OPTIONS.find((t) => t.id === type)?.label ?? type;
}

async function rowsFromPickedFile(asset: DocumentPicker.DocumentPickerAsset): Promise<PlacementRow[]> {
  const name = (asset.name || "").toLowerCase();
  const uri = asset.uri;

  if (name.endsWith(".csv") || asset.mimeType?.includes("csv")) {
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const sheet = text.split(/\r?\n/).map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "")));
    return parsePlacementSheetRows(sheet);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls") || asset.mimeType?.includes("sheet") || asset.mimeType?.includes("excel")) {
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const workbook = XLSX.read(b64, { type: "base64", cellDates: true });
    const first = workbook.SheetNames[0];
    if (!first) return [];
    const sheet = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[first]!, {
      header: 1,
      raw: false,
      defval: "",
    });
    return parsePlacementSheetRows(sheet as string[][]);
  }

  if (name.endsWith(".pdf") || asset.mimeType?.includes("pdf")) {
    // pdf-parse/pdf.js is not bundled for Expo web/native; use CSV/XLSX here
    // or run PDF import from the Next.js web app.
    throw new Error(
      "PDF placement import needs a CSV/XLSX export on mobile, or use the web Import with this PDF.",
    );
  }

  throw new Error("Use a Weekly Chick Placement PDF or spreadsheet (.csv / .xlsx).");
}

export function ScheduleImportCard() {
  const [importType, setImportType] = useState<ImportType>("placement");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<PlacementRow[]>([]);
  const [farms, setFarms] = useState<FarmPreview[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<Record<string, boolean>>({});
  const [onlyMyFarms, setOnlyMyFarms] = useState(false);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  function buildPreview(parsed: PlacementRow[]) {
    const existing = listFarmsForPlacementMatch();
    const groups = groupPlacementFarms(parsed).map((g) => {
      const match = matchPlacementFarm(g.farmName, g.farmCode, existing);
      return {
        key: g.key,
        farmCode: g.farmCode,
        farmName: g.farmName,
        rowCount: g.rowCount,
        houseNumbers: g.houseNumbers,
        flockIds: g.flockIds,
        isMyFarm: match.kind !== "none",
        matchName: match.farm?.farmName ?? null,
        nameDiffers: match.nameDiffers,
        matchKind: match.kind,
      } satisfies FarmPreview;
    });
    setRows(parsed);
    setFarms(groups);
    const nextSelected: Record<string, boolean> = {};
    const nextRename: Record<string, boolean> = {};
    for (const farm of groups) {
      nextSelected[farm.key] = farm.isMyFarm;
      nextRename[farm.key] = false;
    }
    setSelected(nextSelected);
    setRename(nextRename);
    setOnlyMyFarms(true);
  }

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
          "text/csv",
          "text/plain",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const parsed = await rowsFromPickedFile(picked.assets[0]);
      if (parsed.length === 0) {
        throw new Error(
          "Could not read placement rows. Need Date Placed, Farm Code, Farm Name, Flock Code, House No, Number Sent.",
        );
      }
      buildPreview(parsed);
      setNote(`Read ${parsed.length} rows from ${picked.assets[0].name}.`);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not read file");
    } finally {
      setBusy(false);
    }
  }

  function onToggleOnlyMine(checked: boolean) {
    setOnlyMyFarms(checked);
    if (!checked) return;
    const next: Record<string, boolean> = {};
    for (const farm of farms) next[farm.key] = farm.isMyFarm;
    setSelected(next);
  }

  function onImport() {
    if (busy || selectedCount === 0) return;
    setBusy(true);
    try {
      const result = importPlacementRows({
        rows,
        selections: farms.map((farm) => ({
          key: farm.key,
          selected: Boolean(selected[farm.key]),
          renameToImportedName: Boolean(rename[farm.key]),
        })),
      });
      setNote(
        `Imported ${selectedCount} farm(s): ${result.createdFarms} created, ${result.updatedNames} renamed, ${result.createdFlocks} flocks, ${result.createdHouses} houses.`,
      );
      if (result.warnings.length) {
        Alert.alert("Imported with notes", result.warnings.slice(0, 6).join("\n"));
      }
      setFarms([]);
      setRows([]);
      setOnlyMyFarms(false);
    } catch (e) {
      Alert.alert("Import failed", e instanceof Error ? e.message : "Could not import");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text style={[styles.muted, { lineHeight: 20 }]}>
        Import Placement, Catch Schedule, or Settlements. Placement reads Date Placed, Farm
        Code, Farm Name, Flock ID, House No, and Number Sent.
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
              setFarms([]);
              setRows([]);
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
          PDF works on web; phone can use CSV/XLSX (or the same PDF in Expo web).
        </Text>
      )}

      <PrimaryButton label={busy ? "Working…" : "Upload & read"} onPress={onUpload} />

      {note ? (
        <Text style={[styles.muted, { marginTop: 10, lineHeight: 18, color: colors.text }]}>
          {note}
        </Text>
      ) : null}

      {farms.length > 0 ? (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: "#e7e5e4", paddingTop: 12 }}>
          <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <Text style={{ fontWeight: "800", color: colors.text }}>Choose farms to import</Text>
            <Pressable
              onPress={() => onToggleOnlyMine(!onlyMyFarms)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: onlyMyFarms ? colors.accentDark : "#fff",
                }}
              />
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 12 }}>
                Only my farms
              </Text>
            </Pressable>
          </View>

          {farms.map((farm) => {
            const checked = Boolean(selected[farm.key]);
            return (
              <View
                key={farm.key}
                style={{
                  marginTop: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  padding: 10,
                  backgroundColor: "#fafaf9",
                }}
              >
                <Pressable
                  onPress={() => {
                    const value = !checked;
                    setSelected((prev) => ({ ...prev, [farm.key]: value }));
                    if (onlyMyFarms && value && !farm.isMyFarm) setOnlyMyFarms(false);
                  }}
                  style={{ flexDirection: "row", gap: 8 }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      marginTop: 2,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: checked ? colors.accentDark : "#fff",
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "800", color: colors.text }}>
                      {farm.farmName}{" "}
                      <Text style={{ fontWeight: "600", color: colors.muted }}>{farm.farmCode}</Text>
                    </Text>
                    <Text style={[styles.muted, { fontSize: 11 }]}>
                      {farm.rowCount} rows · houses {farm.houseNumbers.join(", ")}
                    </Text>
                    <Text
                      style={{
                        marginTop: 2,
                        fontSize: 11,
                        fontWeight: "700",
                        color: farm.isMyFarm ? colors.accentDark : "#92400e",
                      }}
                    >
                      {farm.isMyFarm
                        ? `Matches your farm${farm.matchName ? `: ${farm.matchName}` : ""}${
                            farm.matchKind === "fuzzy" ? " (similar name)" : ""
                          }`
                        : "New farm will be created"}
                    </Text>
                  </View>
                </Pressable>

                {checked && farm.nameDiffers && farm.matchName ? (
                  <Pressable
                    onPress={() =>
                      setRename((prev) => ({ ...prev, [farm.key]: !prev[farm.key] }))
                    }
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: "#e7e5e4",
                      flexDirection: "row",
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        marginTop: 2,
                        borderRadius: 3,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: rename[farm.key] ? colors.accentDark : "#fff",
                      }}
                    />
                    <Text style={{ flex: 1, fontSize: 12, color: colors.text, lineHeight: 16 }}>
                      Update farm name from {farm.matchName} to {farm.farmName}? Keeps grower,
                      phone, houses, and other saved info.
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <View style={{ marginTop: 12 }}>
            <PrimaryButton
              label={
                busy
                  ? "Importing…"
                  : `Import ${selectedCount} farm${selectedCount === 1 ? "" : "s"}`
              }
              onPress={onImport}
            />
            <Pressable
              onPress={() => {
                setFarms([]);
                setRows([]);
                setOnlyMyFarms(false);
              }}
              style={{ marginTop: 10, alignSelf: "center" }}
            >
              <Text style={{ fontWeight: "700", color: colors.muted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
