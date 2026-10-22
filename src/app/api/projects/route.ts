import { prisma } from "@/lib/prisma";
import { badRequest, getQuery, ok, parseBody, withAuth } from "@/lib/api";
import { projectSchema } from "@/lib/validators";
import { audit } from "@/lib/notify";
import { clientInfo } from "@/lib/security";
import { projectSummaries, serializeProject } from "@/lib/projects";

const include = { owner: { select: { id: true, name: true } }, _count: { select: { requests: true } } };

/** List projects with cost summaries. ?status=ACTIVE,ON_HOLD  ?q=search  ?all=1 includes closed/archived. */
export const GET = withAuth(async (req, { user }) => {
  const q = getQuery(req);
  const status = q.get("status");
  const search = q.get("q");
  const all = q.get("all") === "1";
  const list = await prisma.project.findMany({
    where: {
      orgId: user.orgId,
      ...(status ? { status: { in: status.split(",") } } : all ? {} : { status: { in: ["ACTIVE", "ON_HOLD"] } }),
      ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
    },
    include,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  const summaries = await projectSummaries(list.map((p) => p.id), new Map(list.map((p) => [p.id, p.budgetAmount])));
  return ok(list.map((p) => ({ ...serializeProject(p), summary: summaries.get(p.id) })));
});

export const POST = withAuth(async (req, { user }) => {
  const body = await parseBody(req, projectSchema);
  const exists = await prisma.project.findUnique({ where: { orgId_code: { orgId: user.orgId, code: body.code } } });
  if (exists) throw badRequest(`Project code ${body.code} is already in use`);
  const p = await prisma.project.create({
    data: {
      orgId: user.orgId, code: body.code, name: body.name, description: body.description, status: body.status || "ACTIVE",
      budgetAmount: body.budgetAmount ?? null, currency: body.currency || "USD", ownerUserId: body.ownerUserId || null, departmentId: body.departmentId || null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null,
    },
    include,
  });
  await audit(user.orgId, user.id, "project.created", "Project", p.id, { code: p.code, budget: body.budgetAmount }, clientInfo(req));
  return ok({ ...serializeProject(p), summary: (await projectSummaries([p.id], new Map([[p.id, p.budgetAmount]]))).get(p.id) }, { status: 201 });
}, "MANAGER");
