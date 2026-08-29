import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  completeServiceForm,
  deleteServiceFormDraft,
  getFarmDetail,
  getServiceFormById,
  getServiceFormDraft,
  getServiceFormForVisit,
  saveServiceFormDraft,
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
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(opts?.serviceFormId);

  async function complete(input: {
    form: AnyServiceForm;
    generatorHours?: number | null;
  }) {
    if (saving) return;
    setSaving(true);
    setError(null);
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
        deleteServiceFormDraft(farmId, input.form.kind);
      } catch {
        // Completed form is already saved.
      }
      try {
        await shareServiceFormPdf(input.form);
      } catch {
        // Visit is saved even if share sheet fails / is dismissed.
      }
      if (editing || opts?.existingVisitId) {
        if (router.canGoBack()) router.back();
        else
          router.replace({
            pathname: "/(tabs)/farms/[id]",
            params: { id: farmId },
          });
      } else {
        router.replace({
          pathname: "/(tabs)/farms/[id]",
          params: { id: farmId },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving, editing, error };
}

export function readInProgressDraft<T>(
  farmId: string,
  kind: ServiceFormKind,
  fresh: boolean,
): T | null {
  if (fresh || !farmId) return null;
  try {
    const payload = getServiceFormDraft(farmId, kind);
    if (!payload || typeof payload !== "object") return null;
    return payload as T;
  } catch {
    return null;
  }
}

/** Auto-save an in-progress checklist so leaving the screen does not lose it. */
export function useAutosaveServiceFormDraft(
  farmId: string,
  kind: ServiceFormKind,
  form: AnyServiceForm,
  enabled: boolean,
) {
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    if (!enabled || !farmId) return;
    const t = setTimeout(() => {
      try {
        saveServiceFormDraft(farmId, kind, formRef.current);
      } catch {
        // Offline draft is best-effort.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, farmId, kind, form]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!enabled || !farmId) return;
        try {
          saveServiceFormDraft(farmId, kind, formRef.current);
        } catch {
          // Offline draft is best-effort.
        }
      };
    }, [enabled, farmId, kind]),
  );
}
