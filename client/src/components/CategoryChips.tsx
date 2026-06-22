import { styleForCategory } from "../lib/categories";

interface CategoryChipsProps {
  categories: string[];
  selected: Set<string>;
  onToggle: (category: string) => void;
  onClear: () => void;
}

export default function CategoryChips({ categories, selected, onToggle, onClear }: CategoryChipsProps) {
  if (categories.length === 0) return null;
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
      <Chip active={selected.size === 0} onClick={onClear} label="הכול" emoji="✨" />
      {categories.map((category) => {
        const { emoji } = styleForCategory(category);
        return (
          <Chip
            key={category}
            active={selected.has(category)}
            onClick={() => onToggle(category)}
            label={category}
            emoji={emoji}
          />
        );
      })}
    </div>
  );
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
