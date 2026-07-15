# OTFlow V3

Overtime management system built for the HR department at SSL. Replaces a struggling MongoDB-based V2 with a faster, cleaner stack and a proper UI.

---

## What it does

- Employees punch in and out via a fingerprint machine. HR uploads the raw log file, the system figures out who arrived when and which shift they were on.
- Managers submit OT entries for employees, get them approved or rejected, and the whole thing is tracked with a full audit trail.
- At the end of the week or month, HR exports a clean Excel report broken down by employee with all the OT hours, statuses, and summaries they need for payroll.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | NextAuth v5 — JWT, credentials |
| UI | Tailwind CSS v3 + shadcn/ui + Framer Motion |
| State | Zustand + TanStack Query |
| Realtime | Supabase Realtime |
| Export | SheetJS (xlsx) |
| Hosting | Vercel |

---

## Project structure

```
src/
├── app/
│   ├── (app)/                  # All protected pages (sidebar + topbar layout)
│   │   ├── dashboard/          # Live summary, stats, pending count by day
│   │   ├── ot-entries/         # Week view, day panel, approve/reject/edit
│   │   ├── ot-logs/            # Filterable log table, Excel export, print
│   │   ├── triple-days/        # Mark dates as triple OT rate
│   │   ├── fingerprint/        # Upload TXT logs, smart IN/OUT detection
│   │   └── admin/
│   │       ├── employees/      # Employee CRUD
│   │       ├── users/          # User management + password reset
│   │       ├── roles/          # Role and permission builder
│   │       ├── decision-reasons/
│   │       ├── audit/          # Full audit trail with diff viewer
│   │       └── migrate/        # Browser-based MongoDB migration UI
│   ├── change-password/        # Forced password change screen
│   ├── login/
│   └── api/                    # All API routes
├── components/
│   ├── layout/                 # Sidebar, Topbar, SessionCountdown, NotificationBell
│   ├── ot/                     # OT entry modals (add, edit, approve, reject)
│   ├── admin/                  # Shared admin table, page header, buttons
│   └── ui/                     # Modal, FormField, Input, StatusBadge, etc.
├── lib/
│   ├── auth.ts                 # NextAuth config
│   ├── prisma.ts               # Prisma singleton
│   ├── otCalc.ts               # OT calculation logic (exact port from V2)
│   ├── notify.ts               # Notification helpers
│   ├── permissions.ts          # Permission constants and helpers
│   └── utils.ts                # Date formatting, color helpers, week utils
├── hooks/
│   └── useNotificationSound.ts # Web Audio API notification sounds
└── scripts/
    └── migrate.ts              # CLI migration tool (MongoDB → PostgreSQL)
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- Git Bash on Windows (all terminal commands are written for it)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd otflow-v3
npm install
```

### 2. Set up environment variables

Create `.env` in the root:

```env
# Supabase — use transaction mode pooler for app, direct for migrations
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres"

NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# NextAuth — generate with: openssl rand -base64 32
AUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

> If your password contains `@`, encode it as `%40` in the connection strings.

### 3. Push the schema and seed

```bash
npx prisma db push
npm run db:seed
```

This creates all tables and seeds a default admin account.

### 4. Run

```bash
npm run dev
```

Open `http://localhost:3000`. Default credentials:

```
Username: admin
Password: admin123
```

Change this immediately after first login — the system will force you to.

---

## OT calculation logic

The system uses the exact same calculation logic from V2, ported cleanly to TypeScript.

| Day type | Rate |
|---|---|
| Weekday | Normal OT after shift end |
| Saturday | Normal OT after 11:30 (Shift 1) or 13:30 (Shift 2) |
| Sunday | Double OT for all time worked |
| Triple day | Triple OT for all time worked |

**Shift times:**
- Shift 1 starts at 06:30 — OT kicks in after 15:30 on weekdays
- Shift 2 starts at 08:30 — OT kicks in after 17:30 on weekdays

All OT minutes are rounded down to the nearest 15 minutes. Night flag is set if the employee works past 21:00.

---

## Permissions

Roles are fully configurable from the admin panel. The available permissions are:

```
ot:view               See OT entries
ot:create             Submit new OT entries
ot:edit               Edit and delete entries
ot:approve            Approve or reject entries
ot:override_manual    Manually set OT minutes (bypass calculation)
logs:view             View OT logs
logs:export           Export Excel reports
admin:employees       Manage employee records
admin:users           Manage system users
admin:roles           Manage roles and permissions
admin:audit           View audit trail
triple_days:manage    Add and remove triple OT dates
fingerprint:process   Upload and process fingerprint logs
```

The seeded `admin` role has all permissions. The seeded `viewer` role has `ot:view` and `logs:view`.

---

## Excel export

Reports are exported as `.xlsx` with two sheets:

- **Summary** — overall totals + employee-wise breakdown table with counts, statuses, and hours
- **Records** — detailed entries grouped by employee, each with their own section header, column headers, alternating row colors, and a subtotal row

The company name shown in the report header can be set from the OT Logs page → Company button. A logo can also be uploaded there and it appears in every export.

---

## Fingerprint log processor

The fingerprint machine exports a tab-separated `.txt` file. The processor parses it and assigns IN/OUT using time-of-day windows rather than blind alternation, which is what V2 got wrong.

**How it works:**
- Scans between `00:00–05:59` → `OUT` (end of night shift, mapped to previous day)
- Scans between `06:00–11:59` → `IN` (morning arrival, Shift 1 or 2 detected from time)
- Scans between `13:00–23:59` → `OUT` (end of day shift)
- Everything else → `MIDDLE` (lunch, errands — shown in table, not counted)

All time windows are configurable from the Algorithm Settings panel in the UI. The settings are written in plain language with real examples so non-technical users can adjust them without guessing.

---

## Notifications

The system uses Supabase Realtime to push notifications instantly to connected users without polling.

**Events that trigger notifications:**
- New OT entry submitted → all users with `ot:view` permission are notified
- Entry approved or rejected → the user who created the entry is notified

Notifications auto-clear after 24 hours. A soft chime plays on arrival (Web Audio API, no audio files needed). The bell icon in the topbar shows an unread count badge.

---

## Migrating from V2 (MongoDB)

There are two ways to migrate data from the old system.

### Option A — Browser UI

Go to `/admin/migrate` while logged in. Connect to your MongoDB URI, preview each collection, optionally clear existing data, select what to migrate, and run. Best for smaller datasets.

### Option B — CLI (recommended for large datasets)

The CLI streams data using a MongoDB cursor so it never runs out of memory regardless of how many records you have.

```bash
npm run migrate
```

Or pass the URI directly to skip the prompt:

```bash
MONGO_URI="mongodb://..." npm run migrate
```

The CLI will:
1. Connect to both MongoDB and PostgreSQL
2. Ask you per-table whether to clear existing data first
3. Ask you per-collection whether to migrate it
4. Let you set the batch size for OT entries (default 25, lower = more stable)
5. Show a live progress bar for every collection
6. Write all errors to `migration-errors.log` so nothing is lost silently

**Migration order matters** — employees must be migrated before OT entries since entries reference employee IDs. The CLI handles this automatically.

---

## Session management

JWT sessions last 8 hours. A countdown timer appears in the topbar when 5 minutes remain. At 3 minutes a popup appears with the exact time left and a one-click **Extend Session** button that refreshes the token without signing out.

---

## Useful scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:push      # Push schema changes to database
npm run db:seed      # Seed default roles, admin user, and decision reasons
npm run db:studio    # Open Prisma Studio (visual database browser)
npm run migrate      # Run the MongoDB → PostgreSQL migration CLI
```

---

## Deployment

The app is built to deploy on Vercel with Supabase as the database.

1. Push to GitHub
2. Connect the repo in Vercel
3. Add all environment variables from your `.env` file to Vercel's environment settings
4. Set `NEXTAUTH_URL` to your production domain
5. Deploy

Make sure your Supabase project's connection pooler is set to **Transaction mode** (port 6543) — the app uses this for all queries. The `DIRECT_URL` is only needed for schema migrations and is not used at runtime.

---

## Notes

- Tailwind CSS is pinned to **v3**. Do not upgrade to v4 — shadcn/ui and the PostCSS config are not compatible.
- shadcn/ui is pinned to **2.3.0** for the same reason.
- Prisma is on **v7** which requires the `directUrl` field in the schema datasource block and does not support the old `datasources` constructor option.
- The `bcryptjs` package cannot run in the Edge runtime. All auth logic is marked `server-only` and API routes use `export const runtime = "nodejs"`.
- The `public/uploads/` directory is gitignored. It stores the company logo and fingerprint algorithm settings as local files. On Vercel these will reset on each deployment — if persistence is needed, move these to the database or Supabase Storage.

---

Built by Vidun Hettiarachchi · SSL IT Department · 2026