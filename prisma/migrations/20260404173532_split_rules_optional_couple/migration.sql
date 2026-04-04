-- AlterTable
ALTER TABLE "split_rules" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "coupleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "split_rules" ADD CONSTRAINT "split_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
