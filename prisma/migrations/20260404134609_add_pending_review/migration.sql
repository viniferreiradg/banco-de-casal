-- AlterTable
ALTER TABLE "bank_connections" ADD COLUMN     "isManual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "pendingReview" BOOLEAN NOT NULL DEFAULT false;
