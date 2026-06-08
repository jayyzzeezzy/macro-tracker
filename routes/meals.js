const { Router } = require("express");

const router = Router();

// TODO: replace all prisma stubs below once `prisma generate` is run
// and import { prisma } from "../db/client.js" is available

// POST /api/meals
// Body: { items: [{ name, fdcId, portion_grams, per100g, macros }] }
router.post("/", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }

  // TODO (Prisma):
  // const meal = await prisma.meal.create({
  //   data: {
  //     eatenAt: new Date(),
  //     items: { create: items.map(i => ({
  //       name: i.name,
  //       fdcId: i.fdcId ?? null,
  //       portionGrams: i.portion_grams,
  //       calories: i.macros.calories,
  //       protein: i.macros.protein,
  //       carbs: i.macros.carbs,
  //       fat: i.macros.fat,
  //     })) },
  //   },
  //   include: { items: true },
  // });
  // res.status(201).json(meal);

  res.status(501).json({ error: "Not implemented — wire up Prisma first" });
});

// GET /api/meals
router.get("/", async (_req, res) => {
  // TODO (Prisma):
  // const meals = await prisma.meal.findMany({
  //   include: { items: true },
  //   orderBy: { eatenAt: "desc" },
  // });
  // res.json({ meals });

  res.status(501).json({ error: "Not implemented — wire up Prisma first" });
});

// GET /api/meals/daily?date=2026-06-08
router.get("/daily", async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const start = new Date(date.setHours(0, 0, 0, 0));
  const end = new Date(date.setHours(23, 59, 59, 999));

  // TODO (Prisma):
  // const meals = await prisma.meal.findMany({
  //   where: { eatenAt: { gte: start, lte: end } },
  //   include: { items: true },
  // });
  // const totals = meals
  //   .flatMap(m => m.items)
  //   .reduce((acc, i) => ({
  //     calories: acc.calories + i.calories,
  //     protein: acc.protein + i.protein,
  //     carbs: acc.carbs + i.carbs,
  //     fat: acc.fat + i.fat,
  //   }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  // res.json({ date: start, meals, totals });

  void start; void end;
  res.status(501).json({ error: "Not implemented — wire up Prisma first" });
});

module.exports = router;
