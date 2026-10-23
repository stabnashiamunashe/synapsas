import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/json";
import { AppShell } from "@/components/AppShell";
import type { BrandingSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Verified against the DB: deactivated users and revoked sessions are bounced immediately.
  const session = await getVerifiedSession();
  if (!session) redirect("/login");
  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });
  if (!org) redirect("/login");
  const branding = parseJson<BrandingSettings>(org.branding, {});
  return (
    <AppShell branding={branding} orgName={org.name} session={session}>
      {children}
    </AppShell>
  );
}
