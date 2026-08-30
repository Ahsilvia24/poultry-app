import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  allowServiceFormDraftSave,
  blockServiceFormDraftSave,
  completeServiceForm,
  deleteServiceFormDraft,
  getFarmDetail,
  getServiceFormById,
  getServiceFormDraft,
  getServiceFormForVisit,
  getVisit,
  saveServiceFormDraft,
  type StoredServiceForm,
} from "../../repos/data";
import { applyLiveHouseMetrics } from "./prefill";
import type { AnyServiceForm, ServiceFormKind, ServiceHouseRow } from "./types";
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

export function useEditVisitIdParam(farmId?: string): string | null {
  const params = useLocalSearchParams<{ visitId?: string | string[] }>();
  const visitId = paramId(params.visitId);
  return useMemo(() => {
    if (!visitId) return null;
    if (!farmId) return visitId;
    try {
      getVisit(farmId, visitId);
      return visitId;
    } catch {
      return null;
    }
  }, [farmId, visitId]);
}

export function useCompleteServiceForm(farmId: string, opts?: {
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const router = useRouter();
  const params = useLocalSearchParams<{ formId?: string | string[] }>();
  const routeFormId = paramId(params.formId);
  const serviceFormId = opts?.serviceFormId || routeFormId || null;
  const liveVisitId = useEditVisitIdParam(farmId);
  const existingVisitId = serviceFormId ? null : opts?.existingVisitId || liveVisitId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(serviceFormId);

  async function complete(input: {
    form: AnyServiceForm;
    generatorHours?: number | null;
  }) {
    if (saving) return;
    blockServiceFormDraftSave(farmId, input.form.kind);
    setSaving(true);
    setError(null);
    try {
      let form = input.form;
      try {
        form = applyLiveHouseMetrics(form, getFarmDetail(farmId));
      } catch {
        // Save the in-memory form if farm detail cannot load.
      }
      completeServiceForm({
        farmId,
        formKind: form.kind,
        formDate: form.date?.trim() || "",
        payload: form,
        visitNotes: form.comments?.trim() || null,
        generatorHours: input.generatorHours ?? null,
        serviceFormId,
        existingVisitId,
      });
      try {
        deleteServiceFormDraft(farmId, input.form.kind);
      } catch {
        // Completed form is already saved.
      }
      try {
        await shareServiceFormPdf(form);
      } catch {
        // Visit is saved even if share sheet fails / is dismissed.
      }
      try {
        deleteServiceFormDraft(farmId, form.kind);
      } catch {
        // Draft should already be gone.
      }
      router.replace({
        pathname: "/(tabs)/farms/[id]/service",
        params: { id: farmId },
      });
    } catch (e) {
      allowServiceFormDraftSave(farmId, input.form.kind);
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

/** On resume, pull latest logged temps and mortality into a draft. */
export function useRefreshDraftHouseMetrics<T extends { houses: ServiceHouseRow[] }>(
  farmId: string,
  enabled: boolean,
  setForm: Dispatch<SetStateAction<T>>,
) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !farmId) return;
      try {
        const latest = getFarmDetail(farmId);
        setForm((prev) => applyLiveHouseMetrics(prev, latest));
      } catch {
        // Keep the draft as-is if farm detail cannot load.
      }
    }, [enabled, farmId, setForm]),
  );
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
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (farmId) allowServiceFormDraftSave(farmId, kind);
  }, [farmId, kind]);

  useEffect(() => {
    if (!enabled || !farmId) return;
    const t = setTimeout(() => {
      if (!enabledRef.current) return;
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
        if (!enabledRef.current || !farmId) return;
        try {
          saveServiceFormDraft(farmId, kind, formRef.current);
        } catch {
          // Offline draft is best-effort.
        }
      };
    }, [farmId, kind]),
  );
}
