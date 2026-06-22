export type ViewMode = "list" | "map";

interface HeaderProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

export default function Header({ view, onViewChange, query, onQueryChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex items-center justify-center gap-2 py-2.5">
          <span className="text-xl" aria-hidden>
            🌾
          </span>
          <h1 className="text-lg font-extrabold text-brand-800">עסקים בלכיש</h1>
        </div>

        <div className="flex items-center gap-2 pb-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-gray-400" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="חיפוש עסק, תיאור, קטגוריה..."
              className="w-full rounded-full border border-gray-300 bg-gray-50 py-2 pe-9 ps-9 text-sm outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="ניקוי חיפוש"
                className="absolute inset-y-0 end-2 flex items-center text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>
    </header>
  );
}

function ViewToggle({ view, onViewChange }: { view: ViewMode; onViewChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex shrink-0 rounded-full bg-gray-100 p-1 text-sm font-medium">
      <ToggleButton active={view === "list"} onClick={() => onViewChange("list")} label="רשימה" icon="☰" />
      <ToggleButton active={view === "map"} onClick={() => onViewChange("map")} label="מפה" icon="🗺️" />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
        active ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
      }`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
