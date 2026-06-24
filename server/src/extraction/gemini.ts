import { GoogleGenAI, Type, type Part } from "@google/genai";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { buildPrompt, SYSTEM_INSTRUCTION } from "./prompt.js";
import {
  businessExtractionSchema,
  geminiResponseSchema,
  type BusinessExtraction,
} from "./schema.js";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

export interface ExtractionInput {
  text?: string;
  images?: { data: Buffer; mimeType: string }[];
  /** Categories already in use, so the model reuses them instead of inventing new ones. */
  knownCategories?: string[];
}

export async function extractBusiness(input: ExtractionInput): Promise<BusinessExtraction> {
  const promptText = buildPrompt(input.text ?? "", input.knownCategories ?? []);
  const parts: Part[] = [{ text: promptText }];

  for (const image of input.images ?? []) {
    parts.push({
      inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") },
    });
  }

  logger.debug(
    {
      model: env.GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      prompt: promptText,
      knownCategoryCount: input.knownCategories?.length ?? 0,
      // Image bytes are omitted on purpose; only metadata is logged.
      images: (input.images ?? []).map((i) => ({ mimeType: i.mimeType, bytes: i.data.length })),
    },
    "Gemini request",
  );

  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: geminiResponseSchema,
      temperature: 0,
      // Our output is a single small object; cap it so a rambling model can't
      // generate a giant (and ultimately truncated, unparseable) response.
      maxOutputTokens: 1024,
      // Flash models think by default; thinking tokens would eat into the small
      // output budget above and can leave the JSON answer empty/truncated.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const finishReason = response.candidates?.[0]?.finishReason;
  const raw = response.text;
  logger.debug(
    { finishReason, usage: response.usageMetadata, rawLength: raw?.length ?? 0, raw },
    "Gemini response",
  );
  if (!raw) {
    throw new Error(`Gemini returned an empty response (finishReason: ${finishReason ?? "unknown"})`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    const preview = raw.length > 2000 ? `${raw.slice(0, 2000)}… [${raw.length} chars total]` : raw;
    logger.error({ finishReason, rawLength: raw.length, preview }, "Failed to parse Gemini JSON output");
    throw new Error(
      `Gemini output was not valid JSON (finishReason: ${finishReason ?? "unknown"}, ${raw.length} chars): ${String(err)}`,
    );
  }

  const extraction = businessExtractionSchema.parse(json);
  logger.debug({ extraction }, "Gemini extraction parsed");
  return extraction;
}

export interface CategorizeInput {
  name: string;
  description?: string;
  /** Latest post text about the business, for extra context. */
  text?: string;
  /** Current categories on the record (the model may keep or replace them). */
  current?: string[];
  /** The controlled vocabulary to choose from. */
  vocabulary: string[];
}

const CATEGORIZE_SYSTEM = [
  "You assign a category to a local business in the Lachish region of Israel (Hebrew).",
  "Pick the SINGLE best category; add a second only if the business clearly spans two distinct types.",
  "NEVER return more than two.",
  "STRONGLY prefer a category from the ALLOWED CATEGORIES list and copy its wording EXACTLY.",
  "Only if absolutely none of them fit, output one new short, GENERAL Hebrew category.",
  "Output ONLY the requested JSON.",
].join("\n");

const categoriesOnlySchema = {
  type: Type.OBJECT,
  properties: {
    categories: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "2" },
  },
  required: ["categories"],
};

/** Re-classifies one business into 1-2 categories from a controlled vocabulary (text-only, cheap). */
export async function categorizeBusiness(input: CategorizeInput): Promise<string[]> {
  const prompt = [
    "ALLOWED CATEGORIES:",
    input.vocabulary.join(" | "),
    "",
    "BUSINESS:",
    `name: ${input.name}`,
    input.description ? `description: ${input.description}` : "",
    input.current?.length ? `current categories: ${input.current.join(", ")}` : "",
    input.text ? `post text: ${input.text.slice(0, 1500)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await getClient().models.generateContent({
    model: env.GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: CATEGORIZE_SYSTEM,
      responseMimeType: "application/json",
      responseSchema: categoriesOnlySchema,
      temperature: 0,
      maxOutputTokens: 256,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const raw = response.text;
  if (!raw) return [];
  try {
    const json = JSON.parse(raw) as { categories?: unknown };
    return Array.isArray(json.categories)
      ? json.categories.filter((c): c is string => typeof c === "string")
      : [];
  } catch (err) {
    logger.warn({ err: String(err), raw }, "Failed to parse categorize response");
    return [];
  }
}
