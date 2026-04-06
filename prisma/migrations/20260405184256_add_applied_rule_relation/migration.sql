-- AddForeignKey
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_appliedRuleId_fkey" FOREIGN KEY ("appliedRuleId") REFERENCES "split_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
