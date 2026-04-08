-- CreateTable
CREATE TABLE "alias_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "customName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coupleId" TEXT,
    "userId" TEXT,

    CONSTRAINT "alias_rules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "alias_rules" ADD CONSTRAINT "alias_rules_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alias_rules" ADD CONSTRAINT "alias_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
