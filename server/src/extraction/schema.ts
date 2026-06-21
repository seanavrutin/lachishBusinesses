import { Type } from "@google/genai";
import { z } from "zod";

/** Zod schema used to validate the model's JSON output at runtime. */
export const businessExtractionSchema = z.object({
  isBusiness: z.boolean(),
  name: z.string().trim().min(1).nullable(),
  categories: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().nullable().optional(),
  openingHoursRaw: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
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
    isBusiness: {
      type: Type.BOOLEAN,
      description: "True only if the message describes a local business/service.",
    },
    name: { type: Type.STRING, nullable: true, description: "Business name." },
    categories: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      maxItems: "5",
      description: "1-3 short category tags in Hebrew (e.g. מאפייה, אינסטלטור, מספרה).",
    },
    description: { type: Type.STRING, nullable: true, description: "Short Hebrew summary." },
    openingHoursRaw: {
      type: Type.STRING,
      nullable: true,
      description: "Opening hours verbatim as written (Hebrew kept), or null if not mentioned.",
    },
    phone: { type: Type.STRING, nullable: true },
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
  required: ["isBusiness", "categories", "confidence"],
};
