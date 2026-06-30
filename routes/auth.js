const { Router } = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma.js");
const passport = require("../lib/passport.js");
const requireAuth = require("../lib/requireAuth.js");
const { signToken } = require("../lib/jwt.js");
const { signupValidators, signinValidators } = require("../validators/auth.js");

const router = Router();

// bcrypt work factor — higher is slower/safer. 12 is a sensible default.
const BCRYPT_ROUNDS = 12;

// Throttle the sensitive auth actions (signup/signin/demo) to slow brute-force
// and credential-stuffing. Applied per-route so read-only /me stays unlimited
// (the frontend calls it on every page load to validate the stored token).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

// Collect express-validator failures into a 400 response.
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

// POST /api/auth/signup
// Body: { email, password }
router.post("/signup", authLimiter, signupValidators, handleValidation, async (req, res) => {
  const { email, password } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash },
    });

    // Never return the password hash
    return res.status(201).json({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    });
  } catch (err) {
    console.error("POST /api/auth/signup failed:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/signin
// Body: { email, password }
router.post("/signin", authLimiter, signinValidators, handleValidation, (req, res, next) => {
  // Custom callback so we control the JSON response (Passport's default would
  // redirect / send 401 text). session: false — stateless for now; JWT later.
  passport.authenticate("local", { session: false }, (err, user) => {
    if (err) {
      console.error("POST /api/auth/signin failed:", err);
      return res.status(500).json({ error: "Something went wrong" });
    }
    // user === false means bad credentials (generic message, no enumeration).
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Issue a signed JWT so the client can authenticate subsequent requests
    // via the Authorization: Bearer <token> header.
    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email } });
  })(req, res, next);
});

// GET /api/auth/me
// Returns the currently authenticated user. The frontend calls this on load
// to validate a stored token and restore the session.
router.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    isDemo: req.user.isDemo,
  });
});

// POST /api/auth/demo
// Issues a token for the shared demo account so users can explore the app
// without signing up. Demo meals are never persisted (see routes/meals.js).
router.post("/demo", authLimiter, async (req, res) => {
  try {
    const demo = await prisma.user.findFirst({ where: { isDemo: true } });
    if (!demo) {
      // Demo user hasn't been seeded — run `npm run db:seed`.
      return res.status(503).json({ error: "Demo is unavailable" });
    }

    const token = signToken(demo);
    return res.json({
      token,
      user: { id: demo.id, email: demo.email, isDemo: true },
    });
  } catch (err) {
    console.error("POST /api/auth/demo failed:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
