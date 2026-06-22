export type ViewMode = "list" | "map";

interface HeaderProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

export default function Header({ view, onViewChange, onOpenFilters, activeFilterCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌾</span>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold text-brand-800">עסקים בלכיש</h1>
            <p className="text-[0.7rem] text-gray-500">עסקים מקומיים באזור</p>
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <ViewToggle view={view} onViewChange={onViewChange} />
          <button
            type="button"
            onClick={onOpenFilters}
            className="relative inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <span>סינון</span>
            <span aria-hidden>⚙️</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -start-1.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[0.65rem] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

function ViewToggle({ view, onViewChange }: { view: ViewMode; onViewChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-full bg-gray-100 p-1 text-sm font-medium">
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
