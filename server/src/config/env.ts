import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default("info"),
  // Audit log file. Captures full structured logs (incl. Gemini request/response) at
  // LOG_FILE_LEVEL, independent of the console level. Set LOG_FILE="" to disable.
  LOG_FILE: z.string().default("logs/app.log"),
  LOG_FILE_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("debug"),
  NODE_ENV: z.string().default("development"),

  // WhatsApp
  WA_AUTH_DIR: z.string().default("./auth"),
  TARGET_GROUP_ID: z.string().trim().optional(),
  TARGET_GROUP_NAME: z.string().trim().optional(),
  // Backfill the recent history WhatsApp already sends on login, bounded by age.
  INGEST_HISTORY: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  HISTORY_MAX_AGE_DAYS: z.coerce.number().default(30),
  // Ask WhatsApp for the FULL on-phone archive (can be very large). Off by default.
  WA_SYNC_FULL_HISTORY: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  // Also ingest messages sent BY the linked account (useful for testing by posting
  // from the same phone the server is linked to). In production keep this false.
  INGEST_FROM_ME: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  // Skip TLS certificate verification for the WhatsApp connection only.
  // Needed on networks that intercept TLS (corporate proxy, VPN, AV "SSL scanning").
  WA_ALLOW_INSECURE_TLS: z
    .string()
    .default("false")
    .transform((v) => v.toLowerCase() === "true"),
  // Verbosity of Baileys' internal logger. "silent" hides its noisy initial-sync
  // logs; raise to "info"/"debug" to debug WhatsApp protocol issues.
  BAILEYS_LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("silent"),

  // Gemini
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.1-flash-lite"),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  // Geocoding
  GEOCODER_PROVIDER: z.enum(["none", "nominatim", "google"]).default("nominatim"),
  GEOCODING_API_KEY: z.string().optional(),

  // Worker
  WORKER_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  WORKER_BATCH_SIZE: z.coerce.number().default(5),
  WORKER_MAX_ATTEMPTS: z.coerce.number().default(5),
  MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
});

export const env = schema.parse(process.env);

export const isProduction = env.NODE_ENV === "production";
