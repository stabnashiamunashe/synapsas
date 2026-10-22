// Client-safe role helpers (no server-only imports).
import type { Role, SessionUser } from "./types";

export const ROLE_RANK: Record<Role, number> = {
  OWNER: 4,
  ADMIN: 3,
  MANAGER: 2,
  MEMBER: 1,
};

export function hasRole(user: Pick<SessionUser, "role">, min: Role) {
  return ROLE_RANK[user.role] >= ROLE_RANK[min];
}
