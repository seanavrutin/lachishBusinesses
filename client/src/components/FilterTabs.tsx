import { useState } from "react";
import { styleForCategory } from "../lib/categories";

interface FilterTabsProps {
  categories: string[];
  selected: Set<string>;
  onToggleCategory: (category: string) => void;
  onClearCategories: () => void;
  moshavim: string[];
  moshav: string | null;
  onMoshavChange: (moshav: string | null) => void;
}

type Tab = "categories" | "moshavim";

export default function FilterTabs(props: FilterTabsProps) {
  const [tab, setTab] = useState<Tab | null>(null);
  const toggle = (t: Tab) => setTab((cur) => (cur === t ? null : t));

  return (
    <div className="border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-3xl px-4">
        <div className="flex gap-2 py-3">
          <TabButton
            label="קטגוריות"
            emoji="🏷️"
            open={tab === "categories"}
            count={props.selected.size}
            onClick={() => toggle("categories")}
          />
          <TabButton
            label="מושבים"
            emoji="📍"
            open={tab === "moshavim"}
            count={props.moshav ? 1 : 0}
            onClick={() => toggle("moshavim")}
          />
        </div>

        {tab === "categories" && props.categories.length > 0 && (
          <ChipRow>
            <Chip active={props.selected.size === 0} onClick={props.onClearCategories} label="הכול" emoji="✨" />
            {props.categories.map((category) => {
              const { emoji } = styleForCategory(category);
              return (
                <Chip
                  key={category}
                  active={props.selected.has(category)}
                  onClick={() => props.onToggleCategory(category)}
                  label={category}
                  emoji={emoji}
                />
              );
            })}
          </ChipRow>
        )}

        {tab === "moshavim" && props.moshavim.length > 0 && (
          <ChipRow>
            <Chip active={!props.moshav} onClick={() => props.onMoshavChange(null)} label="הכול" emoji="✨" />
            {props.moshavim.map((m) => (
              <Chip
                key={m}
                active={props.moshav === m}
                onClick={() => props.onMoshavChange(props.moshav === m ? null : m)}
                label={m}
                emoji="📍"
              />
            ))}
          </ChipRow>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  emoji,
  open,
  count,
  onClick,
}: {
  label: string;
  emoji: string;
  open: boolean;
  count: number;
  onClick: () => void;
}) {
  const highlighted = open || count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
        highlighted
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span aria-hidden>{emoji}</span>
      {label}
      {count > 0 && (
        <span className="grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brand-600 px-1 text-[0.65rem] font-bold text-white">
          {count}
        </span>
      )}
      <span className={`text-xs text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
        ▾
      </span>
    </button>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar flex gap-2 overflow-x-auto pb-3">{children}</div>;
}

function Chip({
  active,
  onClick,
  label,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white shadow-sm"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}
