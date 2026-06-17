import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // Create admin role
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: {
      name: "admin",
      permissions: [
        "ot:view",
        "ot:create",
        "ot:edit",
        "ot:approve",
        "ot:override_manual",
        "logs:view",
        "logs:export",
        "admin:users",
        "admin:roles",
        "admin:audit",
        "admin:employees",
        "triple_days:manage",
      ],
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: "viewer" },
    update: {},
    create: {
      name: "viewer",
      permissions: ["ot:view", "logs:view"],
    },
  });

  // Create default admin user
  const hash = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      email: "admin@otflow.local",
      username: "admin",
      passwordHash: hash,
      roleId: adminRole.id,
      canApprove: true,
      isActive: true,
    },
  });

  // Default decision reasons
  const reasons = [
    { type: "APPROVE", label: "Valid overtime", sort: 0 },
    { type: "APPROVE", label: "Project deadline", sort: 1 },
    { type: "REJECT", label: "Not authorized", sort: 0 },
    { type: "REJECT", label: "Insufficient justification", sort: 1 },
  ];

  for (const r of reasons) {
    await prisma.decisionReason.create({ data: r as any });
  }

  console.log("✅ Seed complete — admin / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
