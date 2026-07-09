const rateLimit = require("express-rate-limit");

// Rate limiters for the "expensive" routes that make paid / quota-limited
// upstream calls (Gemini vision, USDA FoodData Central). These protect against
// both cost abuse and exhausting the shared server-side USDA quota
// (1000 req/hour/IP on our single server key).
//
// Keyed per client IP (req.ip — accurate in production because app.js sets
// `trust proxy`). Demo users get a tighter cap than signed-in users: the demo
// account is anonymous and shared, so it's the most exposed to abuse.
//
// NOTE: these must be mounted AFTER requireAuth so req.user (and .isDemo) is set.

function makeExpensiveLimiter({ windowMs, demoMax, userMax }) {
  return rateLimit({
    windowMs,
    // Per-request limit — demo accounts are throttled harder.
    max: (req) => (req.user?.isDemo ? demoMax : userMax),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down and try again later" },
  });
}

// Vision analysis: one Gemini call + a USDA lookup per identified food.
// The costliest endpoint, so the strictest limit.
const analyzeLimiter = makeExpensiveLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  demoMax: 10,
  userMax: 30,
});

// USDA search / lookup: cheaper, but still draws on the shared USDA quota.
const usdaLimiter = makeExpensiveLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  demoMax: 30,
  userMax: 100,
});

// Global backstop: a single bucket shared by ALL clients, keyed on a constant
// so every request counts against the same counter. Set just under USDA's
// 1000 req/hour/key ceiling so a burst of cache misses can't exhaust the key
// and break food lookups for everyone — we return 429 and degrade gracefully
// instead. Complements (does not replace) the per-IP usdaLimiter.
//
// NOTE: this counts requests to /api/usda only. Food lookups made internally
// by /api/analyze also draw on the same USDA quota but aren't counted here;
// caching in services/usdaApi.js keeps that path light. True per-call USDA
// accounting would live at the service layer — a later refinement if needed.
const usdaGlobalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 800,
  keyGenerator: () => "usda-global", // one shared bucket for all clients
  standardHeaders: false, // silent backstop — don't clash with per-IP headers
  legacyHeaders: false,
  // Constant key is intentional; skip the IP-based key validation warning.
  validate: { keyGeneratorIpFallback: false },
  message: {
    error: "The food database is busy right now, please try again shortly",
  },
});

module.exports = { analyzeLimiter, usdaLimiter, usdaGlobalLimiter };
