import { useMemo, useState } from "react";
import Header, { type ViewMode } from "../components/Header";
import CategoryChips from "../components/CategoryChips";
import FilterSheet from "../components/FilterSheet";
import BusinessList from "../components/BusinessList";
import MapView from "../components/MapView";
import { Spinner } from "../components/ui";
import { deriveCategories, useBusinesses } from "../hooks/useBusinesses";
import type { Business } from "../types";

function matchesQuery(b: Business, needle: string): boolean {
  if (!needle) return true;
  const haystack = [b.name, b.description, b.location?.raw, b.location?.moshav, ...(b.categories ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

export default function HomePage() {
  const { businesses, loading, error, reload } = useBusinesses();
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moshav, setMoshav] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const categories = useMemo(() => deriveCategories(businesses), [businesses]);
  const moshavim = useMemo(
    () =>
      [...new Set(businesses.map((b) => b.location?.moshav).filter((m): m is string => !!m))].sort((a, b) =>
        a.localeCompare(b, "he"),
      ),
    [businesses],
  );

  const filtered = useMemo(
    () =>
      businesses.filter((b) => {
        const catOk = selected.size === 0 || (b.categories ?? []).some((c) => selected.has(c));
        const moshavOk = !moshav || b.location?.moshav === moshav;
        return catOk && moshavOk && matchesQuery(b, query);
      }),
    [businesses, selected, moshav, query],
  );

  const toggleCategory = (category: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const clearAll = () => {
    setSelected(new Set());
    setMoshav(null);
    setQuery("");
  };

  const activeFilterCount = selected.size + (moshav ? 1 : 0) + (query ? 1 : 0);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <Header
        view={view}
        onViewChange={setView}
        onOpenFilters={() => setSheetOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-3xl">
          <CategoryChips
            categories={categories}
            selected={selected}
            onToggle={toggleCategory}
            onClear={() => setSelected(new Set())}
          />
        </div>
      </div>

      <main className="relative min-h-0 flex-1">
        {loading ? (
          <Spinner label="טוען עסקים..." />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
            <div className="text-4xl">📡</div>
            <p className="font-semibold text-gray-700">לא ניתן לטעון את העסקים</p>
            <p className="max-w-sm text-sm text-gray-500">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700"
            >
              נסו שוב
            </button>
          </div>
        ) : view === "list" ? (
          <div className="h-full overflow-y-auto">
            <BusinessList businesses={filtered} />
          </div>
        ) : (
          <MapView businesses={filtered} />
        )}
      </main>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        categories={categories}
        selected={selected}
        onToggleCategory={toggleCategory}
        moshavim={moshavim}
        moshav={moshav}
        onMoshavChange={setMoshav}
        query={query}
        onQueryChange={setQuery}
        onClearAll={clearAll}
        resultCount={filtered.length}
      />
    </div>
  );
}
