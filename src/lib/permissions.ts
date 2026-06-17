export const PERMISSIONS = {
  OT_VIEW: "ot:view",
  OT_CREATE: "ot:create",
  OT_EDIT: "ot:edit",
  OT_APPROVE: "ot:approve",
  OT_MANUAL_OVERRIDE: "ot:override_manual",
  LOGS_VIEW: "logs:view",
  LOGS_EXPORT: "logs:export",
  ADMIN_USERS: "admin:users",
  ADMIN_ROLES: "admin:roles",
  ADMIN_AUDIT: "admin:audit",
  ADMIN_EMPLOYEES: "admin:employees",
  TRIPLE_DAYS_MANAGE: "triple_days:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  userPermissions: string[],
  permission: Permission,
): boolean {
  return userPermissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: string[],
  permissions: Permission[],
): boolean {
  return permissions.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(
  userPermissions: string[],
  permissions: Permission[],
): boolean {
  return permissions.every((p) => userPermissions.includes(p));
}
