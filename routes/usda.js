const { Router } = require("express");
const { searchFoods, getFoodById } = require("../services/usdaApi");

const router = Router();

// GET /api/usda/search?q=chicken+breast
router.get("/search", async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.status(400).json({ error: "q is required" });

  try {
    const foods = await searchFoods(q, 10);
    res.json({ foods });
  } catch (err) {
    res.status(502).json({ error: "USDA search failed", detail: err.message });
  }
});

// GET /api/usda/food/:fdcId
router.get("/food/:fdcId", async (req, res) => {
  const { fdcId } = req.params;

  try {
    const food = await getFoodById(fdcId);
    res.json(food);
  } catch (err) {
    res.status(502).json({ error: "USDA lookup failed", detail: err.message });
  }
});

module.exports = router;
