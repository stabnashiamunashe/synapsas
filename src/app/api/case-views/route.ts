import { prisma } from "@/lib/prisma";
import { ok, parseBody, withAuth } from "@/lib/api";
import { savedViewSchema } from "@/lib/validators";
import { hydrate, toJson } from "@/lib/json";

export const GET = withAuth(async (_req, { user }) => {
  const list = await prisma.savedView.findMany({ where: { orgId: user.orgId, userId: user.id }, orderBy: { createdAt: "asc" } });
  return ok(list.map((v) => hydrate(v, ["filters"])));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, savedViewSchema);
  if (body.isDefault) await prisma.savedView.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  const v = await prisma.savedView.create({ data: { orgId: user.orgId, userId: user.id, name: body.name, filters: toJson(body.filters), isDefault: !!body.isDefault } });
  return ok(hydrate(v, ["filters"]), { status: 201 });
});
