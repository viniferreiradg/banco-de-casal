"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  List,
  BarChart3,
  Settings2,
  Building2,
  User,
  LogOut,
  Tag,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: List },
  { href: "/resumo", label: "Resumo do Mês", icon: BarChart3 },
  { href: "/ferramentas", label: "Ferramentas", icon: Wrench },
];

const settingsItems = [
  { href: "/regras", label: "Regras", icon: Settings2 },
  { href: "/categorias", label: "Categorias", icon: Tag },
  { href: "/contas", label: "Contas", icon: Building2 },
  { href: "/perfil", label: "Perfil", icon: User },
];

interface AppSidebarProps {
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;
}

export function AppSidebar({ userName, userEmail, avatarUrl }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="w-64 border-r flex flex-col h-full bg-background shrink-0">
      <div className="p-4 border-b">
        <p className="font-semibold text-sm">Banco de Casal</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <Separator className="my-3" />

        {settingsItems.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </nav>

      <div className="p-3 border-t space-y-2">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="relative shrink-0">
            <Avatar className="size-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} className="object-cover" />}
              <AvatarFallback className="text-xs">
                {(() => {
                  const parts = userName.trim().split(/\s+/).filter(Boolean);
                  return parts.length > 1
                    ? (parts[0][0] + parts.at(-1)![0]).toUpperCase()
                    : userName.slice(0, 2).toUpperCase();
                })()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 size-2 rounded-full bg-green-500 ring-2 ring-background" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="size-4 mr-2" />
          Sair
        </Button>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}
