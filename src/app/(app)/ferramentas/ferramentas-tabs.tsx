"use client";

import { FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PdfToCsvTool } from "./pdf-to-csv";

interface BankConnection {
  id: string;
  bankName: string;
  nickname: string | null;
  accountType: string;
  isCreditCard: boolean;
  userId: string;
}

interface Props {
  bankConnections: BankConnection[];
  currentUserId: string;
}

export function FerramentasTabs({ bankConnections, currentUserId }: Props) {
  return (
    <Tabs defaultValue="pdf-csv">
      <TabsList>
        <TabsTrigger value="pdf-csv">
          <FileText className="size-4" />
          PDF → CSV
        </TabsTrigger>
        {/* futuras ferramentas aqui */}
      </TabsList>

      <TabsContent value="pdf-csv" className="mt-4">
        <PdfToCsvTool bankConnections={bankConnections} currentUserId={currentUserId} />
      </TabsContent>
    </Tabs>
  );
}
