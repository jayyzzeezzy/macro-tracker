const passport = require("./passport.js");

// Protect a route with a valid JWT. Custom callback so failures return JSON
// (Passport's default sends plain "Unauthorized" text). On success the user
// record is attached to req.user.
function requireAuth(req, res, next) {
  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err) {
      console.error("JWT auth failed:", err);
      return res.status(500).json({ error: "Something went wrong" });
    }
    // No/invalid/expired token → no user.
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = user;
    next();
  })(req, res, next);
}

module.exports = requireAuth;
