import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const updated = await prisma.couple.update({
    where: { id: "cmnkmx1sy000004lezm1kegdy" },
    data: { user1Id: "44331afb-4ae9-4042-9fe6-a8d8e31c3922" }, // Vini = user1
  });
  console.log("✅ user1Id setado:", updated.user1Id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
