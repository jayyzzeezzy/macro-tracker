const { defineConfig } = require("prisma/config");
const { databaseUrl } = require("./lib/dbConfig.js");

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
