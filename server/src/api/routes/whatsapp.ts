import { Router } from "express";
import { getWhatsAppState } from "../../whatsapp/state.js";

export const whatsappRouter = Router();

whatsappRouter.get("/status", (_req, res) => {
  const state = getWhatsAppState();
  res.json({
    connection: state.connection,
    resolvedTargetJid: state.resolvedTargetJid,
    isPairing: state.qrDataUrl !== null,
    groupCount: state.groups.length,
    lastError: state.lastError,
  });
});

whatsappRouter.get("/groups", (_req, res) => {
  res.json({ groups: getWhatsAppState().groups });
});

whatsappRouter.get("/qr", (_req, res) => {
  const state = getWhatsAppState();
  if (!state.qrDataUrl) {
    res.status(404).json({ error: "no pairing QR available (already linked or not connecting)" });
    return;
  }
  // Render the QR as an inline image page for easy scanning from a browser.
  res
    .type("html")
    .send(
      `<!doctype html><html><body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#111">` +
        `<img alt="WhatsApp link QR" src="${state.qrDataUrl}" style="width:320px;height:320px;image-rendering:pixelated"/></body></html>`,
    );
});
