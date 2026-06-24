import { Type } from "@google/genai";
import { z } from "zod";

/**
 * The primary intent of a post. Only some of these (see RELEVANT_POST_TYPES) are
 * kept as directory listings; the rest are filtered out as noise. Classifying into
 * one bucket keeps the prompt lean and reliable vs. a long list of exclusion rules.
 */
export const POST_TYPES = ["business", "job", "event", "school", "other"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Zod schema used to validate the model's JSON output at runtime. */
export const businessExtractionSchema = z.object({
  // Unknown/missing values fall back to "other" (i.e. filtered out), never throwing.
  postType: z.enum(POST_TYPES).catch("other"),
  name: z.string().trim().min(1).nullable(),
  categories: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().nullable().optional(),
  openingHoursRaw: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  website: z.string().trim().nullable().optional(),
  location: z
    .object({
      raw: z.string().trim().nullable().optional(),
      moshav: z.string().trim().nullable().optional(),
      address: z.string().trim().nullable().optional(),
    })
    .default({}),
  confidence: z.number().min(0).max(1).default(0),
});

export type BusinessExtraction = z.infer<typeof businessExtractionSchema>;

/**
 * Response schema handed to Gemini so it returns structured JSON directly.
 * Mirrors the zod schema above.
 */
export const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    postType: {
      type: Type.STRING,
      enum: [...POST_TYPES],
      description:
        "Primary purpose of the post (decide by what it asks the reader to do), checked in order: " +
        "job (hiring/workers wanted, any sector), school (education or childcare - schools, " +
        "kindergartens, gan/משפחתון/צהרון, קייטנות, חוגים, courses, registration, schedules), " +
        "event (a one-time non-school happening), business (ongoing local business/service to " +
        "customers), other (anything else).",
    },
    name: { type: Type.STRING, nullable: true, description: "Business name." },
    categories: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: "2",
      description:
        "The business type as a short Hebrew tag. Usually ONE; a second only if it truly spans two types. " +
        "Reuse an existing category from the provided list when one fits, copying its wording exactly.",
    },
    description: { type: Type.STRING, nullable: true, description: "Short Hebrew summary." },
    openingHoursRaw: {
      type: Type.STRING,
      nullable: true,
      description: "Opening hours verbatim as written (Hebrew kept), or null if not mentioned.",
    },
    phone: { type: Type.STRING, nullable: true },
    website: {
      type: Type.STRING,
      nullable: true,
      description:
        "A single URL from the post: website, online-ordering/delivery link, menu, or social page. " +
        "Copy it as-is. Null if none (do not use a phone number here).",
    },
    location: {
      type: Type.OBJECT,
      properties: {
        raw: { type: Type.STRING, nullable: true, description: "Location text as written." },
        moshav: { type: Type.STRING, nullable: true, description: "Moshav/town name only." },
        address: { type: Type.STRING, nullable: true, description: "Street address if present." },
      },
    },
    confidence: {
      type: Type.NUMBER,
      description: "0..1 confidence that the extracted fields are correct.",
    },
  },
  required: ["postType", "categories", "confidence"],
};
