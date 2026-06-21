export const SYSTEM_INSTRUCTION = [
  "You extract structured data about a single local business from a WhatsApp post.",
  "Posts come from a community group in the Lachish region of Israel and are usually in Hebrew.",
  "The information may be in the message text, inside the attached image (a flyer/photo), or both.",
  "Read Hebrew text in images carefully (OCR).",
  "",
  "Rules:",
  "- Output ONLY the requested JSON. Do not invent facts that are not present.",
  "- If a field is missing, use null (empty array for categories; empty arrays per day for hours).",
  "- 'name' is the business/service name.",
  "- 'categories' are 1-3 short tags in HEBREW (e.g. מאפייה, אינסטלטור, מספרה, גן ילדים).",
  "- 'description' is a short Hebrew summary of what the business offers.",
  "- 'openingHoursRaw' is the opening-hours text EXACTLY as written (keep Hebrew, including day",
  "  names and times), or null if no hours are mentioned. Copy it verbatim - do NOT normalize,",
  "  translate, reorder, summarize, or drop any day.",
  "- 'phone' is a single primary phone number if shown.",
  "- For 'location': put the full location text in 'raw'; if a moshav/town name appears, put just",
  "  that name (in Hebrew) in 'moshav'; put a street address in 'address' if present.",
  "- Set isBusiness=false for greetings, chit-chat, or anything that is not a business listing.",
  "- 'confidence' reflects how sure you are about the extracted fields (0..1).",
].join("\n");

export function buildPrompt(messageText: string): string {
  const text = messageText.trim();
  return [
    "Extract the business information from the following WhatsApp post.",
    "",
    "MESSAGE TEXT:",
    text.length > 0 ? text : "(no text - rely on the attached image)",
  ].join("\n");
}
