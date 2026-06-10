require("dotenv").config();
const { prisma } = require("../lib/prisma.js");

async function main() {
  const demo = await prisma.user.upsert({
    where: { email: "demo@macrosnap.app" },
    update: {},
    create: {
      email: "demo@macrosnap.app",
      isDemo: true,
    },
  });

  console.log("Demo user ready:", demo.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
