require("dotenv").config();

const BASE = "https://api.nal.usda.gov/fdc/v1";

// USDA nutrient IDs
const NUTRIENT = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004 };

function getKey() {
  return process.env.USDA_API_KEY || "DEMO_KEY";
}

// Extract per-100g macros from a USDA food's nutrient array
function extractMacros(foodNutrients) {
  const map = {};
  for (const n of foodNutrients) {
    const id = n.nutrientId ?? n.nutrient?.id;
    map[id] = n.value ?? n.amount ?? 0;
  }
  return {
    calories: map[NUTRIENT.calories] ?? 0,
    protein: map[NUTRIENT.protein] ?? 0,
    carbs: map[NUTRIENT.carbs] ?? 0,
    fat: map[NUTRIENT.fat] ?? 0,
  };
}

// Scale per-100g macros to actual portion
function scaleMacros(per100g, grams) {
  const factor = grams / 100;
  return {
    calories: Math.round(per100g.calories * factor * 10) / 10,
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fat: Math.round(per100g.fat * factor * 10) / 10,
  };
}

async function searchFoods(query, pageSize = 5) {
  const params = new URLSearchParams({
    query,
    api_key: getKey(),
    dataType: "Foundation,SR Legacy",
    pageSize: String(pageSize),
    nutrients: Object.values(NUTRIENT).join(","),
  });

  const res = await fetch(`${BASE}/foods/search?${params}`);
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`);

  const data = await res.json();
  return (data.foods ?? []).map((f) => ({
    fdcId: f.fdcId,
    description: f.description,
    dataType: f.dataType,
    per100g: extractMacros(f.foodNutrients ?? []),
  }));
}

async function getFoodById(fdcId) {
  const params = new URLSearchParams({
    api_key: getKey(),
    nutrients: Object.values(NUTRIENT).join(","),
  });

  const res = await fetch(`${BASE}/food/${fdcId}?${params}`);
  if (!res.ok) throw new Error(`USDA food lookup failed: ${res.status}`);

  const f = await res.json();
  return {
    fdcId: f.fdcId,
    description: f.description,
    dataType: f.dataType,
    per100g: extractMacros(f.foodNutrients ?? []),
  };
}

module.exports = { searchFoods, getFoodById, scaleMacros };
