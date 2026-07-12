// Resolves which database the app and Prisma migrations talk to, so both agree.
// Production (Render, NODE_ENV=production) uses PROD_DB_URL (Aiven); everything
// else uses DEV_DB_URL (local Postgres).
require("dotenv").config();

const isProd = process.env.NODE_ENV === "production";
const databaseUrl = isProd ? process.env.PROD_DB_URL : process.env.DEV_DB_URL;

if (!databaseUrl) {
  const missing = isProd ? "PROD_DB_URL" : "DEV_DB_URL";
  throw new Error(
    `Missing database URL: ${missing} is not set (NODE_ENV=${process.env.NODE_ENV || "undefined"}).`
  );
}

// Local Postgres has no TLS; hosted Postgres (Aiven) requires it and uses a
// self-signed CA. If DATABASE_CA is provided, verify against it; otherwise
// encrypt without verifying (fine for a hobby deploy).
const isLocal = /@(localhost|127\.0\.0\.1)/.test(databaseUrl);
const ssl = isLocal
  ? false
  : process.env.DATABASE_CA
    ? { ca: process.env.DATABASE_CA.replace(/\\n/g, "\n") }
    : { rejectUnauthorized: false };

// node-postgres parses `sslmode` out of the connection string and lets it
// override the explicit `ssl` option above — so `sslmode=require` would force
// cert verification and reject Aiven's self-signed CA. Strip it for the adapter
// so `ssl` decides. Migrations use `databaseUrl` unchanged (Prisma's own engine
// honors sslmode correctly, accepting self-signed certs under `require`).
function stripSslMode(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return url;
  }
}
const adapterUrl = isLocal ? databaseUrl : stripSslMode(databaseUrl);

module.exports = { databaseUrl, adapterUrl, ssl };
