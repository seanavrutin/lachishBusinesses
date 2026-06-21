/**
 * Static gazetteer of the Lachish-area moshavim this project covers.
 * Coordinates are APPROXIMATE town centers - refine as needed (the external
 * geocoder fallback handles full street addresses).
 * Keyed by Hebrew name; English aliases help match mixed-language posts.
 */
export interface MoshavEntry {
  name: string; // canonical Hebrew name
  lat: number;
  lng: number;
  aliases?: string[];
}

export const MOSHAVIM: MoshavEntry[] = [
  { name: "אחוזם", lat: 31.5969, lng: 34.7331, aliases: ["achuzam", "ahuzam"] },
  { name: "אליאב", lat: 31.5394, lng: 34.8806, aliases: ["eliav"] },
  { name: "אמציה", lat: 31.5667, lng: 34.8833, aliases: ["amatzia", "amatzya"] },
  { name: "בני-דקלים", lat: 31.5664, lng: 34.7889, aliases: ["bnei dekalim", "benei dekalim"] },
  { name: "זוהר", lat: 31.6, lng: 34.717, aliases: ["zohar"] },
  { name: "יד נתן", lat: 31.6164, lng: 34.7258, aliases: ["yad natan"] },
  { name: "כרמי-קטיף", lat: 31.5561, lng: 34.7906, aliases: ["carmei katif", "karmei katif"] },
  { name: "לכיש", lat: 31.5622, lng: 34.8472, aliases: ["lachish", "lakhish"] },
  { name: "מנוחה", lat: 31.5672, lng: 34.7672, aliases: ["menucha", "menuha"] },
  { name: "נהורה", lat: 31.598, lng: 34.748, aliases: ["nehora"] },
  { name: "נוגה", lat: 31.617, lng: 34.7, aliases: ["noga"] },
  { name: "נטע", lat: 31.5528, lng: 34.8, aliases: ["neta"] },
  { name: 'ניר ח"ן', lat: 31.6261, lng: 34.74, aliases: ["nir chen", "nir hen", "nir han"] },
  { name: "עוצם", lat: 31.595, lng: 34.733, aliases: ["otzem"] },
  { name: "שדה דוד", lat: 31.61, lng: 34.683, aliases: ["sde david", "sdeh david"] },
  { name: "שדה משה", lat: 31.583, lng: 34.7, aliases: ["sde moshe", "sdeh moshe"] },
  { name: "שחר", lat: 31.604, lng: 34.708, aliases: ["shahar", "sahar"] },
  { name: "שקף", lat: 31.55, lng: 34.833, aliases: ["shekef"] },
  { name: "תלמים", lat: 31.6072, lng: 34.6669, aliases: ["telamim", "telamin"] },
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
