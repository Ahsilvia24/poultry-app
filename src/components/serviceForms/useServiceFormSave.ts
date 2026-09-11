"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeServiceFormAction,
  saveServiceFormDraftAction,
} from "@/app/actions/serviceForms";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { shareServiceFormPdf } from "@/lib/serviceForms/sharePdf";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";

export function useAutosaveServiceFormDraft(
  farmId: string,
  kind: ServiceFormKind,
  form: AnyServiceForm,
  enabled: boolean,
) {
  const { enabled: replica, queue } = useReplicaWrite();
  const formRef = useRef(form);
  formRef.current = form;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || !farmId) return;
    const t = setTimeout(() => {
      if (!enabledRef.current) return;
      if (replica) {
        queue(
          formWrite("saveServiceDraft", {
            farmId,
            fields: { formKind: kind },
            extra: formRef.current,
          }),
        );
        return;
      }
      void saveServiceFormDraftAction({
        farmId,
        formKind: kind,
        payload: formRef.current,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [enabled, farmId, kind, form, replica, queue]);
}

export function useCompleteServiceForm(
  farmId: string,
  opts: { serviceFormId?: string | null; existingVisitId?: string | null },
) {
  const router = useRouter();
  const nav = useOfflineNav();
  const { enabled, queue } = useReplicaWrite();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(opts.serviceFormId);

  async function complete(form: AnyServiceForm) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      if (enabled) {
        queue(
          formWrite("completeServiceForm", {
            id: opts.serviceFormId ?? localRecordId(),
            farmId,
            fields: opts.existingVisitId ? { existingVisitId: opts.existingVisitId } : undefined,
            extra: form,
          }),
        );
      } else {
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
      }
      try {
        await shareServiceFormPdf(form);
      } catch {
        // Visit is saved even if the download is dismissed.
      }
      const href = `/farms/${farmId}/service`;
      if (nav) nav.navigate(href);
      else {
        router.push(href);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving, editing, error };
}
