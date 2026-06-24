import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const adminRouter = Router();

// Lets the UI confirm a pasted token is valid before entering admin mode.
adminRouter.get("/verify", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});
