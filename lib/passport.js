const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const bcrypt = require("bcryptjs");
const { prisma } = require("./prisma.js");

// A real hash to compare against when an account is not found, so sign-in
// timing is the same whether or not the email exists (mitigates user
// enumeration via a timing side-channel).
const DUMMY_HASH = bcrypt.hashSync("timing-attack-mitigation-placeholder", 12);

// LocalStrategy: verify an email + password pair.
// We authenticate by email, so map usernameField to "email".
// No session work here — we run this stateless and will add JWT later to
// persist the login across requests.
passport.use(
  new LocalStrategy(
    { usernameField: "email", passwordField: "password" },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });

        // Generic outcome + dummy compare so we never reveal whether the
        // email exists (avoids user enumeration). done(null, false) = auth failed.
        if (!user || !user.passwordHash) {
          await bcrypt.compare(password, DUMMY_HASH);
          return done(null, false);
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return done(null, false);

        // Success — Passport attaches this to req.user.
        return done(null, user);
      } catch (err) {
        // Unexpected error (e.g. DB down) — surfaces as a 500.
        return done(err);
      }
    }
  )
);

module.exports = passport;
