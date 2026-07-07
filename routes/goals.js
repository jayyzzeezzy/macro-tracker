const { Router } = require("express");
const { validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma.js");
const { goalsValidators } = require("../validators/goals.js");

const router = Router();

// Defaults for demo users — match the schema column defaults / the frontend's
// previous localStorage defaults.
const DEFAULT_GOALS = { calories: 2000, protein: 150, carbs: 200, fat: 65 };

// Map the DB columns (caloriesGoal, ...) to the short keys the frontend uses.
function toShortKeys(user) {
  return {
    calories: user.caloriesGoal,
    protein: user.proteinGoal,
    carbs: user.carbsGoal,
    fat: user.fatGoal,
  };
}

// Collect express-validator failures into a 400 response (same shape as auth).
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// GET /api/goals
// Returns the current user's daily macro goals as { calories, protein, carbs, fat }.
router.get("/", async (req, res) => {
  // Demo users aren't persisted — return the defaults.
  if (req.user.isDemo) {
    return res.json({ ...DEFAULT_GOALS });
  }

  try {
    // req.user is loaded fresh by the JWT strategy and includes the goal columns.
    return res.json(toShortKeys(req.user));
  } catch (err) {
    console.error("GET /api/goals failed:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// PUT /api/goals
// Body: { calories, protein, carbs, fat } — updates the current user's goals.
router.put("/", goalsValidators, handleValidation, async (req, res) => {
  const { calories, protein, carbs, fat } = req.body;

  // Demo users can adjust goals to explore the app, but nothing is persisted.
  if (req.user.isDemo) {
    return res.json({ calories, protein, carbs, fat });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        caloriesGoal: calories,
        proteinGoal: protein,
        carbsGoal: carbs,
        fatGoal: fat,
      },
    });
    return res.json(toShortKeys(user));
  } catch (err) {
    console.error("PUT /api/goals failed:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
