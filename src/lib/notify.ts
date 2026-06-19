import { prisma } from "@/lib/prisma";

export type NotificationType = "OT_SUBMITTED" | "OT_APPROVED" | "OT_REJECTED";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entityId: params.entityId,
      entityType: params.entityType ?? "OtEntry",
    },
  });
}

// Notify ALL active users who have ot:view permission
// (covers all roles that can see OT entries)
export async function notifyOtViewers(params: {
  submittedByUserId: string; // exclude the submitter themselves
  submittedByName: string;
  employeeName: string;
  workDate: string;
  entryId: string;
}) {
  // Get all roles that have ot:view permission
  const rolesWithView = await prisma.role.findMany({
    where: {
      permissions: { has: "ot:view" },
    },
    select: { id: true },
  });

  const roleIds = rolesWithView.map((r) => r.id);
  if (roleIds.length === 0) return;

  // Get all active users with those roles, excluding the submitter
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roleId: { in: roleIds },
      id: { not: params.submittedByUserId },
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await Promise.all(
    users.map((u) =>
      createNotification({
        userId: u.id,
        type: "OT_SUBMITTED",
        title: "New OT Entry Submitted",
        message: `${params.employeeName} · ${params.workDate} — by ${params.submittedByName}`,
        entityId: params.entryId,
        entityType: "OtEntry",
      }),
    ),
  );
}

// Notify the creator of an entry when it's approved or rejected
export async function notifyEntryDecision(params: {
  createdById: string;
  decidedByUserId: string; // don't notify if deciding own entry
  employeeName: string;
  workDate: string;
  entryId: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
}) {
  // Don't notify if the person approving is the same as who created it
  if (params.createdById === params.decidedByUserId) return;

  const isApproved = params.decision === "APPROVED";

  await createNotification({
    userId: params.createdById,
    type: isApproved ? "OT_APPROVED" : "OT_REJECTED",
    title: isApproved ? "OT Entry Approved ✓" : "OT Entry Rejected",
    message: `${params.employeeName} · ${params.workDate}${params.reason ? ` — ${params.reason}` : ""}`,
    entityId: params.entryId,
    entityType: "OtEntry",
  });
}
