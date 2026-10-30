import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound, ok, parseBody, withAuth } from "@/lib/api";
import { hasRole } from "@/lib/auth";
import { applyClearance } from "@/lib/advances";

const schema = z.object({ kind: z.enum(["CASH_REFUND", "SALARY_RECOVERY", "WRITE_OFF", "CLAIM"]), amount: z.number().positive(), note: z.string().max(1000).optional().nullable() });

async function canClear(user: { id: string; orgId: string; role: string }) {
  if (hasRole(user as never, "ADMIN")) return true;
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { department: { select: { code: true, name: true } } } });
  return me?.department?.code === "FIN" || /finance/i.test(me?.department?.name || "");
}

/** Record a cash refund, salary recovery or write-off against an advance (Finance / administrators). */
export const POST = withAuth(async (req, { params, user }) => {
  if (!(await canClear(user))) throw forbidden("Only the Finance Section can clear advances");
  const adv = await prisma.advance.findFirst({ where: { id: params.id, orgId: user.orgId } });
  if (!adv) throw notFound();
  const body = await parseBody(req, schema);
  const updated = await applyClearance(adv.id, body, user.id);
  return ok({ ...updated, amount: Number(updated?.amount), clearedAmount: Number(updated?.clearedAmount) });
});
