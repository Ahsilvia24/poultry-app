"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeServiceFormAction,
  saveServiceFormDraftAction,
} from "@/app/actions/serviceForms";
import { shareServiceFormPdf } from "@/lib/serviceForms/sharePdf";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";

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
    if (!enabled || !farmId) return;
    const t = setTimeout(() => {
      if (!enabledRef.current) return;
      void saveServiceFormDraftAction({
        farmId,
        formKind: kind,
        payload: formRef.current,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, farmId, kind, form]);
}

export function useCompleteServiceForm(
  farmId: string,
  opts: { serviceFormId?: string | null; existingVisitId?: string | null },
) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(opts.serviceFormId);

  async function complete(form: AnyServiceForm) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await completeServiceFormAction({
        farmId,
        form,
        serviceFormId: opts.serviceFormId,
        existingVisitId: opts.existingVisitId,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      try {
        await shareServiceFormPdf(form);
      } catch {
        // Visit is saved even if the download is dismissed.
      }
      router.push(`/farms/${farmId}/service`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving, editing, error };
}
