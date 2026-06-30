require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const passport = require("./lib/passport");
const requireAuth = require("./lib/requireAuth");

const analyzeRouter = require("./routes/analyze");
const usdaRouter = require("./routes/usda");
const mealsRouter = require("./routes/meals");
const authRouter = require("./routes/auth");

const app = express();
// Trust the first proxy hop (e.g. Render's load balancer) in production so
// req.ip reflects the real client IP for rate limiting. Use 1, not true.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}
// security headers
app.use(helmet());

// CORS — allow localhost (any port) for local dev, plus any origins listed in
// the CORS_ORIGINS env var (comma-separated), e.g. your deployed frontend.
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header → non-browser client (curl, Postman, same-origin). Allow.
      if (!origin) return callback(null, true);
      // Always allow localhost / 127.0.0.1 on any port for local development.
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // Allow explicitly configured origins (e.g. the deployed frontend).
      if (envOrigins.includes(origin)) return callback(null, true);
      // Otherwise omit CORS headers so the browser blocks it (no server error).
      return callback(null, false);
    },
    credentials: true, // needed once auth uses cookies
  })
);
// express body-parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Initialize Passport. No passport.session() — we're stateless for now and
// will add JWT later to persist logins.
app.use(passport.initialize());

// Protected routes — require a valid JWT (Authorization: Bearer <token>).
app.use("/api/analyze", requireAuth, analyzeRouter);
app.use("/api/usda", requireAuth, usdaRouter);
app.use("/api/meals", requireAuth, mealsRouter);

// Public — signup/signin must be reachable without a token. The rate limiter
// is applied per-route inside the router (so /me stays unlimited).
app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
    res.json({ message: "Welcome to MacroSnap!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
