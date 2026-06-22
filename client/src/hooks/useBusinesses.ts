import { useCallback, useEffect, useState } from "react";
import { fetchBusinesses, getCachedBusinesses } from "../lib/api";
import type { Business } from "../types";

interface BusinessesState {
  businesses: Business[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useBusinesses(): BusinessesState {
  const [businesses, setBusinesses] = useState<Business[]>(() => getCachedBusinesses() ?? []);
  const [loading, setLoading] = useState(() => getCachedBusinesses() == null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // reload() forces a fresh server fetch (e.g. pull-to-refresh / retry button).
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const force = nonce > 0;
    const cached = getCachedBusinesses();
    if (!force && cached) {
      setBusinesses(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchBusinesses(controller.signal, force)
      .then((data) => setBusinesses(data))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [nonce]);

  return { businesses, loading, error, reload };
}

/** Distinct categories across all businesses, ordered by frequency. */
export function deriveCategories(businesses: Business[]): string[] {
  const counts = new Map<string, number>();
  for (const b of businesses) {
    for (const c of b.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
