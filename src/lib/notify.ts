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

// Notify all users who can approve when a new OT entry is submitted
export async function notifyApprovers(params: {
  submittedByName: string;
  employeeName: string;
  workDate: string;
  entryId: string;
}) {
  const approvers = await prisma.user.findMany({
    where: { canApprove: true, isActive: true },
    select: { id: true },
  });

  await Promise.all(
    approvers.map((a) =>
      createNotification({
        userId: a.id,
        type: "OT_SUBMITTED",
        title: "New OT Entry",
        message: `${params.employeeName} · ${params.workDate} submitted by ${params.submittedByName}`,
        entityId: params.entryId,
        entityType: "OtEntry",
      }),
    ),
  );
}

// Notify the creator of an entry when it's approved or rejected
export async function notifyEntryDecision(params: {
  createdById: string;
  employeeName: string;
  workDate: string;
  entryId: string;
  decision: "APPROVED" | "REJECTED";
  reason?: string | null;
}) {
  const isApproved = params.decision === "APPROVED";
  await createNotification({
    userId: params.createdById,
    type: isApproved ? "OT_APPROVED" : "OT_REJECTED",
    title: isApproved ? "OT Entry Approved" : "OT Entry Rejected",
    message: `${params.employeeName} · ${params.workDate}${params.reason ? ` — ${params.reason}` : ""}`,
    entityId: params.entryId,
    entityType: "OtEntry",
  });
}
