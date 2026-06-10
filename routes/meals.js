const { Router } = require("express");
const { prisma } = require("../lib/prisma.js");

const router = Router();

async function getDemoUser() {
  const user = await prisma.user.findFirst({ where: { isDemo: true } });
  if (!user) throw new Error("Demo user not found — run npm run db:seed");
  return user;
}

// POST /api/meals
// Body: { items: [{ name, fdcId, portion_grams, macros }] }
router.post("/", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items array is required" });
  }

  try {
    const user = await getDemoUser();
    const meal = await prisma.meal.create({
      data: {
        userId: user.id,
        eatenAt: new Date(),
        items: {
          create: items.map((i) => ({
            name: i.name,
            fdcId: i.fdcId ?? null,
            portionGrams: i.portion_grams,
            calories: i.macros.calories,
            protein: i.macros.protein,
            carbs: i.macros.carbs,
            fat: i.macros.fat,
          })),
        },
      },
      include: { items: true },
    });
    res.status(201).json(meal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meals
router.get("/", async (_req, res) => {
  try {
    const user = await getDemoUser();
    const meals = await prisma.meal.findMany({
      where: { userId: user.id },
      include: { items: true },
      orderBy: { eatenAt: "desc" },
    });
    res.json({ meals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meals/daily?date=2026-06-08
router.get("/daily", async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const start = new Date(new Date(date).setHours(0, 0, 0, 0));
  const end = new Date(new Date(date).setHours(23, 59, 59, 999));

  try {
    const user = await getDemoUser();
    const meals = await prisma.meal.findMany({
      where: { userId: user.id, eatenAt: { gte: start, lte: end } },
      include: { items: true },
    });

    const totals = meals
      .flatMap((m) => m.items)
      .reduce(
        (acc, i) => ({
          calories: acc.calories + i.calories,
          protein: acc.protein + i.protein,
          carbs: acc.carbs + i.carbs,
          fat: acc.fat + i.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );

    res.json({ date: start, meals, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
