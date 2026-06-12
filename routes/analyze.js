const { Router } = require("express");
const multer = require("multer");
const { identifyFoods } = require("../services/visionApi");
const { searchFoods, scaleMacros } = require("../services/usdaApi");

const router = Router();

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type. Accepted: ${SUPPORTED_MIME_TYPES.join(", ")}`));
    }
  },
});

// POST /api/analyze
// Accepts multipart/form-data with a "photo" file field, OR
// JSON body { image: "<base64>", mimeType?: "image/jpeg" }
// Note: HEIC/HEIF is only supported when VISION_PROVIDER=gemini
router.post("/", upload.single("photo"), (req, res, next) => {
  // multer file errors arrive here as err on next — surface them as 400
  if (req.fileValidationError) {
    return res.status(400).json({ error: req.fileValidationError });
  }
  next();
}, async (req, res) => {
  let image, mimeType;

  if (req.file) {
    // multipart/form-data upload
    image = req.file.buffer.toString("base64");
    mimeType = req.file.mimetype;
  } else {
    // JSON body fallback
    image = req.body?.image;
    mimeType = req.body?.mimeType ?? "image/jpeg";
  }

  if (!image) {
    return res.status(400).json({ error: "Provide a photo file or a base64 image string" });
  }

  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({
      error: `Unsupported mimeType. Accepted: ${SUPPORTED_MIME_TYPES.join(", ")}`,
    });
  }

  // Step 1: vision API — get food names + portion estimates
  let identified;
  try {
    identified = await identifyFoods(image, mimeType);
  } catch (err) {
    return res.status(502).json({ error: "Vision API failed", detail: err.message });
  }

  // Step 2: USDA lookup for each identified food
  const items = await Promise.all(
    identified.map(async ({ name, portion_grams }) => {
      try {
        const results = await searchFoods(name, 1);
        const food = results[0] ?? null;

        if (!food) {
          return {
            name,
            portion_grams,
            found: false,
            per100g: null,
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          };
        }

        const macros = scaleMacros(food.per100g, portion_grams);
        return {
          name,
          portion_grams,
          found: true,
          fdcId: food.fdcId,
          usdaDescription: food.description,
          per100g: food.per100g,
          calories: macros.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
        };
      } catch {
        return {
          name,
          portion_grams,
          found: false,
          per100g: null,
          calories: null,
          protein: null,
          carbs: null,
          fat: null,
        };
      }
    })
  );

  // Step 3: sum totals across all found items
  const totals = items
    .filter((i) => i.found)
    .reduce(
      (acc, i) => ({
        calories: Math.round((acc.calories + i.calories) * 10) / 10,
        protein: Math.round((acc.protein + i.protein) * 10) / 10,
        carbs: Math.round((acc.carbs + i.carbs) * 10) / 10,
        fat: Math.round((acc.fat + i.fat) * 10) / 10,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

  res.json({ items, totals });
});

module.exports = router;
