"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeServiceFormAction } from "@/app/actions/serviceForms";
import {
  buildServiceFormPdf,
  downloadServiceFormPdf,
} from "@/lib/serviceForms/pdfFill";
import type { AnyServiceForm } from "@/lib/serviceForms/types";

export function useCompleteServiceForm(
  farmId: string,
  formKind: AnyServiceForm["kind"],
  opts?: {
    serviceFormId?: string | null;
    existingVisitId?: string | null;
  },
) {
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
      // Force kind from the screen (service_report / placement / prebrood)
      // so the visit is always logged as Routine Service / Placement / Prebrood.
      const form = { ...input.form, kind: formKind } as AnyServiceForm;
      const result = await completeServiceFormAction({
        farmId,
        formKind,
        formDate: form.date,
        payload: form,
        visitNotes: form.comments?.trim() || null,
        generatorHours: input.generatorHours ?? null,
        serviceFormId: opts?.serviceFormId ?? null,
        existingVisitId: opts?.serviceFormId ? null : opts?.existingVisitId ?? null,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      try {
        const pdf = await buildServiceFormPdf(form);
        downloadServiceFormPdf(pdf);
      } catch {
        // Visit is saved even if PDF download fails.
      }
      router.push(`/farms/${farmId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving, editing, error };
}
