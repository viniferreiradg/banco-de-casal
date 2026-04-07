/*
  Warnings:

  - You are about to drop the column `category` on the `split_rules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "split_rules" DROP COLUMN "category";

-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coupleId" TEXT,
    "userId" TEXT,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
