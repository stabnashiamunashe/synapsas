import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, parseBody, withAuth } from "@/lib/api";
import { caseInclude, linkDuplicate, serializeCase } from "@/lib/cases";

/** Mark this case as a duplicate of another (rejects it and links the two). Section heads and above. */
export const POST = withAuth(async (req, { params, user }) => {
  const { originalId } = await parseBody(req, z.object({ originalId: z.string().min(1) }));
  await linkDuplicate(user.orgId, params.id, originalId, user);
  const full = await prisma.case.findUnique({ where: { id: params.id }, include: caseInclude });
  return ok(serializeCase(full!));
}, "MANAGER");
