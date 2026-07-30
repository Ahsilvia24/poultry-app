import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  completeServiceForm,
  getFarmDetail,
  getServiceFormById,
  getServiceFormForVisit,
  type StoredServiceForm,
} from "../../repos/data";
import type { AnyServiceForm, ServiceFormKind } from "./types";
import { shareServiceFormPdf } from "./sharePdf";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function useServiceFarmContext(farmId: string) {
  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  // Placement / Prebrood flock boxes are narrow — only the first active flock.
  // (activeFlock.flockNumber may join multiples with " · " for other screens.)
  const firstFlockNumber =
    detail?.activeFlocks?.[0]?.flockNumber ??
    detail?.activeFlock?.flockNumber?.split(/\s*·\s*/)[0]?.trim() ??
    "";

  return {
    detail,
    farmName: detail?.farm.farmName ?? "Farm",
    flockNumber: detail?.activeFlock?.flockNumber ?? "",
    firstFlockNumber,
  };
}

/** Resolve an existing saved checklist from route params (`formId` or `visitId`). */
export function useExistingServiceForm(
  farmId: string,
  expectedKind: ServiceFormKind,
): StoredServiceForm | null {
  const params = useLocalSearchParams<{
    formId?: string | string[];
    visitId?: string | string[];
  }>();
  const formId = paramId(params.formId);
  const visitId = paramId(params.visitId);

  return useMemo(() => {
    try {
      const row = formId
        ? getServiceFormById(farmId, formId)
        : visitId
          ? getServiceFormForVisit(farmId, visitId)
          : null;
      if (!row || row.formKind !== expectedKind) return null;
      return row;
    } catch {
      return null;
    }
  }, [farmId, formId, visitId, expectedKind]);
}

export function useEditVisitIdParam(): string | null {
  const params = useLocalSearchParams<{ visitId?: string | string[] }>();
  const visitId = paramId(params.visitId);
  return visitId || null;
}

export function useCompleteServiceForm(farmId: string, opts?: {
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const editing = Boolean(opts?.serviceFormId);

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
        serviceFormId: opts?.serviceFormId ?? null,
        existingVisitId: opts?.serviceFormId ? null : opts?.existingVisitId ?? null,
      });
      try {
        await shareServiceFormPdf(input.form);
      } catch {
        // Visit is saved even if share sheet fails / is dismissed.
      }
      Alert.alert(
        "Saved",
        editing
          ? "Changes saved. Use the share sheet to Save to Files, AirDrop, or email the PDF."
          : "Visit logged. Use the share sheet to Save to Files, AirDrop, or email the PDF.",
        [
          {
            text: editing || opts?.existingVisitId ? "Done" : "Back to farm",
            onPress: () => {
              if (editing || opts?.existingVisitId) {
                if (router.canGoBack()) router.back();
                else
                  router.replace({
                    pathname: "/(tabs)/farms/[id]",
                    params: { id: farmId },
                  });
                return;
              }
              router.replace({
                pathname: "/(tabs)/farms/[id]",
                params: { id: farmId },
              });
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving, editing };
}
