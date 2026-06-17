export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const LOGO_DIR = path.join(process.cwd(), "public", "uploads");
const LOGO_PATH = path.join(LOGO_DIR, "company-logo.b64");
const COMPANY_NAME_PATH = path.join(LOGO_DIR, "company-name.txt");

export async function GET() {
  try {
    const logo = existsSync(LOGO_PATH)
      ? await readFile(LOGO_PATH, "utf-8")
      : null;
    const name = existsSync(COMPANY_NAME_PATH)
      ? await readFile(COMPANY_NAME_PATH, "utf-8")
      : "";
    return NextResponse.json({ logo, companyName: name });
  } catch {
    return NextResponse.json({ logo: null, companyName: "" });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { logo, companyName } = await req.json();

  if (!existsSync(LOGO_DIR)) await mkdir(LOGO_DIR, { recursive: true });
  if (logo !== undefined) await writeFile(LOGO_PATH, logo ?? "", "utf-8");
  if (companyName !== undefined)
    await writeFile(COMPANY_NAME_PATH, companyName ?? "", "utf-8");

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    if (existsSync(LOGO_PATH)) {
      const { unlink } = await import("fs/promises");
      await unlink(LOGO_PATH);
    }
  } catch {}
  return NextResponse.json({ success: true });
}
