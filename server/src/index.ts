import { startApi } from "./api/server.js";
import { startWhatsApp } from "./whatsapp/client.js";
import { startWorker } from "./worker/processor.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  // The HTTP API always starts (useful for health checks and the QR endpoint).
  startApi();

  // The worker and WhatsApp client depend on external services; failures there
  // should not bring down the whole process.
  try {
    startWorker();
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to start worker");
  }

  try {
    await startWhatsApp();
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to start WhatsApp client");
  }
}

main().catch((err) => {
  logger.error({ err: String(err) }, "Fatal startup error");
  process.exit(1);
});
