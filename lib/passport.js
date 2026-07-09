const passport = require("passport");
const { Strategy: LocalStrategy } = require("passport-local");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { Strategy: GoogleStrategy } = require("passport-google-oauth20");
const bcrypt = require("bcryptjs");
const { prisma } = require("./prisma.js");
const { PUBLIC_KEY, JWT_ALGORITHM, JWT_ISSUER } = require("./jwt.js");

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

// JwtStrategy: authenticate requests carrying a Bearer token.
// The signature is verified with the public key, so no DB hit is needed just
// to trust the token — we only query to load the current user record.
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: PUBLIC_KEY,
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
    },
    async (payload, done) => {
      try {
        // payload.sub is the user id we set when signing the token.
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });

        // User may have been deleted since the token was issued.
        if (!user) return done(null, false);

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// GoogleStrategy: "Continue with Google" (OAuth 2.0). Only registered when
// credentials are configured, so the app still boots without them (e.g. CI or
// a dev who isn't using Google login). session: false — we mint our own JWT.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3000/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;
          const name = profile.displayName ?? null;

          // 1. Already linked to a Google account → sign in.
          let user = await prisma.user.findUnique({ where: { googleId } });
          if (user) return done(null, user);

          // 2. An account with this (Google-verified) email already exists —
          //    e.g. they signed up with email/password first. Link Google to it.
          if (email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
              user = await prisma.user.update({
                where: { id: existing.id },
                data: { googleId, name: existing.name ?? name },
              });
              return done(null, user);
            }
          }

          // 3. First time — create a new account (no password).
          user = await prisma.user.create({
            data: { googleId, email, name },
          });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = passport;
