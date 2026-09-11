import type { OfflineFormWrite, OfflineFormWriteAction } from "@/lib/offline/types";

export function formDataToParts(formData: FormData) {
  const counts = new Map<string, number>();
  for (const [key] of formData.entries()) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const fields: Record<string, string> = {};
  const listFields: Record<string, string[]> = {};
  for (const [key, value] of formData.entries()) {
    const text = String(value);
    if ((counts.get(key) ?? 0) > 1) {
      listFields[key] = [...(listFields[key] ?? []), text];
    } else {
      fields[key] = text;
    }
  }
  return { fields, listFields };
}

export function writeToFormData(write: OfflineFormWrite): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(write.fields ?? {})) {
    formData.set(key, value);
  }
  for (const [key, values] of Object.entries(write.listFields ?? {})) {
    for (const value of values) formData.append(key, value);
  }
  return formData;
}

export function localRecordId() {
  return `local-${crypto.randomUUID()}`;
}

export function isLocalRecordId(id: string | undefined) {
  return Boolean(id?.startsWith("local-"));
}

export function formWrite(
  action: OfflineFormWriteAction,
  options: Omit<OfflineFormWrite, "action"> = {},
): OfflineFormWrite {
  return { action, ...options };
}
