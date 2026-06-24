import { useRef, useState } from "react";
import { useAdmin } from "../context/AdminContext";

export type ViewMode = "list" | "map";

interface HeaderProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  query: string;
  onQueryChange: (q: string) => void;
}

const UNLOCK_TAPS = 5;

export default function Header({ view, onViewChange, query, onQueryChange }: HeaderProps) {
  const { isAdmin, signIn, signOut } = useAdmin();
  const [promptOpen, setPromptOpen] = useState(false);
  const taps = useRef(0);
  const tapTimer = useRef<number | null>(null);

  // Secret unlock: tap the title a few times quickly to reveal the token prompt.
  const handleTitleTap = () => {
    if (isAdmin) return;
    taps.current += 1;
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      taps.current = 0;
    }, 1200);
    if (taps.current >= UNLOCK_TAPS) {
      taps.current = 0;
      setPromptOpen(true);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4">
        <div
          className="flex select-none items-center justify-center gap-2 py-2.5"
          onClick={handleTitleTap}
        >
          <span className="text-xl" aria-hidden>
            🌾
          </span>
          <h1 className="text-lg font-extrabold text-brand-800">עסקים בלכיש</h1>
        </div>

        {isAdmin && (
          <div className="mb-2 flex items-center justify-center gap-2 text-xs">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-amber-200">
              מצב ניהול פעיל
            </span>
            <button type="button" onClick={signOut} className="font-medium text-gray-500 hover:text-gray-700">
              יציאה
            </button>
          </div>
        )}

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

      {promptOpen && <AdminPrompt onClose={() => setPromptOpen(false)} onSubmit={signIn} />}
    </header>
  );
}

function AdminPrompt({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (token: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await onSubmit(value);
    setBusy(false);
    if (ok) onClose();
    else setError("טוקן שגוי");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl"
      >
        <h2 className="mb-3 text-center text-base font-bold text-gray-800">כניסת מנהל</h2>
        <input
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="טוקן ניהול"
          dir="ltr"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "בודק..." : "כניסה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
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
