import { useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import { colors, styles } from "../theme";
import { Card, PrimaryButton } from "./ui";
import {
  groupPlacementFarms,
  parsePlacementPdfText,
  parsePlacementSheetRows,
  placementPdfExtractStats,
  summarizePlacementRows,
  type PlacementRow,
} from "../lib/placementImport/parse";
import {
  groupCatchFarms,
  parseCatchPdfText,
  parseCatchSheetRows,
  type CatchRow,
} from "../lib/catchImport/parse";
import { matchPlacementFarmGroups } from "../lib/placementImport/match";
import { extractPdfTextFromBytes, extractPdfTextFromUri } from "../lib/pdfText";
import {
  importCatchRows,
  importPlacementRows,
  listFarmsForPlacementMatch,
} from "../repos/data";

const FILE_ACCEPT =
  ".pdf,.csv,.xls,.xlsx,.txt,application/pdf,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type ImportType = "placement" | "catch";

type FarmPreview = {
  key: string;
  farmCode: string;
  farmName: string;
  rowCount: number;
  houseNumbers: number[];
  flockIds: string[];
  catchDates?: string[];
  isMyFarm: boolean;
  matchName: string | null;
  nameDiffers: boolean;
  matchKind: string;
};

const TYPE_OPTIONS: Array<{ id: ImportType; label: string }> = [
  { id: "placement", label: "Placement" },
  { id: "catch", label: "Catch Schedule" },
];

function typeLabel(type: ImportType) {
  return TYPE_OPTIONS.find((t) => t.id === type)?.label ?? type;
}

function isPdfFile(fileName: string, mimeType?: string | null) {
  const name = fileName.toLowerCase();
  return name.endsWith(".pdf") || Boolean(mimeType?.toLowerCase().includes("pdf"));
}

function sheetFromWorkbookBytes(bytes: ArrayBuffer | Uint8Array, fileName: string): string[][] {
  const name = fileName.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const text = new TextDecoder().decode(
      bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes,
    );
    return text.split(/\r?\n/).map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "")));
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
    const first = workbook.SheetNames[0];
    if (!first) return [];
    const sheet = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[first]!, {
      header: 1,
      raw: false,
      defval: "",
    });
    return sheet as string[][];
  }
  throw new Error("Use a spreadsheet (.csv / .xlsx) or PDF.");
}

async function sheetFromPickedFile(
  asset: DocumentPicker.DocumentPickerAsset,
): Promise<string[][]> {
  const name = (asset.name || "").toLowerCase();
  const uri = asset.uri;

  if (name.endsWith(".csv") || asset.mimeType?.includes("csv")) {
    const text = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return text.split(/\r?\n/).map((line) => line.split(",").map((c) => c.replace(/^"|"$/g, "")));
  }

  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    asset.mimeType?.includes("sheet") ||
    asset.mimeType?.includes("excel")
  ) {
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
    return sheet as string[][];
  }

  throw new Error("Use a PDF or spreadsheet (.csv / .xlsx).");
}

export function ScheduleImportCard() {
  const [importType, setImportType] = useState<ImportType>("placement");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [placementRows, setPlacementRows] = useState<PlacementRow[]>([]);
  const [catchRows, setCatchRows] = useState<CatchRow[]>([]);
  const [farms, setFarms] = useState<FarmPreview[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [rename, setRename] = useState<Record<string, boolean>>({});
  const [onlyMyFarms, setOnlyMyFarms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  function clearPreview() {
    setFarms([]);
    setPlacementRows([]);
    setCatchRows([]);
    setOnlyMyFarms(false);
  }

  function setPreviewFromGroups(groups: FarmPreview[]) {
    setFarms(groups);
    const nextSelected: Record<string, boolean> = {};
    const nextRename: Record<string, boolean> = {};
    for (const farm of groups) {
      // Default: select everything so growers see the full sheet, not only matches.
      nextSelected[farm.key] = true;
      nextRename[farm.key] = false;
    }
    setSelected(nextSelected);
    setRename(nextRename);
    setOnlyMyFarms(false);
  }

  function buildPlacementPreview(parsed: PlacementRow[]) {
    const existing = listFarmsForPlacementMatch();
    const grouped = groupPlacementFarms(parsed);
    const matches = matchPlacementFarmGroups(grouped, existing);
    const groups = grouped.map((g, i) => {
      const match = matches[i]!;
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
    setPlacementRows(parsed);
    setCatchRows([]);
    setPreviewFromGroups(groups);
    const summary = summarizePlacementRows(parsed);
    const matched = groups.filter((g) => g.isMyFarm).length;
    setNote(
      `Parsed ${summary.farmCount} farm${summary.farmCount === 1 ? "" : "s"} · ${summary.houseCount} house${summary.houseCount === 1 ? "" : "s"} · ${summary.birdsSent.toLocaleString()} birds. ${matched} already match farms in your app.`,
    );
  }

  function buildCatchPreview(parsed: CatchRow[]) {
    const existing = listFarmsForPlacementMatch();
    const grouped = groupCatchFarms(parsed);
    const matches = matchPlacementFarmGroups(grouped, existing);
    const groups = grouped.map((g, i) => {
      const match = matches[i]!;
      return {
        key: g.key,
        farmCode: g.farmCode,
        farmName: g.farmName,
        rowCount: g.rowCount,
        houseNumbers: g.houseNumbers,
        flockIds: g.flockIds,
        catchDates: g.catchDates,
        isMyFarm: match.kind !== "none",
        matchName: match.farm?.farmName ?? null,
        nameDiffers: match.nameDiffers,
        matchKind: match.kind,
      } satisfies FarmPreview;
    });
    setCatchRows(parsed);
    setPlacementRows([]);
    setPreviewFromGroups(groups);
  }

  async function processSheet(sheet: string[][], fileName: string) {
    if (importType === "catch") {
      const parsed = parseCatchSheetRows(sheet);
      if (parsed.length === 0) {
        throw new Error(
          "Could not read catch rows. Need Catch Date, Farm Name, and House (Farm Code / Flock when available).",
        );
      }
      buildCatchPreview(parsed);
      setNote(`Read ${parsed.length} rows from ${fileName}.`);
      return;
    }

    const parsed = parsePlacementSheetRows(sheet);
    if (parsed.length === 0) {
      throw new Error(
        "Could not read placement rows. Need at least Farm Name or Farm Code (Date, House, and birds can be blank).",
      );
    }
    buildPlacementPreview(parsed);
  }

  async function processPdfText(text: string, fileName: string) {
    if (!text.trim()) {
      throw new Error("Could not read text from that PDF. Try a clearer file or CSV/XLSX.");
    }

    if (importType === "catch") {
      const parsed = parseCatchPdfText(text);
      if (parsed.length === 0) {
        throw new Error(
          "Could not read catch rows from PDF. Need Catch Date / Ending Kill Date, Farm Name, and House (partial rows OK).",
        );
      }
      buildCatchPreview(parsed);
      setNote(`Read ${parsed.length} rows from ${fileName}.`);
      return;
    }

    const stats = placementPdfExtractStats(text);
    const parsed = parsePlacementPdfText(text);
    if (parsed.length === 0) {
      throw new Error(
        "Couldn’t read placement rows from this PDF. Try CSV/XLSX or a clearer text PDF.",
      );
    }
    buildPlacementPreview(parsed);
    const summary = summarizePlacementRows(parsed);
    if (stats.expectedRows >= 20 && summary.rowCount < stats.expectedRows * 0.5) {
      setNote(
        (prev) =>
          `${prev ?? ""} Some rows may be missing — if the list looks short, try CSV/XLSX.`,
      );
    }
  }

  async function processPdfBytes(bytes: ArrayBuffer | Uint8Array, fileName: string) {
    setNote(
      Platform.OS === "web"
        ? `Reading ${fileName} (scanned PDFs use OCR and may take a minute)…`
        : `Reading ${fileName}…`,
    );
    const text = await extractPdfTextFromBytes(bytes);
    await processPdfText(text, fileName);
  }

  async function processPdfUri(uri: string, fileName: string) {
    setNote(`Reading ${fileName}…`);
    const text = await extractPdfTextFromUri(uri);
    await processPdfText(text, fileName);
  }

  async function onWebFileSelected(file: File) {
    setBusy(true);
    setNote(null);
    try {
      const bytes = await file.arrayBuffer();
      if (isPdfFile(file.name, file.type)) {
        await processPdfBytes(bytes, file.name);
      } else {
        const sheet = sheetFromWorkbookBytes(bytes, file.name);
        await processSheet(sheet, file.name);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read file";
      setNote(msg);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function pickWebFile(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = FILE_ACCEPT;
      input.style.display = "none";
      const cleanup = () => {
        input.remove();
      };
      input.addEventListener("change", () => {
        const file = input.files?.[0] ?? null;
        cleanup();
        resolve(file);
      });
      input.addEventListener("cancel", () => {
        cleanup();
        resolve(null);
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  async function onUpload() {
    if (busy) return;

    if (Platform.OS === "web") {
      try {
        const file = await pickWebFile();
        if (!file) return;
        await onWebFileSelected(file);
      } catch {
        fileInputRef.current?.click();
      }
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
      const asset = picked.assets[0];
      const fileName = asset.name || "import.pdf";
      if (isPdfFile(fileName, asset.mimeType)) {
        await processPdfUri(asset.uri, fileName);
      } else {
        const sheet = await sheetFromPickedFile(asset);
        await processSheet(sheet, fileName);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read file";
      setNote(msg);
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
      const selections = farms.map((farm) => ({
        key: farm.key,
        selected: Boolean(selected[farm.key]),
        renameToImportedName: Boolean(rename[farm.key]),
      }));

      if (importType === "catch") {
        const result = importCatchRows({ rows: catchRows, selections });
        setNote(
          `Updated ${selectedCount} farm(s): ${result.updatedHouses} house catch dates, ${result.updatedFlocks} flock dates, ${result.updatedNames} renamed.`,
        );
        if (result.warnings.length) {
          setNote((prev) => `${prev ?? ""}\n${result.warnings.slice(0, 6).join("\n")}`.trim());
        }
      } else {
        const result = importPlacementRows({
          rows: placementRows,
          selections,
        });
        setNote(
          `Imported ${selectedCount} farm(s): ${result.createdFarms} created, ${result.updatedNames} renamed, ${result.updatedPlacements} house placements updated, ${result.createdFlocks} new flocks, ${result.createdHouses} houses.`,
        );
        if (result.warnings.length) {
          setNote((prev) => `${prev ?? ""}\n${result.warnings.slice(0, 6).join("\n")}`.trim());
        }
      }
      clearPreview();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not import");
    } finally {
      setBusy(false);
    }
  }

  const helperText =
    importType === "catch"
      ? Platform.OS === "web"
        ? "Choose a Kill/Catch Schedule PDF/CSV/XLSX (scanned PDFs OK). Ending Kill Date or Catch Date, Farm Name, House."
        : "Choose a Kill/Catch Schedule PDF/CSV/XLSX. Ending Kill Date or Catch Date, Farm Name, House. Scanned PDFs need CSV/XLSX on iPhone."
      : Platform.OS === "web"
        ? "Weekly Chick Placement: farm name, code left of the name, house, date placed, birds sent. Ignores Complex / flock-code / mortality columns."
        : "Weekly Chick Placement: farm name, code left of the name (e.g. 3821FS), house, date placed, birds sent. Ignores Complex, flock-code column, and far-right columns. Text PDFs on iPhone; scans need CSV/XLSX.";

  return (
    <Card>
      {Platform.OS === "web" ? (
        // @ts-expect-error web-only native input
        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_ACCEPT}
          style={{ display: "none" }}
          onChange={(e: { target: { files?: FileList | null } }) => {
            const file = e.target.files?.[0];
            if (file) void onWebFileSelected(file);
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {TYPE_OPTIONS.map((type) => {
          const active = importType === type.id;
          return (
            <Pressable
              key={type.id}
              onPress={() => {
                setImportType(type.id);
                setNote(null);
                clearPreview();
              }}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 4,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.accentDark : "#e7e5e4",
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: active ? "#fff" : colors.text,
                  textAlign: "center",
                }}
              >
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.muted, { marginBottom: 12, fontSize: 12 }]}>{helperText}</Text>

      <PrimaryButton label={busy ? "Working…" : "Upload & Read"} onPress={onUpload} />

      {note ? (
        <Text style={[styles.muted, { marginTop: 10, lineHeight: 18, color: colors.text }]}>
          {note}
        </Text>
      ) : null}

      {farms.length > 0 ? (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: "#e7e5e4", paddingTop: 12 }}>
          <View style={[styles.row, { justifyContent: "space-between", alignItems: "center" }]}>
            <Text style={{ fontWeight: "800", color: colors.text }}>
              {importType === "catch" ? "Choose farms to update" : "Choose farms to import"}
            </Text>
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

          {importType === "placement" ? (
            <View style={[styles.row, { marginTop: 8, gap: 14 }]}>
              <Pressable
                onPress={() => {
                  const next: Record<string, boolean> = {};
                  for (const farm of farms) next[farm.key] = true;
                  setSelected(next);
                  setOnlyMyFarms(false);
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.accentDark, fontSize: 12 }}>
                  Select all
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const next: Record<string, boolean> = {};
                  for (const farm of farms) next[farm.key] = false;
                  setSelected(next);
                  setOnlyMyFarms(false);
                }}
              >
                <Text style={{ fontWeight: "700", color: colors.muted, fontSize: 12 }}>
                  Clear
                </Text>
              </Pressable>
            </View>
          ) : null}

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
                      {farm.catchDates?.length ? ` · catch ${farm.catchDates.join(", ")}` : ""}
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
                            farm.matchKind === "fuzzy" || farm.nameDiffers
                              ? " (similar name)"
                              : ""
                          }`
                        : importType === "catch"
                          ? "No matching farm — will be skipped"
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
                      paddingHorizontal: 8,
                      paddingBottom: 8,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#fde68a",
                      backgroundColor: "#fffbeb",
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
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: colors.text,
                          lineHeight: 16,
                        }}
                      >
                        Will overwrite “{farm.matchName}” → “{farm.farmName}” (name, dates, birds)
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: colors.muted,
                          lineHeight: 14,
                        }}
                      >
                        Keeps grower, phone, houses, and other saved info.
                      </Text>
                    </View>
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
            <Pressable onPress={clearPreview} style={{ marginTop: 10, alignSelf: "center" }}>
              <Text style={{ fontWeight: "700", color: colors.muted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Card>
  );
}
