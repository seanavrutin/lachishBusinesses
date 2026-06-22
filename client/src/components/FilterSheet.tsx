import { styleForCategory } from "../lib/categories";

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  categories: string[];
  selected: Set<string>;
  onToggleCategory: (category: string) => void;
  moshavim: string[];
  moshav: string | null;
  onMoshavChange: (moshav: string | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onClearAll: () => void;
  resultCount: number;
}

export default function FilterSheet(props: FilterSheetProps) {
  const { open, onClose } = props;
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={onClose} />
      <div className="animate-sheet-up relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-800">סינון עסקים</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="סגירה"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-600">חיפוש</label>
            <input
              type="search"
              value={props.query}
              onChange={(e) => props.onQueryChange(e.target.value)}
              placeholder="שם עסק, תיאור..."
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {props.moshavim.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">מושב / יישוב</label>
              <select
                value={props.moshav ?? ""}
                onChange={(e) => props.onMoshavChange(e.target.value || null)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">כל היישובים</option>
                {props.moshavim.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-600">קטגוריות</label>
            <div className="flex flex-wrap gap-2">
              {props.categories.map((category) => {
                const { emoji } = styleForCategory(category);
                const active = props.selected.has(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => props.onToggleCategory(category)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span aria-hidden>{emoji}</span>
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={props.onClearAll}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            ניקוי
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            הצגת {props.resultCount} תוצאות
          </button>
        </div>
      </div>
    </div>
  );
}
