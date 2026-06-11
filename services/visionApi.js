require("dotenv").config();

const PROMPT = `Analyze this food photo. List every distinct food item you can see.
Return ONLY valid JSON — no markdown fences, no explanation:
{"items":[{"name":"food name","portion_grams":100}]}
Estimate portions in grams based on what is visible. Never include nutrition values.`;

const DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-5.4-mini",
  anthropic: "claude-haiku-4-5",
};

function getModel(provider) {
  return process.env.VISION_MODEL || DEFAULT_MODELS[provider];
}

function parseJSON(text) {
  const cleaned = text.replace(/^```(?:\w+)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  return JSON.parse(cleaned);
}

// --- Gemini ---
async function gemini(base64, mimeType) {
  const model = getModel("gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return parseJSON(text);
}

// --- OpenAI ---
async function openai(base64, mimeType) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: getModel("openai"),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
  const data = await res.json();
  return parseJSON(data.choices[0].message.content);
}

// --- Anthropic ---
async function anthropic(base64, mimeType) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: getModel("anthropic"),
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  return parseJSON(text);
}

// --- Provider selector ---
const PROVIDERS = { gemini, openai, anthropic };

async function identifyFoods(base64, mimeType = "image/jpeg") {
  const provider = (process.env.VISION_PROVIDER || "gemini").toLowerCase();
  const fn = PROVIDERS[provider];
  if (!fn) throw new Error(`Unknown VISION_PROVIDER: ${provider}`);

  const result = await fn(base64, mimeType);

  if (!Array.isArray(result?.items)) {
    throw new Error("Vision API returned unexpected shape");
  }
  return result.items;
}

module.exports = { identifyFoods };
