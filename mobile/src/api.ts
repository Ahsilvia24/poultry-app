import { deleteSessionItem, getSessionItem, setSessionItem } from "./lib/sessionStore";
import { DEFAULT_API_BASE_URL, isCloudUrl } from "./config";

const TOKEN_KEY = "poultrytech_mobile_token";
const API_URL_KEY = "poultrytech_api_url";

export async function saveToken(token: string) {
  await setSessionItem(TOKEN_KEY, token);
}

export async function getToken() {
  return getSessionItem(TOKEN_KEY);
}

export async function clearToken() {
  await deleteSessionItem(TOKEN_KEY);
}

export async function getApiBaseUrl(): Promise<string> {
  const stored = (await getSessionItem(API_URL_KEY))?.trim().replace(/\/$/, "") ?? "";
  if (isCloudUrl(stored)) return stored;
  return DEFAULT_API_BASE_URL;
}

export async function setApiBaseUrl(url: string) {
  const cleaned = url.trim().replace(/\/$/, "");
  if (!cleaned) {
    await deleteSessionItem(API_URL_KEY);
    return;
  }
  await setSessionItem(API_URL_KEY, cleaned);
}

export async function isCloudMode() {
  return isCloudUrl(await getApiBaseUrl());
}

type ApiOptions = RequestInit & { auth?: boolean };

export async function api<T>(path: string, options?: ApiOptions): Promise<T> {
  const base = await getApiBaseUrl();
  if (!isCloudUrl(base)) {
    throw new Error("Enter the website address so this phone can share farms with the web app.");
  }
  const token = options?.auth === false ? null : await getToken();
  const headers = new Headers(options?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (options?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text.slice(0, 180) };
    }
  }
  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new Error(err);
  }
  return data as T;
}
