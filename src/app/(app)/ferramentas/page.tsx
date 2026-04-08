import { FerramentasTabs } from "./ferramentas-tabs";

export default function FerramentasPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ferramentas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Utilitários para facilitar o uso do app.
        </p>
      </div>
      <FerramentasTabs />
    </div>
  );
}
