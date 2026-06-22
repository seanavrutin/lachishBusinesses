import type { Business, BusinessListResponse } from "../types";

/**
 * Base URL of the server API. Configure via VITE_API_BASE_URL (e.g. the public
 * tunnel URL in production, or http://localhost:3005 in dev). Trailing slashes
 * are trimmed so we can safely append paths.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3005").replace(/\/+$/, "");

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

export async function fetchBusinesses(signal?: AbortSignal): Promise<Business[]> {
  const data = await getJson<BusinessListResponse>("/api/businesses", { signal });
  return data.businesses ?? [];
}

export async function fetchBusiness(id: string, signal?: AbortSignal): Promise<Business> {
  return getJson<Business>(`/api/businesses/${encodeURIComponent(id)}`, { signal });
}
