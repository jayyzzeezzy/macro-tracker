// Instantiate Prisma Client with PostgreSQL adapter
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("../generated/prisma/client.js");
const { adapterUrl, ssl } = require("./dbConfig.js");

const adapter = new PrismaPg({ connectionString: adapterUrl, ssl });
const prisma = new PrismaClient({ adapter });

module.exports = { prisma };