import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const vini = await prisma.user.update({
    where: { id: "44331afb-4ae9-4042-9fe6-a8d8e31c3922" },
    data: { nickname: "Vini" },
  });
  console.log("✅ Vini:", vini.nickname);

  const pati = await prisma.user.update({
    where: { id: "906b1a67-c1b0-44bf-9086-0ef0bc5cce5a" },
    data: { nickname: "Pati" },
  });
  console.log("✅ Pati:", pati.nickname);
}

main().catch(console.error).finally(() => prisma.$disconnect());
