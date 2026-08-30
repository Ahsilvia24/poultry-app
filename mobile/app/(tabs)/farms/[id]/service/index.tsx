import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, styles } from "../../../../../src/theme";
import { BackHeader, Card, PrimaryButton } from "../../../../../src/components/ui";
import {
  deleteServiceFormDraft,
  listServiceFormDraftKinds,
  listServiceForms,
  type StoredServiceForm,
} from "../../../../../src/repos/data";
import type { AnyServiceForm, ServiceFormKind } from "../../../../../src/lib/serviceForms/types";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";
import { shareServiceFormPdf } from "../../../../../src/lib/serviceForms/sharePdf";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const FORMS = [
  {
    key: "service_report" as const,
    tab: "Service",
    title: "Service",
    path: "/(tabs)/farms/[id]/service/report" as const,
  },
  {
    key: "placement" as const,
    tab: "Placement",
    title: "Placement",
    path: "/(tabs)/farms/[id]/service/placement" as const,
  },
  {
    key: "prebrood" as const,
    tab: "Prebrood",
    title: "Prebrood",
    path: "/(tabs)/farms/[id]/service/prebrood" as const,
  },
] as const;

function kindTitle(kind: ServiceFormKind) {
  return FORMS.find((f) => f.key === kind)?.title ?? kind;
}

export default function ServiceFarmPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [draftKinds, setDraftKinds] = useState<ServiceFormKind[]>([]);
  const [completed, setCompleted] = useState<StoredServiceForm[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setDraftKinds(farmId ? listServiceFormDraftKinds(farmId) : []);
      } catch {
        setDraftKinds([]);
      }
      try {
        setCompleted(farmId ? listServiceForms(farmId) : []);
      } catch {
        setCompleted([]);
      }
    }, [farmId]),
  );

  function openForm(path: (typeof FORMS)[number]["path"], extra?: Record<string, string>) {
    router.push({
      pathname: path,
      params: { id: farmId, ...extra },
    });
  }

  function startKind(form: (typeof FORMS)[number], fresh = false) {
    openForm(form.path, fresh ? { fresh: "1" } : {});
  }

  function openSaved(row: StoredServiceForm) {
    const form = FORMS.find((f) => f.key === row.formKind);
    if (!form) return;
    openForm(form.path, { formId: row.id });
  }

  async function shareSaved(row: StoredServiceForm) {
    if (sharingId) return;
    const payload = row.payload;
    if (!payload || typeof payload !== "object") {
      setShareError("Could not open this PDF.");
      return;
    }
    setShareError(null);
    setSharingId(row.id);
    try {
      await shareServiceFormPdf({
        ...(payload as AnyServiceForm),
        kind: row.formKind,
      } as AnyServiceForm);
    } catch (e) {
      setShareError(e instanceof Error ? e.message : "Could not share PDF");
    } finally {
      setSharingId(null);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BackHeader
          backLabel="Farm"
          title="Service Farm"
          accessibilityLabel="Back to farm"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else
              router.replace({
                pathname: "/(tabs)/farms/[id]",
                params: { id: farmId },
              });
          }}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "stretch",
            gap: 6,
            marginBottom: 10,
          }}
        >
          {FORMS.map((form) => (
            <Pressable
              key={form.key}
              onPress={() => startKind(form)}
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 4,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.accentDark,
              }}
              accessibilityRole="button"
              accessibilityLabel={
                draftKinds.includes(form.key) ? `Resume ${form.title}` : `Start ${form.title}`
              }
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#fff",
                  textAlign: "center",
                }}
              >
                {form.tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {FORMS.filter((form) => draftKinds.includes(form.key)).map((form) => (
          <View
            key={`draft-${form.key}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <Text style={{ color: colors.muted, fontWeight: "600" }}>
              {form.title} in progress
            </Text>
            <Pressable
              onPress={() => {
                try {
                  deleteServiceFormDraft(farmId, form.key);
                } catch {
                  // Open a blank form even if delete fails.
                }
                setDraftKinds((prev) => prev.filter((k) => k !== form.key));
                startKind(form, true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Start over ${form.title}`}
            >
              <Text style={{ color: colors.accentDark, fontWeight: "700" }}>Start over</Text>
            </Pressable>
          </View>
        ))}

        <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text, marginTop: 14, marginBottom: 8 }}>
          Completed
        </Text>

        {shareError ? (
          <Text style={{ color: colors.danger, fontWeight: "600", marginBottom: 8 }}>{shareError}</Text>
        ) : null}

        {completed.length === 0 ? (
          <Text style={{ color: colors.muted }}>No completed checklists yet.</Text>
        ) : (
          completed.map((row) => (
            <Card key={row.id} style={{ marginBottom: 10, paddingVertical: 12, paddingHorizontal: 14 }}>
              <Pressable
                onPress={() => openSaved(row)}
                accessibilityRole="button"
                accessibilityLabel={`View or edit ${kindTitle(row.formKind)} ${formatServiceShortDate(row.formDate)}`}
              >
                <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                  {kindTitle(row.formKind)}
                </Text>
                <Text style={{ marginTop: 2, color: colors.muted, fontWeight: "600" }}>
                  {formatServiceShortDate(row.formDate)}
                </Text>
              </Pressable>
              <PrimaryButton
                label={sharingId === row.id ? "Sharing…" : "Share PDF"}
                secondary
                onPress={() => void shareSaved(row)}
                style={{ marginTop: 10 }}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
