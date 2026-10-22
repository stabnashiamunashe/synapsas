import { getQuery } from "./api";

/** Shared audit-log filter parsing for list and export routes. */
export function auditWhere(req: Request, orgId: string) {
  const q = getQuery(req);
  const action = q.get("action") || undefined;
  const entityType = q.get("entityType") || undefined;
  const userId = q.get("userId") || undefined;
  const entityId = q.get("entityId") || undefined;
  const from = q.get("from");
  const to = q.get("to");
  const category = q.get("category"); // auth | request | admin
  return {
    orgId,
    ...(action ? { action: { contains: action } } : {}),
    ...(category === "auth" ? { action: { startsWith: "auth." } } : {}),
    ...(category === "request" ? { action: { startsWith: "request." } } : {}),
    ...(category === "admin" ? { NOT: [{ action: { startsWith: "auth." } }, { action: { startsWith: "request." } }] } : {}),
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
  };
}
