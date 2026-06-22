/**
 * Categories arrive as free-form Hebrew strings from the extraction model, so we
 * map them to an icon + color by matching keywords rather than exact equality.
 */
export interface CategoryStyle {
  emoji: string;
  color: string;
}

interface CategoryRule extends CategoryStyle {
  keywords: string[];
}

const RULES: CategoryRule[] = [
  { keywords: ["מאפי", "לחם", "קונדיטור", "עוג", "קינוח", "מתוק", "טאבון"], emoji: "🥐", color: "#d97706" },
  { keywords: ["יקב", "יין"], emoji: "🍷", color: "#9d174d" },
  { keywords: ["קפה", "מסעד", "אוכל", "מטבח", "אירוח", "ביסטרו", "פיצ"], emoji: "🍽️", color: "#ea580c" },
  { keywords: ["מספר", "תספורת", "שיער", "יופי", "קוסמטיק", "ציפורני", "איפור", "גבות"], emoji: "💇", color: "#db2777" },
  { keywords: ["אינסטלט", "חשמל", "שיפוצ", "נגר", "מסגר", "צבע", "איטום", "מיזוג"], emoji: "🔧", color: "#475569" },
  { keywords: ["גן ", "גני", "ילד", "חינוך", "צהרון", "משפחתון", "פעוט"], emoji: "🧸", color: "#7c3aed" },
  { keywords: ["בריאות", "רפוא", "קליניק", "טיפול", "פיזיו", "נטורופ", "עיסוי", "רפלקס"], emoji: "🩺", color: "#0d9488" },
  { keywords: ["מכולת", "סופר", "חנות", "מרכול", "ירק", "פיר"], emoji: "🛒", color: "#16a34a" },
  { keywords: ["חקלא", "משק", "חווה", "דבש", "ביצים", "תוצרת"], emoji: "🌿", color: "#65a30d" },
  { keywords: ["בגד", "אופנ", "טקסטיל", "תכשיט", "נעלי"], emoji: "👗", color: "#c026d3" },
  { keywords: ["ספורט", "כושר", "יוגה", "פילאטיס", "אימון"], emoji: "🏋️", color: "#2563eb" },
  { keywords: ["צילום", "אומנות", "אמנות", "יצירה", "סדנ"], emoji: "🎨", color: "#7c3aed" },
  { keywords: ["חיות", "כלב", "וטרינ"], emoji: "🐾", color: "#a16207" },
  { keywords: ["רכב", "מוסך", "צמיג"], emoji: "🚗", color: "#334155" },
];

const DEFAULT_STYLE: CategoryStyle = { emoji: "🏪", color: "#15803d" };

export function styleForCategory(category: string): CategoryStyle {
  const rule = RULES.find((r) => r.keywords.some((k) => category.includes(k)));
  return rule ? { emoji: rule.emoji, color: rule.color } : DEFAULT_STYLE;
}

/** Picks the most representative style for a business from its category list. */
export function styleForBusiness(categories: string[]): CategoryStyle {
  for (const category of categories) {
    const rule = RULES.find((r) => r.keywords.some((k) => category.includes(k)));
    if (rule) return { emoji: rule.emoji, color: rule.color };
  }
  return DEFAULT_STYLE;
}
