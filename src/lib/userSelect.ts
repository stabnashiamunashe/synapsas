/** Safe projection of a User row for API responses (never includes password/2FA secrets). */
export const userSelect = {
  id: true, name: true, email: true, role: true, jobTitle: true, avatarUrl: true, isActive: true,
  departmentId: true, managerId: true, lastLoginAt: true, lastLoginIp: true, createdAt: true,
  twoFactorEnabled: true, forcePasswordChange: true, lockedUntil: true, prefs: true,
  department: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
} as const;
