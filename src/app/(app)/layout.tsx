import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, onboardingCompleted: true, avatarUrl: true },
  });

  if (!dbUser?.onboardingCompleted) redirect("/onboarding");

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar
        userName={dbUser?.name ?? user.email ?? "Usuário"}
        userEmail={dbUser?.email ?? user.email ?? ""}
        avatarUrl={dbUser?.avatarUrl ?? null}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
