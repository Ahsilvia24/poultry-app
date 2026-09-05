import Constants from "expo-constants";

type Extra = { apiUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Optional baked-in website origin. Runtime login can override this. */
export const DEFAULT_API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || "",
).replace(/\/$/, "");

export function isCloudUrl(url: string | null | undefined): url is string {
  return Boolean(url && /^https?:\/\//i.test(url));
}

/** True when a default cloud API is compiled in (skip demo seed). */
export const IS_OFFLINE = !isCloudUrl(DEFAULT_API_BASE_URL);

/** @deprecated Use getApiBaseUrl() — kept so older imports compile. */
export const API_BASE_URL = DEFAULT_API_BASE_URL || "offline://local";
