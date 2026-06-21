import pino from "pino";
import { env, isProduction } from "../config/env.js";

const levelValue = (level: string): number => pino.levels.values[level] ?? 30;

const targets: pino.TransportTargetOptions[] = [
  isProduction
    ? { target: "pino/file", level: env.LOG_LEVEL, options: { destination: 1 } }
    : {
        target: "pino-pretty",
        level: env.LOG_LEVEL,
        options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
      },
];

// Optional full-fidelity audit file (JSON), e.g. to inspect every Gemini request/response.
if (env.LOG_FILE) {
  targets.push({
    target: "pino/file",
    level: env.LOG_FILE_LEVEL,
    options: { destination: env.LOG_FILE, mkdir: true },
  });
}

// The instance level must be at least as verbose as the most verbose target,
// otherwise records would be filtered out before reaching the file transport.
const effectiveLevel =
  Object.entries(pino.levels.values).find(
    ([, value]) => value === Math.min(...targets.map((t) => levelValue(t.level ?? env.LOG_LEVEL))),
  )?.[0] ?? env.LOG_LEVEL;

export const logger = pino({ level: effectiveLevel }, pino.transport({ targets }));

export type Logger = typeof logger;
