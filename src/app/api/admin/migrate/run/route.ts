export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

interface MigrateOptions {
  uri: string;
  collections: {
    employees: boolean;
    otEntries: boolean;
    tripleOtDays: boolean;
    decisionReasons: boolean;
    users: boolean;
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  const permissions = (session.user as any).permissions ?? [];
  if (!permissions.includes("admin:users"))
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });

  const options: MigrateOptions = await req.json();
  const { uri, collections: cols } = options;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: object) {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      }

      let client: MongoClient | null = null;
      const results: Record<
        string,
        { migrated: number; skipped: number; errors: string[] }
      > = {};

      try {
        send("status", { message: "Connecting to MongoDB..." });

        client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
        await client.connect();
        const db = client.db();

        send("status", { message: "Connected. Starting migration..." });

        const empIdMap = new Map<string, string>();

        // ── 1. Employees ──────────────────────────────────────────
        if (cols.employees) {
          results.employees = { migrated: 0, skipped: 0, errors: [] };
          send("collection_start", { key: "employees", label: "Employees" });

          const docs = await db
            .collection("employees")
            .find({ isDeleted: { $ne: true } })
            .toArray();

          send("collection_total", { key: "employees", total: docs.length });

          for (const doc of docs) {
            try {
              const existing = await prisma.employee.findUnique({
                where: { empId: doc.empId },
              });
              if (existing) {
                empIdMap.set(doc._id.toString(), existing.id);
                results.employees.skipped++;
              } else {
                const created = await prisma.employee.create({
                  data: {
                    empId: doc.empId,
                    name: doc.name,
                    addedDate: doc.createdAt
                      ? new Date(doc.createdAt)
                      : new Date(),
                    isDeleted: false,
                  },
                });
                empIdMap.set(doc._id.toString(), created.id);
                results.employees.migrated++;
              }
            } catch (e: any) {
              results.employees.errors.push(`${doc.empId}: ${e.message}`);
            }
            send("collection_progress", {
              key: "employees",
              migrated: results.employees.migrated,
              skipped: results.employees.skipped,
              errors: results.employees.errors.length,
            });
          }

          send("collection_done", {
            key: "employees",
            result: results.employees,
          });
        } else {
          const existing = await prisma.employee.findMany({
            select: { id: true, empId: true },
          });
          const mongoEmps = await db.collection("employees").find({}).toArray();
          for (const doc of mongoEmps) {
            const match = existing.find((e) => e.empId === doc.empId);
            if (match) empIdMap.set(doc._id.toString(), match.id);
          }
        }

        // ── 2. Triple OT Days ─────────────────────────────────────
        if (cols.tripleOtDays) {
          results.tripleOtDays = { migrated: 0, skipped: 0, errors: [] };
          send("collection_start", {
            key: "tripleOtDays",
            label: "Triple OT Days",
          });

          const docs = await db.collection("tripleotdays").find({}).toArray();
          send("collection_total", { key: "tripleOtDays", total: docs.length });

          for (const doc of docs) {
            try {
              const existing = await prisma.tripleOtDay.findUnique({
                where: { date: doc.date },
              });
              if (existing) {
                results.tripleOtDays.skipped++;
              } else {
                await prisma.tripleOtDay.create({
                  data: { date: doc.date, note: doc.note ?? null },
                });
                results.tripleOtDays.migrated++;
              }
            } catch (e: any) {
              results.tripleOtDays.errors.push(`${doc.date}: ${e.message}`);
            }
            send("collection_progress", {
              key: "tripleOtDays",
              migrated: results.tripleOtDays.migrated,
              skipped: results.tripleOtDays.skipped,
              errors: results.tripleOtDays.errors.length,
            });
          }

          send("collection_done", {
            key: "tripleOtDays",
            result: results.tripleOtDays,
          });
        }

        // ── 3. Decision Reasons ───────────────────────────────────
        if (cols.decisionReasons) {
          results.decisionReasons = { migrated: 0, skipped: 0, errors: [] };
          send("collection_start", {
            key: "decisionReasons",
            label: "Decision Reasons",
          });

          const docs = await db
            .collection("decisionreasons")
            .find({})
            .toArray();
          send("collection_total", {
            key: "decisionReasons",
            total: docs.length,
          });

          for (const doc of docs) {
            try {
              const existing = await prisma.decisionReason.findFirst({
                where: { type: doc.type, label: doc.label },
              });
              if (existing) {
                results.decisionReasons.skipped++;
              } else {
                await prisma.decisionReason.create({
                  data: {
                    type: doc.type,
                    label: doc.label,
                    active: doc.active ?? true,
                    sort: doc.sort ?? 0,
                  },
                });
                results.decisionReasons.migrated++;
              }
            } catch (e: any) {
              results.decisionReasons.errors.push(`${doc.label}: ${e.message}`);
            }
            send("collection_progress", {
              key: "decisionReasons",
              migrated: results.decisionReasons.migrated,
              skipped: results.decisionReasons.skipped,
              errors: results.decisionReasons.errors.length,
            });
          }

          send("collection_done", {
            key: "decisionReasons",
            result: results.decisionReasons,
          });
        }

        // ── 4. Users ──────────────────────────────────────────────
        if (cols.users) {
          results.users = { migrated: 0, skipped: 0, errors: [] };
          send("collection_start", { key: "users", label: "Users & Roles" });

          const mongoRoles = await db.collection("roles").find({}).toArray();
          const roleIdMap = new Map<string, string>();

          for (const role of mongoRoles) {
            try {
              let prismaRole = await prisma.role.findUnique({
                where: { name: role.name },
              });
              if (!prismaRole) {
                prismaRole = await prisma.role.create({
                  data: {
                    name: role.name,
                    permissions: role.permissions ?? [],
                  },
                });
              }
              roleIdMap.set(role._id.toString(), prismaRole.id);
            } catch {}
          }

          const docs = await db.collection("users").find({}).toArray();
          send("collection_total", { key: "users", total: docs.length });

          for (const doc of docs) {
            try {
              const existing = await prisma.user.findFirst({
                where: {
                  OR: [{ email: doc.email }, { username: doc.username }],
                },
              });
              if (existing) {
                results.users.skipped++;
              } else {
                const roleId = doc.roleId
                  ? roleIdMap.get(doc.roleId.toString())
                  : null;
                const fallbackRole = await prisma.role.findFirst({
                  where: { name: "viewer" },
                });
                const finalRoleId = roleId ?? fallbackRole?.id;
                if (!finalRoleId) {
                  results.users.errors.push(
                    `${doc.username}: no matching role`,
                  );
                } else {
                  await prisma.user.create({
                    data: {
                      email: doc.email,
                      username: doc.username,
                      passwordHash:
                        doc.passwordHash ??
                        (await bcrypt.hash("changeme123", 12)),
                      roleId: finalRoleId,
                      canApprove: doc.canApprove ?? false,
                      isActive: doc.isActive ?? true,
                    },
                  });
                  results.users.migrated++;
                }
              }
            } catch (e: any) {
              results.users.errors.push(`${doc.username}: ${e.message}`);
            }
            send("collection_progress", {
              key: "users",
              migrated: results.users.migrated,
              skipped: results.users.skipped,
              errors: results.users.errors.length,
            });
          }

          send("collection_done", { key: "users", result: results.users });
        }

        // ── 5. OT Entries ─────────────────────────────────────────
        if (cols.otEntries) {
          results.otEntries = { migrated: 0, skipped: 0, errors: [] };
          send("collection_start", { key: "otEntries", label: "OT Entries" });

          const docs = await db.collection("otentries").find({}).toArray();
          send("collection_total", { key: "otEntries", total: docs.length });

          for (const doc of docs) {
            try {
              const employeeId = empIdMap.get(doc.employeeId?.toString());
              if (!employeeId) {
                results.otEntries.errors.push(
                  `Entry ${doc._id}: employee not found (${doc.employeeId})`,
                );
              } else {
                const existing = await prisma.otEntry.findUnique({
                  where: {
                    employeeId_workDate: { employeeId, workDate: doc.workDate },
                  },
                });
                if (existing) {
                  results.otEntries.skipped++;
                } else {
                  await prisma.otEntry.create({
                    data: {
                      employeeId,
                      workDate: doc.workDate,
                      shift: doc.shift,
                      inTime: doc.inTime ?? null,
                      outTime: doc.outTime ?? null,
                      reason: doc.reason ?? null,
                      normalMinutes: doc.normalMinutes ?? 0,
                      doubleMinutes: doc.doubleMinutes ?? 0,
                      tripleMinutes: doc.tripleMinutes ?? 0,
                      isNight: doc.isNight ?? false,
                      approvedNormalMinutes: doc.approvedNormalMinutes ?? 0,
                      approvedDoubleMinutes: doc.approvedDoubleMinutes ?? 0,
                      approvedTripleMinutes: doc.approvedTripleMinutes ?? 0,
                      approvedTotalMinutes: doc.approvedTotalMinutes ?? 0,
                      isApprovedOverride: doc.isApprovedOverride ?? false,
                      status: doc.status ?? "PENDING",
                      decisionReason: doc.decisionReason ?? null,
                      decidedAt: doc.decidedAt ? new Date(doc.decidedAt) : null,
                      manualOverride: doc.manualOverride ?? false,
                    },
                  });
                  results.otEntries.migrated++;
                }
              }
            } catch (e: any) {
              results.otEntries.errors.push(`Entry ${doc._id}: ${e.message}`);
            }
            send("collection_progress", {
              key: "otEntries",
              migrated: results.otEntries.migrated,
              skipped: results.otEntries.skipped,
              errors: results.otEntries.errors.length,
            });
          }

          send("collection_done", {
            key: "otEntries",
            result: results.otEntries,
          });
        }

        // Audit log
        await prisma.auditLog.create({
          data: {
            entityType: "System",
            entityId: "migration",
            action: "MIGRATE",
            actorUserId: (session.user as any).id,
            diff: { after: results },
          },
        });

        send("done", { success: true, results });
      } catch (e: any) {
        send("error", { message: e.message ?? "Migration failed" });
      } finally {
        await client?.close();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
