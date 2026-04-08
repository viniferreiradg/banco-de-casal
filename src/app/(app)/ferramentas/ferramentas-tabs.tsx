"use client";

import { FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PdfToCsvTool } from "./pdf-to-csv";

export function FerramentasTabs() {
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
        <PdfToCsvTool />
      </TabsContent>
    </Tabs>
  );
}
