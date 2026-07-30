import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { completeServiceForm, getFarmDetail } from "../../repos/data";
import type { AnyServiceForm } from "./types";
import { shareServiceFormPdf } from "./sharePdf";

export function useServiceFarmContext(farmId: string) {
  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  return {
    detail,
    farmName: detail?.farm.farmName ?? "Farm",
    flockNumber: detail?.activeFlock?.flockNumber ?? "",
  };
}

export function useCompleteServiceForm(farmId: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function complete(input: {
    form: AnyServiceForm;
    generatorHours?: number | null;
  }) {
    if (saving) return;
    setSaving(true);
    try {
      completeServiceForm({
        farmId,
        formKind: input.form.kind,
        formDate: input.form.date,
        payload: input.form,
        visitNotes: input.form.comments?.trim() || null,
        generatorHours: input.generatorHours ?? null,
      });
      try {
        await shareServiceFormPdf(input.form);
      } catch {
        // Visit is saved even if share sheet fails / is dismissed.
      }
      Alert.alert(
        "Saved",
        "Visit logged. Use the share sheet to Save to Files, AirDrop, or email the PDF.",
        [
          {
            text: "Back to farm",
            onPress: () =>
              router.replace({
                pathname: "/(tabs)/farms/[id]",
                params: { id: farmId },
              }),
          },
        ],
      );
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving };
}
