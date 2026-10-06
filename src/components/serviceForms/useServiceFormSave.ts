"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOfflineNav } from "@/components/OfflineNavContext";
import { formWrite, localRecordId } from "@/lib/offline/formPairs";
import { useReplicaWrite } from "@/lib/offline/useReplicaWrite";
import { shareServiceFormPdf } from "@/lib/serviceForms/sharePdf";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";

export function useServiceFormSave(
  farmId: string,
  kind: ServiceFormKind,
  form: AnyServiceForm,
  opts: {
    serviceFormId?: string | null;
    existingVisitId?: string | null;
    autosave: boolean;
  },
) {
  const router = useRouter();
  const nav = useOfflineNav();
  const { enabled, queue } = useReplicaWrite();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(opts.serviceFormId);
  const sealed = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;
  const autosaveRef = useRef(opts.autosave);
  autosaveRef.current = opts.autosave && !sealed.current;

  useEffect(() => {
    if (!opts.autosave || sealed.current || !farmId) return;
    const t = setTimeout(() => {
      if (sealed.current || !autosaveRef.current) return;
      queue(
        formWrite("saveServiceDraft", {
          farmId,
          fields: { formKind: kind },
          extra: formRef.current,
        }),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [opts.autosave, farmId, kind, form, queue]);

  async function complete(next: AnyServiceForm) {
    if (saving || sealed.current) return;
    sealed.current = true;
    setSaving(true);
    setError(null);
    try {
      const wrote = queue(
        formWrite("completeServiceForm", {
          id: opts.serviceFormId ?? localRecordId(),
          farmId,
          fields: {
            formKind: kind,
            ...(opts.existingVisitId ? { existingVisitId: opts.existingVisitId } : {}),
          },
          extra: next,
        }),
      );
      if (!wrote) {
        sealed.current = false;
        setError("This checklist is not on the phone yet.");
        return;
      }
      try {
        await shareServiceFormPdf(next);
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
      sealed.current = false;
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return { complete, saving, editing, error, enabled };
}
