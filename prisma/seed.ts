import { PrismaClient } from "@prisma/client";
import { seedDemoUser, DEMO_EMAIL, DEMO_PASSWORD } from "../lib/demoSeed";

const prisma = new PrismaClient();

async function main() {
  const count = await seedDemoUser(prisma);
  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}) with ${count} tradelines.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
