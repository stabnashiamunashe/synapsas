import { badRequest } from "./api";

export function validateLevels(
  levels: { order?: number; approverType: string; approverUserIds?: string[]; approverRole?: string; fieldKey?: string; returnTo?: "REQUESTER" | number | null }[],
) {
  levels.forEach((l, i) => {
    const order = i + 1;
    if (typeof l.returnTo === "number" && (l.returnTo >= order || l.returnTo < 1))
      throw badRequest(`Level ${order} can only loop back to an earlier level`);
  });
  for (const l of levels) {
    if (l.approverType === "USER" && !(l.approverUserIds && l.approverUserIds.length))
      throw badRequest("Each 'Specific users' level needs at least one approver");
    if (l.approverType === "ROLE" && !l.approverRole) throw badRequest("Role levels need a role");
    if ((l.approverType === "FIELD_USER" || l.approverType === "FIELD_DEPARTMENT_HEAD") && !l.fieldKey)
      throw badRequest("Field-based levels need a form field key");
  }
}

export function validateFieldKeys(fields: { key: string }[]) {
  const seen = new Set<string>();
  for (const f of fields) {
    if (seen.has(f.key)) throw badRequest(`Duplicate field key "${f.key}"`);
    seen.add(f.key);
  }
}
