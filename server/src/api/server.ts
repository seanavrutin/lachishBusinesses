import express from "express";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { businessesRouter } from "./routes/businesses.js";
import { whatsappRouter } from "./routes/whatsapp.js";

export function startApi(): void {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/whatsapp", whatsappRouter);
  app.use("/api/businesses", businessesRouter);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HTTP API listening");
  });
}
