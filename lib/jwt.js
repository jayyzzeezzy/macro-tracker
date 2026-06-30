const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// Load the RSA key pair once at startup from the paths in .env.
// Fail fast (throw) if they're missing — generate them with `npm run generate-keys`.
const PRIVATE_KEY = fs.readFileSync(
  path.resolve(process.env.PRIVATE_KEY_PATH),
  "utf8"
);
const PUBLIC_KEY = fs.readFileSync(
  path.resolve(process.env.PUBLIC_KEY_PATH),
  "utf8"
);

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
