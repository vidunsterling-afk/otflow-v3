export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(key: string, value: string) {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function deleteSetting(key: string) {
  try {
    await prisma.systemSetting.deleteMany({ where: { key } });
  } catch {}
}

export async function GET() {
  try {
    const [logo, companyName] = await Promise.all([
      getSetting("company_logo"),
      getSetting("company_name"),
    ]);
    return NextResponse.json({ logo, companyName: companyName ?? "" });
  } catch {
    return NextResponse.json({ logo: null, companyName: "" });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { logo, companyName } = body;
  const ops: Promise<any>[] = [];

  if (logo !== undefined) {
    if (logo === null || logo === "") {
      ops.push(deleteSetting("company_logo"));
    } else {
      const base64Data = logo.replace(/^data:image\/[a-z]+;base64,/, "");
      const sizeBytes = Math.ceil((base64Data.length * 3) / 4);
      if (sizeBytes > 200 * 1024) {
        return NextResponse.json(
          { error: "Logo too large — maximum 200KB" },
          { status: 400 },
        );
      }
      ops.push(setSetting("company_logo", logo));
    }
  }

  if (companyName !== undefined) {
    if (companyName === null || companyName === "") {
      ops.push(deleteSetting("company_name"));
    } else {
      ops.push(setSetting("company_name", companyName.trim()));
    }
  }

  await Promise.all(ops);
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteSetting("company_logo");
  return NextResponse.json({ success: true });
}
