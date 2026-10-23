import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { hydrate, parseJson } from "@/lib/json";
import { limitsFor } from "@/lib/plans";
import { effectivePlan } from "@/lib/billing";
import { userSelect } from "@/lib/userSelect";
import { hasRole } from "@/lib/roles";
import type { OrgSettings } from "@/lib/types";

export const GET = withAuth(async (_req, { user }) => {
  const [me, org, unread, pendingApprovals, recent] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { ...userSelect, backupCodes: true, passwordChangedAt: true } }),
    prisma.organization.findUnique({ where: { id: user.orgId } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.requestApproval.count({ where: { approverId: user.id, status: "PENDING", request: { status: "PENDING" } } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  if (!me || !org) return ok(null);
  const settings = parseJson<OrgSettings>(org.settings, {});
  const { backupCodes, ...safe } = me;
  const mustSetup2fa = !!settings.require2faForAdmins && hasRole({ role: me.role as "OWNER" }, "ADMIN") && !me.twoFactorEnabled && !user.viaApiKey;
  return ok({
    user: { ...hydrate(safe, ["prefs"]), backupCodesLeft: parseJson<string[]>(backupCodes, []).length },
    org: { ...hydrate(org, ["branding", "settings"]), limits: limitsFor(effectivePlan(org)) },
    unread,
    pendingApprovals,
    recentNotifications: recent,
    security: { mustChangePassword: !!me.forcePasswordChange && !user.viaApiKey, mustSetup2fa },
  });
});
