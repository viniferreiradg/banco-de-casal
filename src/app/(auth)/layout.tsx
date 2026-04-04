export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Banco de Casal</h1>
          <p className="text-sm text-muted-foreground mt-1">Finanças a dois, sem planilha</p>
        </div>
        {children}
      </div>
    </div>
  );
}
