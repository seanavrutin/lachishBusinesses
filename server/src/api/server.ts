import express from "express";
import cors from "cors";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { adminRouter } from "./routes/admin.js";
import { businessesRouter } from "./routes/businesses.js";
import { whatsappRouter } from "./routes/whatsapp.js";

export function startApi(): void {
  const app = express();

  const origin =
    env.CORS_ORIGINS === "*" ? true : env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/admin", adminRouter);
  app.use("/api/whatsapp", whatsappRouter);
  app.use("/api/businesses", businessesRouter);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HTTP API listening");
  });
}
