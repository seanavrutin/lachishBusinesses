/**
 * Static gazetteer of the Lachish-area moshavim this project covers.
 * Coordinates are moshav centers verified against OpenStreetMap/Wikipedia; they
 * serve as the fallback when a post has no precise street address.
 * Keyed by Hebrew name; English aliases help match mixed-language posts.
 */
export interface MoshavEntry {
  name: string; // canonical Hebrew name
  lat: number;
  lng: number;
  aliases?: string[];
}

export const MOSHAVIM: MoshavEntry[] = [
  { name: "אחוזם", lat: 31.5539, lng: 34.7697, aliases: ["achuzam", "ahuzam"] },
  { name: "אליאב", lat: 31.5297, lng: 34.9297, aliases: ["eliav"] },
  { name: "אמציה", lat: 31.5325, lng: 34.9136, aliases: ["amatzia", "amatzya"] },
  { name: "בני-דקלים", lat: 31.5178, lng: 34.9189, aliases: ["bnei dekalim", "benei dekalim"] },
  { name: "זוהר", lat: 31.5953, lng: 34.6922, aliases: ["zohar"] },
  { name: "יד נתן", lat: 31.6536, lng: 34.7058, aliases: ["yad natan"] },
  { name: "כרמי-קטיף", lat: 31.5375, lng: 34.9119, aliases: ["carmei katif", "karmei katif"] },
  { name: "לכיש", lat: 31.5617, lng: 34.8428, aliases: ["lachish", "lakhish"] },
  { name: "מנוחה", lat: 31.6575, lng: 34.7775, aliases: ["menucha", "menuha"] },
  { name: "נהורה", lat: 31.6225, lng: 34.705, aliases: ["nehora"] },
  { name: "נוגה", lat: 31.6239, lng: 34.6953, aliases: ["noga"] },
  { name: "נטע", lat: 31.4783, lng: 34.9265, aliases: ["neta"] },
  { name: 'ניר ח"ן', lat: 31.6088, lng: 34.7147, aliases: ["nir chen", "nir hen", "nir han"] },
  { name: "עוצם", lat: 31.6358, lng: 34.7031, aliases: ["otzem"] },
  { name: "שדה דוד", lat: 31.5761, lng: 34.6835, aliases: ["sde david", "sdeh david"] },
  { name: "שדה משה", lat: 31.6106, lng: 34.8022, aliases: ["sde moshe", "sdeh moshe"] },
  { name: "שחר", lat: 31.6186, lng: 34.7242, aliases: ["shahar", "sahar"] },
  { name: "שקף", lat: 31.5153, lng: 34.9361, aliases: ["shekef"] },
  { name: "תלמים", lat: 31.5643, lng: 34.672, aliases: ["telamim", "telamin"] },
];

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^(מושב|moshav|ישוב|יישוב)\s+/u, "")
    .replace(/[\u0591-\u05C7]/g, "") // strip Hebrew niqqud
    .replace(/["'`.,\-\u05F3\u05F4]/g, " ") // quotes, gershayim, hyphens -> space
    .replace(/\s+/g, " ")
    .trim();
}

const INDEX: Map<string, MoshavEntry> = (() => {
  const map = new Map<string, MoshavEntry>();
  for (const entry of MOSHAVIM) {
    map.set(normalize(entry.name), entry);
    for (const alias of entry.aliases ?? []) {
      map.set(normalize(alias), entry);
    }
  }
  return map;
})();

/** Looks up a moshav by (possibly messy) name; tolerant of prefixes and partial matches. */
export function lookupMoshav(name: string): MoshavEntry | null {
  const key = normalize(name);
  if (!key) return null;

  const direct = INDEX.get(key);
  if (direct) return direct;

  // Partial containment (e.g. "אצלנו בנהורה" contains "נהורה").
  for (const [indexedKey, entry] of INDEX) {
    if (key.includes(indexedKey) || indexedKey.includes(key)) {
      return entry;
    }
  }
  return null;
}
