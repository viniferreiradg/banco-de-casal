import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InviteButton } from "./invite-button";
import { EditName } from "./edit-name";
import { CasalSettings } from "./casal-settings";
import { AvatarUpload } from "./avatar-upload";

function getInitials(name: string | null | undefined): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length > 1
    ? (parts[0][0] + parts.at(-1)![0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      couple: {
        include: { members: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
    },
  });

  const partner = dbUser?.couple?.members.find((m) => m.id !== user.id);
  const closingDay = dbUser?.couple?.closingDay ?? 5;
  const initials = getInitials(dbUser?.name);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      {/* My profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minha conta</CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-6">
          <AvatarUpload
            currentAvatarUrl={dbUser?.avatarUrl ?? null}
            initials={initials}
          />
          <div className="space-y-3 flex-1">
            <div>
              <p className="font-semibold">{dbUser?.name || dbUser?.email}</p>
              <p className="text-sm text-muted-foreground">{dbUser?.email}</p>
            </div>
            <EditName currentName={dbUser?.name ?? ""} currentNickname={dbUser?.nickname ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Partner / Couple */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Casal</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie o vínculo com seu(sua) parceiro(a)
          </p>
        </div>

        {partner ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Vinculado a {partner.name}
              </CardTitle>
              <CardDescription>{partner.email}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  {partner.avatarUrl && <AvatarImage src={partner.avatarUrl} alt={partner.name} className="object-cover" />}
                  <AvatarFallback>
                    {getInitials(partner.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{partner.name}</p>
                  <Badge variant="secondary" className="text-xs mt-0.5">Parceiro(a)</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Convide seu(sua) parceiro(a) para gerenciar as finanças juntos.
                Um link de convite será gerado — basta enviá-lo pelo WhatsApp ou email.
              </p>
              <InviteButton />
            </CardContent>
          </Card>
        )}
      </div>
      {dbUser?.coupleId && (
        <>
          <Separator />
          <CasalSettings closingDay={closingDay} />
        </>
      )}
    </div>
  );
}
