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
      const result = await completeServiceFormAction({
        farmId,
        formKind: input.form.kind,
        formDate: input.form.date,
        payload: input.form,
        visitNotes: input.form.comments?.trim() || null,
        generatorHours: input.generatorHours ?? null,
        serviceFormId: opts?.serviceFormId ?? null,
        existingVisitId: opts?.serviceFormId ? null : opts?.existingVisitId ?? null,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      try {
        const pdf = await buildServiceFormPdf(input.form);
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
