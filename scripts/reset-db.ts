import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const t1 = await prisma.transactionSplit.deleteMany({});
  const t2 = await prisma.transaction.deleteMany({});
  const t3 = await prisma.splitRule.deleteMany({});
  const t4 = await prisma.monthlySummary.deleteMany({});

  console.log("✅ Limpeza concluída:", {
    splits: t1.count,
    transações: t2.count,
    regras: t3.count,
    resumos: t4.count,
  });

  const couples = await prisma.couple.findMany({
    include: { members: { select: { id: true, name: true, email: true } } },
  });

  console.log("\nCasais no banco:");
  for (const c of couples) {
    console.log(`  Casal ${c.id} | user1Id atual: ${c.user1Id ?? "null"}`);
    for (const m of c.members) {
      console.log(`    - ${m.name} (${m.email}) [id: ${m.id}]`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
