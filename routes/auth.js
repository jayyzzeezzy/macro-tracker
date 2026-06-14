const { Router } = require("express");
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const { prisma } = require("../lib/prisma.js");
const { signupValidators, signinValidators } = require("../validators/auth.js");

const router = Router();

// bcrypt work factor — higher is slower/safer. 12 is a sensible default.
const BCRYPT_ROUNDS = 12;

// A real hash to compare against when an account is not found, so sign-in
// timing is the same whether or not the email exists (mitigates user
// enumeration via timing side-channel).
const DUMMY_HASH = bcrypt.hashSync("timing-attack-mitigation-placeholder", BCRYPT_ROUNDS);

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
router.post("/signup", signupValidators, handleValidation, async (req, res) => {
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
router.post("/signin", signinValidators, handleValidation, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Generic message + dummy compare so we don't reveal whether the
    // email exists (avoids user enumeration).
    if (!user || !user.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // TODO: issue a session / JWT here so the user stays authenticated.
    return res.json({ id: user.id, email: user.email });
  } catch (err) {
    console.error("POST /api/auth/signin failed:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

module.exports = router;
