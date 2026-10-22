import { prisma } from "@/lib/prisma";
import { ok, withAuth } from "@/lib/api";
import { hydrate } from "@/lib/json";

/** Approvals waiting on the current user. */
export const GET = withAuth(async (_req, { user }) => {
  const steps = await prisma.requestApproval.findMany({
    where: { approverId: user.id, status: "PENDING", request: { status: "PENDING" } },
    include: {
      request: {
        include: {
          requester: { select: { id: true, name: true, email: true, avatarUrl: true } },
          template: { select: { id: true, name: true, category: true, icon: true, color: true } },
        },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });
  const now = Date.now();
  return ok(
    steps
      .filter((s) => s.levelOrder === s.request.currentLevel)
      .map((s) => ({
        approvalId: s.id,
        levelOrder: s.levelOrder,
        levelName: s.levelName,
        dueAt: s.dueAt,
        overdue: !!s.dueAt && s.dueAt.getTime() < now,
        waitingSince: s.createdAt,
        request: { ...hydrate(s.request, ["data"]), templateSnapshot: undefined, activeLevels: undefined },
      })),
  );
});
