import { getMeta, setMeta } from "../db/database";

const SERVICE_TECH_KEY = "service_tech";

export function getServiceTech(): string {
  return getMeta(SERVICE_TECH_KEY)?.trim() ?? "";
}

export function setServiceTech(name: string) {
  setMeta(SERVICE_TECH_KEY, name.trim());
}

/** Use the saved Settings name when a checklist field is still empty. */
export function withSavedServiceTech<T extends { serviceTech: string }>(form: T): T {
  if (form.serviceTech.trim()) return form;
  const saved = getServiceTech();
  return saved ? { ...form, serviceTech: saved } : form;
}
