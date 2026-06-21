import { Router } from "express";
import {
  getBusiness,
  listBusinesses,
  updateBusiness,
} from "../../store/businesses.repo.js";
import { getSignedUrl } from "../../store/storage.js";
import type { Business } from "../../types/index.js";

export const businessesRouter = Router();

async function withImageUrls(business: Business): Promise<Business & { imageUrls: string[] }> {
  const imageUrls = await Promise.all(
    (business.images ?? []).map(async (path) => {
      try {
        return await getSignedUrl(path);
      } catch {
        return "";
      }
    }),
  );
  return { ...business, imageUrls: imageUrls.filter(Boolean) };
}

businessesRouter.get("/", async (req, res) => {
  try {
    const { category, moshav, q } = req.query;
    const businesses = await listBusinesses({
      category: typeof category === "string" ? category : undefined,
      moshav: typeof moshav === "string" ? moshav : undefined,
      q: typeof q === "string" ? q : undefined,
    });
    const withUrls = await Promise.all(businesses.map(withImageUrls));
    res.json({ count: withUrls.length, businesses: withUrls });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

businessesRouter.get("/:id", async (req, res) => {
  try {
    const business = await getBusiness(req.params.id);
    if (!business) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(await withImageUrls(business));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

businessesRouter.patch("/:id", async (req, res) => {
  try {
    const existing = await getBusiness(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const allowed: (keyof Business)[] = [
      "name",
      "categories",
      "description",
      "openingHours",
      "phone",
      "location",
      "status",
    ];
    const patch: Partial<Business> = {};
    for (const key of allowed) {
      if (key in req.body) {
        (patch as Record<string, unknown>)[key] = req.body[key];
      }
    }
    await updateBusiness(req.params.id, patch);
    res.json(await withImageUrls((await getBusiness(req.params.id))!));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
