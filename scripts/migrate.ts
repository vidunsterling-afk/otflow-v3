/* eslint-disable @typescript-eslint/no-explicit-any */
import { MongoClient } from "mongodb";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// ── Load .env.local manually ──────────────────────────────────────────────────
function loadEnvFile(filePath: string, override = false) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (override || !process.env[key]) process.env[key] = val;
    }
  } catch {}
}

loadEnvFile(path.resolve(process.cwd(), ".env"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"), true);

// ── Readline ──────────────────────────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function ask(q: string): Promise<string> {
  return new Promise((res) => rl.question(q, res));
}
function askYN(q: string): Promise<boolean> {
  return new Promise((res) =>
    rl.question(`${q} (y/n): `, (a) => res(a.trim().toLowerCase() === "y")),
  );
}

// ── Chalk (ESM) ───────────────────────────────────────────────────────────────
let chalk: any;
async function getChalk() {
  if (!chalk) {
    const m = await import("chalk");
    chalk = m.default;
  }
  return chalk;
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function bar(cur: number, tot: number, w = 32): string {
  const pct = tot === 0 ? 1 : Math.min(cur / tot, 1);
  const f = Math.round(pct * w);
  return `[${"█".repeat(f)}${"░".repeat(w - f)}] ${cur}/${tot} (${Math.round(pct * 100)}%)`;
}

// ── PostgreSQL pool ───────────────────────────────────────────────────────────
function makePgPool(): Pool {
  // For CLI: prefer pooler URL since direct host may be blocked by corporate networks
  // Strip pgbouncer param — not needed for pg driver directly
  const rawUrl =
    process.env.MIGRATION_DB_URL ??
    process.env.DATABASE_URL ??
    process.env.DIRECT_URL;

  if (!rawUrl) {
    console.error("\nERROR: No DATABASE_URL found.\n");
    process.exit(1);
  }

  // Remove pgbouncer=true if present — pg driver doesn't need it
  const url = rawUrl.replace(/[?&]pgbouncer=true/g, "").replace(/\?$/, "");

  const masked = url.replace(/:([^:@\s]+)@/, ":***@");
  console.log(chalk.gray(`  Using DB: ${masked}`));

  return new Pool({
    connectionString: url,
    max: 3,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
}

// ── cuid-compatible ID generator (no deps) ────────────────────────────────────
let _cuidCounter = 0;
function cuid(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const cnt = (++_cuidCounter).toString(36).padStart(4, "0");
  return `c${ts}${cnt}${rand}`;
}

// ── Clear helpers ─────────────────────────────────────────────────────────────
async function clearTable(
  pg: Pool,
  target: string,
  selfId: string,
): Promise<number> {
  try {
    switch (target) {
      case "otEntries": {
        const r = await pg.query(`DELETE FROM "OtEntry"`);
        return r.rowCount ?? 0;
      }
      case "auditLogs": {
        const r = await pg.query(`DELETE FROM "AuditLog"`);
        return r.rowCount ?? 0;
      }
      case "employees": {
        const r = await pg.query(`DELETE FROM "Employee"`);
        return r.rowCount ?? 0;
      }
      case "tripleOtDays": {
        const r = await pg.query(`DELETE FROM "TripleOtDay"`);
        return r.rowCount ?? 0;
      }
      case "decisionReasons": {
        const r = await pg.query(`DELETE FROM "DecisionReason"`);
        return r.rowCount ?? 0;
      }
      case "users": {
        const r = await pg.query(`DELETE FROM "User" WHERE id != $1`, [selfId]);
        return r.rowCount ?? 0;
      }
      case "roles": {
        const used = await pg.query(`SELECT "roleId" FROM "User"`);
        const ids = used.rows.map((r: any) => r.roleId);
        if (ids.length === 0) {
          const r = await pg.query(`DELETE FROM "Role"`);
          return r.rowCount ?? 0;
        }
        const placeholders = ids
          .map((_: any, i: number) => `$${i + 1}`)
          .join(",");
        const r = await pg.query(
          `DELETE FROM "Role" WHERE id NOT IN (${placeholders})`,
          ids,
        );
        return r.rowCount ?? 0;
      }
      default:
        return 0;
    }
  } catch (e: any) {
    console.log(chalk.yellow(`  Warning clearing ${target}: ${e.message}`));
    return 0;
  }
}

// ── Migrate employees ─────────────────────────────────────────────────────────
async function migrateEmployees(
  db: any,
  pg: Pool,
): Promise<{
  migrated: number;
  skipped: number;
  errors: string[];
  empIdMap: Map<string, string>;
}> {
  const empIdMap = new Map<string, string>();
  const docs = await db
    .collection("employees")
    .find({ isDeleted: { $ne: true } })
    .toArray();
  if (docs.length === 0) {
    console.log(chalk.yellow("  No employee docs found"));
    return { migrated: 0, skipped: 0, errors: [], empIdMap };
  }

  let migrated = 0,
    skipped = 0;
  const errors: string[] = [];
  const total = docs.length;
  process.stdout.write("\n");

  for (let i = 0; i < total; i++) {
    const doc = docs[i];
    try {
      const existing = await pg.query(
        `SELECT id FROM "Employee" WHERE "empId" = $1`,
        [doc.empId],
      );
      if (existing.rows.length > 0) {
        empIdMap.set(doc._id.toString(), existing.rows[0].id);
        skipped++;
      } else {
        const id = cuid();
        await pg.query(
          `INSERT INTO "Employee" (id, "empId", name, "addedDate", "isDeleted", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,false,$5,$5)`,
          [
            id,
            doc.empId,
            doc.name,
            doc.createdAt ? new Date(doc.createdAt) : new Date(),
            new Date(),
          ],
        );
        empIdMap.set(doc._id.toString(), id);
        migrated++;
      }
    } catch (e: any) {
      errors.push(`${doc.empId}: ${e.message}`);
    }
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(
      `  ${chalk.cyan("Employees")}: ${bar(i + 1, total)}  ` +
        chalk.green(`✓ ${migrated}`) +
        "  " +
        chalk.gray(`↷ ${skipped}`) +
        (errors.length > 0 ? "  " + chalk.red(`✗ ${errors.length}`) : ""),
    );
  }
  process.stdout.write("\n");
  return { migrated, skipped, errors, empIdMap };
}

// ── Build empIdMap from existing PG employees ─────────────────────────────────
async function buildEmpIdMap(db: any, pg: Pool): Promise<Map<string, string>> {
  const empIdMap = new Map<string, string>();
  const pgEmps = await pg.query(`SELECT id, "empId" FROM "Employee"`);
  const mongoEmps = await db.collection("employees").find({}).toArray();
  for (const doc of mongoEmps) {
    const match = pgEmps.rows.find((r: any) => r.empId === doc.empId);
    if (match) empIdMap.set(doc._id.toString(), match.id);
  }
  return empIdMap;
}

// ── Migrate triple days ───────────────────────────────────────────────────────
async function migrateTripleDays(db: any, pg: Pool) {
  const docs = await db.collection("tripleotdays").find({}).toArray();
  if (docs.length === 0) {
    console.log(chalk.yellow("  No triple day docs found"));
    return { migrated: 0, skipped: 0, errors: [] };
  }

  let migrated = 0,
    skipped = 0;
  const errors: string[] = [];
  process.stdout.write("\n");

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    try {
      const ex = await pg.query(
        `SELECT id FROM "TripleOtDay" WHERE date = $1`,
        [doc.date],
      );
      if (ex.rows.length > 0) {
        skipped++;
      } else {
        await pg.query(
          `INSERT INTO "TripleOtDay" (id, date, note, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$4)`,
          [cuid(), doc.date, doc.note ?? null, new Date()],
        );
        migrated++;
      }
    } catch (e: any) {
      errors.push(`${doc.date}: ${e.message}`);
    }
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(
      `  ${chalk.cyan("Triple Days")}: ${bar(i + 1, docs.length)}  ` +
        chalk.green(`✓ ${migrated}`) +
        "  " +
        chalk.gray(`↷ ${skipped}`),
    );
  }
  process.stdout.write("\n");
  return { migrated, skipped, errors };
}

// ── Migrate decision reasons ──────────────────────────────────────────────────
async function migrateDecisionReasons(db: any, pg: Pool) {
  const docs = await db.collection("decisionreasons").find({}).toArray();
  if (docs.length === 0) {
    console.log(chalk.yellow("  No decision reason docs found"));
    return { migrated: 0, skipped: 0, errors: [] };
  }

  let migrated = 0,
    skipped = 0;
  const errors: string[] = [];
  process.stdout.write("\n");

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    try {
      const ex = await pg.query(
        `SELECT id FROM "DecisionReason" WHERE type=$1 AND label=$2`,
        [doc.type, doc.label],
      );
      if (ex.rows.length > 0) {
        skipped++;
      } else {
        await pg.query(
          `INSERT INTO "DecisionReason" (id, type, label, active, sort, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$6)`,
          [
            cuid(),
            doc.type,
            doc.label,
            doc.active ?? true,
            doc.sort ?? 0,
            new Date(),
          ],
        );
        migrated++;
      }
    } catch (e: any) {
      errors.push(`${doc.label}: ${e.message}`);
    }
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(
      `  ${chalk.cyan("Decision Reasons")}: ${bar(i + 1, docs.length)}  ` +
        chalk.green(`✓ ${migrated}`) +
        "  " +
        chalk.gray(`↷ ${skipped}`),
    );
  }
  process.stdout.write("\n");
  return { migrated, skipped, errors };
}

// ── Migrate users ─────────────────────────────────────────────────────────────
async function migrateUsers(db: any, pg: Pool) {
  // Roles first
  const mongoRoles = await db.collection("roles").find({}).toArray();
  const roleIdMap = new Map<string, string>();
  for (const role of mongoRoles) {
    try {
      const ex = await pg.query(`SELECT id FROM "Role" WHERE name=$1`, [
        role.name,
      ]);
      if (ex.rows.length > 0) {
        roleIdMap.set(role._id.toString(), ex.rows[0].id);
      } else {
        const id = cuid();
        const perms = Array.isArray(role.permissions) ? role.permissions : [];
        await pg.query(
          `INSERT INTO "Role" (id, name, permissions, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$4)`,
          [id, role.name, perms, new Date()],
        );
        roleIdMap.set(role._id.toString(), id);
      }
    } catch {}
  }

  const docs = await db.collection("users").find({}).toArray();
  if (docs.length === 0) {
    console.log(chalk.yellow("  No user docs found"));
    return { migrated: 0, skipped: 0, errors: [] };
  }

  const fallback = await pg.query(
    `SELECT id FROM "Role" WHERE name='viewer' LIMIT 1`,
  );
  const fallbackRoleId = fallback.rows[0]?.id ?? null;
  let migrated = 0,
    skipped = 0;
  const errors: string[] = [];
  process.stdout.write("\n");

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    try {
      const ex = await pg.query(
        `SELECT id FROM "User" WHERE email=$1 OR username=$2`,
        [doc.email, doc.username],
      );
      if (ex.rows.length > 0) {
        skipped++;
      } else {
        const roleId = doc.roleId ? roleIdMap.get(doc.roleId.toString()) : null;
        const finalRoleId = roleId ?? fallbackRoleId;
        if (!finalRoleId) {
          errors.push(`${doc.username}: no role`);
          continue;
        }
        await pg.query(
          `INSERT INTO "User" (id, email, username, "passwordHash", "roleId", "canApprove", "isActive", "activeStatus", "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,'offline',$8,$8)`,
          [
            cuid(),
            doc.email,
            doc.username,
            doc.passwordHash,
            finalRoleId,
            doc.canApprove ?? false,
            doc.isActive ?? true,
            new Date(),
          ],
        );
        migrated++;
      }
    } catch (e: any) {
      errors.push(`${doc.username}: ${e.message}`);
    }
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    process.stdout.write(
      `  ${chalk.cyan("Users")}: ${bar(i + 1, docs.length)}  ` +
        chalk.green(`✓ ${migrated}`) +
        "  " +
        chalk.gray(`↷ ${skipped}`),
    );
  }
  process.stdout.write("\n");
  return { migrated, skipped, errors };
}

// ── Migrate OT entries (cursor streaming) ────────────────────────────────────
async function migrateOtEntries(
  db: any,
  pg: Pool,
  empIdMap: Map<string, string>,
  batchSize: number,
) {
  const total = await db.collection("otentries").countDocuments();
  console.log(
    chalk.cyan(`\n  Found ${total.toLocaleString()} OT entries in source DB`),
  );
  if (total === 0) return { migrated: 0, skipped: 0, errors: [] };

  const logFile = path.join(process.cwd(), "migration-errors.log");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  let migrated = 0,
    skipped = 0;
  const errors: string[] = [];
  let processed = 0;
  let buffer: any[] = [];

  const flushBuffer = async (batch: any[]) => {
    await Promise.all(
      batch.map(async (doc) => {
        try {
          const employeeId = empIdMap.get(doc.employeeId?.toString());
          if (!employeeId) {
            const msg = `[SKIP] ${doc._id}: employee ${doc.employeeId} not in map`;
            errors.push(msg);
            logStream.write(msg + "\n");
            return;
          }

          const ex = await pg.query(
            `SELECT id FROM "OtEntry" WHERE "employeeId"=$1 AND "workDate"=$2`,
            [employeeId, doc.workDate],
          );
          if (ex.rows.length > 0) {
            skipped++;
            return;
          }

          await pg.query(
            `INSERT INTO "OtEntry" (
            id, "employeeId", "workDate", shift, "inTime", "outTime", reason,
            "normalMinutes", "doubleMinutes", "tripleMinutes", "isNight",
            "approvedNormalMinutes", "approvedDoubleMinutes", "approvedTripleMinutes",
            "approvedTotalMinutes", "isApprovedOverride", status, "decisionReason",
            "decidedAt", "manualOverride", "createdAt", "updatedAt"
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,
            $12,$13,$14,
            $15,$16,$17,$18,
            $19,$20,$21,$21
          )`,
            [
              cuid(),
              employeeId,
              doc.workDate,
              doc.shift ?? "Shift 1",
              doc.inTime ?? null,
              doc.outTime ?? null,
              doc.reason ?? null,
              doc.normalMinutes ?? 0,
              doc.doubleMinutes ?? 0,
              doc.tripleMinutes ?? 0,
              doc.isNight ?? false,
              doc.approvedNormalMinutes ?? 0,
              doc.approvedDoubleMinutes ?? 0,
              doc.approvedTripleMinutes ?? 0,
              doc.approvedTotalMinutes ?? 0,
              doc.isApprovedOverride ?? false,
              doc.status ?? "PENDING",
              doc.decisionReason ?? null,
              doc.decidedAt ? new Date(doc.decidedAt) : null,
              doc.manualOverride ?? false,
              new Date(),
            ],
          );
          migrated++;
        } catch (e: any) {
          const msg = `[ERROR] ${doc._id}: ${e.message}`;
          errors.push(msg);
          logStream.write(msg + "\n");
        }
      }),
    );
  };

  process.stdout.write("\n");
  const cursor = db.collection("otentries").find({});

  for await (const doc of cursor) {
    buffer.push(doc);
    processed++;

    if (buffer.length >= batchSize) {
      await flushBuffer(buffer);
      buffer = [];
      process.stdout.clearLine?.(0);
      process.stdout.cursorTo?.(0);
      process.stdout.write(
        `  ${chalk.cyan("OT Entries")}: ${bar(processed, total)}  ` +
          chalk.green(`✓ ${migrated}`) +
          "  " +
          chalk.gray(`↷ ${skipped}`) +
          "  " +
          (errors.length > 0 ? chalk.red(`✗ ${errors.length}`) : ""),
      );
    }
  }

  if (buffer.length > 0) {
    await flushBuffer(buffer);
  }

  process.stdout.clearLine?.(0);
  process.stdout.cursorTo?.(0);
  process.stdout.write(
    `  ${chalk.cyan("OT Entries")}: ${bar(total, total)}  ` +
      chalk.green(`✓ ${migrated}`) +
      "  " +
      chalk.gray(`↷ ${skipped}`) +
      "  " +
      (errors.length > 0
        ? chalk.red(`✗ ${errors.length}`)
        : chalk.green("0 errors")) +
      "\n",
  );

  logStream.end();
  if (errors.length > 0) {
    console.log(chalk.yellow(`\n  Errors saved to: ${logFile}`));
  }

  return { migrated, skipped, errors };
}

// ── Summary ───────────────────────────────────────────────────────────────────
function printSummary(
  results: Record<
    string,
    { migrated: number; skipped: number; errors: string[] }
  >,
) {
  console.log("\n" + chalk.bold("─".repeat(64)));
  console.log(chalk.bold("  Migration Summary"));
  console.log(chalk.bold("─".repeat(64)));
  let tm = 0,
    ts = 0,
    te = 0;
  for (const [key, r] of Object.entries(results)) {
    tm += r.migrated;
    ts += r.skipped;
    te += r.errors.length;
    const icon = r.errors.length > 0 ? chalk.yellow("⚠") : chalk.green("✓");
    console.log(
      `  ${icon} ${chalk.bold(key.padEnd(22))}` +
        chalk.green(`${String(r.migrated).padStart(6)} migrated`) +
        "  " +
        chalk.gray(`${String(r.skipped).padStart(6)} skipped`) +
        "  " +
        (r.errors.length > 0
          ? chalk.red(`${r.errors.length} errors`)
          : chalk.green("0 errors")),
    );
  }
  console.log(chalk.bold("─".repeat(64)));
  console.log(
    `  ${"TOTAL".padEnd(23)}` +
      chalk.green(`${String(tm).padStart(6)} migrated`) +
      "  " +
      chalk.gray(`${String(ts).padStart(6)} skipped`) +
      "  " +
      (te > 0 ? chalk.red(`${te} errors`) : chalk.green("0 errors")),
  );
  console.log(chalk.bold("─".repeat(64)) + "\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await getChalk();

  console.log(
    "\n" + chalk.bold.blue("╔══════════════════════════════════════╗"),
  );
  console.log(chalk.bold.blue("║   OTFlow V2 → V3 Migration Tool      ║"));
  console.log(
    chalk.bold.blue("╚══════════════════════════════════════╝") + "\n",
  );

  // MongoDB URI
  let mongoUri = process.env.MONGO_URI ?? "";
  if (!mongoUri) {
    mongoUri = await ask(chalk.cyan("Enter MongoDB URI: "));
  } else {
    console.log(chalk.green("✓ Using MONGO_URI from environment"));
  }
  if (!mongoUri.trim()) {
    console.log(chalk.red("No URI provided."));
    process.exit(1);
  }

  // Connect MongoDB
  console.log(chalk.gray("\nConnecting to MongoDB..."));
  let mongoClient: MongoClient;
  try {
    mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    await mongoClient.connect();
  } catch (e: any) {
    console.error(chalk.red(`MongoDB connection failed: ${e.message}`));
    process.exit(1);
  }
  const db = mongoClient.db();
  console.log(chalk.green(`✓ Connected to "${db.databaseName}"`));

  // Connect PostgreSQL
  console.log(chalk.gray("Connecting to PostgreSQL..."));
  const pg = makePgPool();
  try {
    await pg.query("SELECT 1");
    console.log(chalk.green("✓ PostgreSQL connected\n"));
  } catch (e: any) {
    console.error(chalk.red(`PostgreSQL connection failed: ${e.message}`));
    process.exit(1);
  }

  // List collections
  const colls = await db.listCollections().toArray();
  const counts: Record<string, number> = {};
  for (const c of colls)
    counts[c.name] = await db.collection(c.name).countDocuments();

  console.log(chalk.bold("Source collections:"));
  for (const [name, count] of Object.entries(counts)) {
    console.log(
      `  ${chalk.cyan(name.padEnd(28))} ${chalk.yellow(count.toLocaleString())} docs`,
    );
  }

  // Get actor for audit
  const actorRow = await pg.query(
    `SELECT id FROM "User" WHERE "isActive"=true LIMIT 1`,
  );
  const actorId = actorRow.rows[0]?.id ?? "system";

  // ── Clear options ────────────────────────────────────────────────────────
  console.log("\n" + chalk.bold.yellow("── Clear existing data (optional) ──"));
  const CLEARABLE = [
    { key: "otEntries", label: "OT Entries", danger: true },
    { key: "employees", label: "Employees", danger: true },
    { key: "tripleOtDays", label: "Triple OT Days", danger: false },
    { key: "decisionReasons", label: "Decision Reasons", danger: false },
    { key: "auditLogs", label: "Audit Logs", danger: true },
    { key: "users", label: "Users (keep self)", danger: true },
    { key: "roles", label: "Roles (unused only)", danger: false },
  ];

  const clearTargets: string[] = [];
  for (const { key, label, danger } of CLEARABLE) {
    const tag = danger ? chalk.red(" [DANGER]") : "";
    if (await askYN(`  Clear ${label}?${tag}`)) clearTargets.push(key);
  }

  if (clearTargets.length > 0) {
    if (
      await askYN(
        chalk.red(`\n  Confirm clearing: ${clearTargets.join(", ")}?`),
      )
    ) {
      for (const t of clearTargets) {
        const n = await clearTable(pg, t, actorId);
        console.log(chalk.green(`  ✓ Cleared ${t}: ${n} rows`));
      }
    } else {
      console.log(chalk.gray("  Skipped clearing."));
    }
  }

  // ── Select migrations ────────────────────────────────────────────────────
  console.log("\n" + chalk.bold.blue("── Select collections to migrate ──"));
  const OPTIONS = [
    {
      key: "employees",
      label: "Employees",
      check: colls.some((c) => c.name === "employees"),
    },
    {
      key: "otEntries",
      label: "OT Entries",
      check: colls.some((c) => c.name === "otentries"),
    },
    {
      key: "tripleOtDays",
      label: "Triple OT Days",
      check: colls.some((c) => c.name === "tripleotdays"),
    },
    {
      key: "decisionReasons",
      label: "Decision Reasons",
      check: colls.some((c) => c.name === "decisionreasons"),
    },
    {
      key: "users",
      label: "Users & Roles",
      check: colls.some((c) => c.name === "users"),
    },
  ];

  const toMigrate: Record<string, boolean> = {};
  for (const { key, label, check } of OPTIONS) {
    if (!check) {
      console.log(chalk.gray(`  ${label}: not found — skipping`));
      toMigrate[key] = false;
      continue;
    }
    toMigrate[key] = await askYN(
      `  Migrate ${chalk.bold(label)} (${(counts[key === "otEntries" ? "otentries" : key === "tripleOtDays" ? "tripleotdays" : key === "decisionReasons" ? "decisionreasons" : key] ?? 0).toLocaleString()} docs)?`,
    );
  }

  let batchSize = 25;
  if (toMigrate.otEntries) {
    const custom = await ask(
      chalk.cyan(
        `  OT batch size (default ${batchSize}, press Enter to keep): `,
      ),
    );
    if (custom.trim() && !isNaN(Number(custom)))
      batchSize = Math.max(1, Math.min(200, Number(custom)));
  }

  const selected = Object.entries(toMigrate)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (selected.length === 0) {
    console.log(chalk.yellow("\nNothing selected."));
    process.exit(0);
  }

  if (
    !(await askYN(
      chalk.bold(`\nMigrate: ${chalk.cyan(selected.join(", "))}. Start now?`),
    ))
  ) {
    console.log(chalk.yellow("Cancelled."));
    process.exit(0);
  }

  // ── Run ──────────────────────────────────────────────────────────────────
  console.log("\n" + chalk.bold.blue("── Running ──\n"));
  const results: Record<string, any> = {};

  let empIdMap = new Map<string, string>();

  if (toMigrate.employees) {
    console.log(chalk.bold("  Employees"));
    const { empIdMap: map, ...result } = await migrateEmployees(db, pg);
    results.employees = result;
    empIdMap = map;
  } else if (toMigrate.otEntries) {
    console.log(chalk.gray("  Building employee ID map..."));
    empIdMap = await buildEmpIdMap(db, pg);
    console.log(chalk.green(`  ✓ Mapped ${empIdMap.size} employees`));
  }

  if (toMigrate.tripleOtDays) {
    console.log(chalk.bold("\n  Triple OT Days"));
    results.tripleOtDays = await migrateTripleDays(db, pg);
  }

  if (toMigrate.decisionReasons) {
    console.log(chalk.bold("\n  Decision Reasons"));
    results.decisionReasons = await migrateDecisionReasons(db, pg);
  }

  if (toMigrate.users) {
    console.log(chalk.bold("\n  Users & Roles"));
    results.users = await migrateUsers(db, pg);
  }

  if (toMigrate.otEntries) {
    console.log(chalk.bold("\n  OT Entries"));
    results.otEntries = await migrateOtEntries(db, pg, empIdMap, batchSize);
  }

  // Audit log
  try {
    await pg.query(
      `INSERT INTO "AuditLog" (id, "entityType", "entityId", action, "actorUserId", diff, "createdAt")
       VALUES ($1,'System','cli-migration','MIGRATE',$2,$3,$4)`,
      [cuid(), actorId, JSON.stringify({ after: results }), new Date()],
    );
  } catch {}

  printSummary(results);

  await mongoClient.close();
  await pg.end();
  rl.close();
  process.exit(0);
}

main().catch(async (e) => {
  const c = await getChalk();
  console.error(c.red(`\nFatal: ${e.message}`));
  process.exit(1);
});
