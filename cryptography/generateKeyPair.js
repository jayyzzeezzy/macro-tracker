// Generate an RSA public/private key pair for signing/verifying JWTs (RS256).
// Run with: node scripts/generateKeyPair.js
//
// The private key signs tokens and must stay secret. The public key verifies
// them and can be shared. Both are written to ./keys, which should be
// git-ignored — never commit the private key.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEYS_DIR = path.join(__dirname, "..", "keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "public.pem");

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: {
    type: "pkcs1",
    format: "pem",
  },
  privateKeyEncoding: {
    type: "pkcs1",
    format: "pem",
  },
});

// Create ./keys if it doesn't exist yet.
fs.mkdirSync(KEYS_DIR, { recursive: true });

// Restrict the private key to the owner (read/write) on POSIX systems.
fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);

console.log("RSA key pair generated:");
console.log(`  private: ${PRIVATE_KEY_PATH}`);
console.log(`  public:  ${PUBLIC_KEY_PATH}`);
