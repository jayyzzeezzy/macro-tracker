const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// Load an RSA key once at startup. Prefer the inline PEM in `inlineEnv` (used in
// hosted environments like Render, where there's no keys/ directory) and fall
// back to reading the file at `pathEnv` (local dev). Dashboards often store PEM
// with literal "\n" sequences, so normalize those back to real newlines.
// Fail fast (throw) if neither is set — generate keys with `npm run generate-keys`.
function loadKey(inlineEnv, pathEnv, label) {
  const inline = process.env[inlineEnv];
  if (inline && inline.trim()) {
    return inline.replace(/\\n/g, "\n");
  }
  const keyPath = process.env[pathEnv];
  if (keyPath) {
    return fs.readFileSync(path.resolve(keyPath), "utf8");
  }
  throw new Error(
    `Missing ${label}: set ${inlineEnv} (inline PEM) or ${pathEnv} (file path).`
  );
}

const PRIVATE_KEY = loadKey("PRIVATE_KEY", "PRIVATE_KEY_PATH", "JWT private key");
const PUBLIC_KEY = loadKey("PUBLIC_KEY", "PUBLIC_KEY_PATH", "JWT public key");

// RS256: sign with the private key, verify with the public key.
const JWT_ALGORITHM = "RS256";
const JWT_EXPIRES_IN = "1h";
const JWT_ISSUER = "macrosnap";

// Sign an access token for a user. The user id goes in the standard `sub`
// claim; the JwtStrategy reads it back to load the user on each request.
function signToken(user) {
  return jwt.sign({}, PRIVATE_KEY, {
    algorithm: JWT_ALGORITHM,
    subject: user.id,
    expiresIn: JWT_EXPIRES_IN,
    issuer: JWT_ISSUER,
  });
}

module.exports = { signToken, PUBLIC_KEY, JWT_ALGORITHM, JWT_ISSUER };
