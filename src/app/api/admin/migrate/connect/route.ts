export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MongoClient } from "mongodb";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uri } = await req.json();
  if (!uri)
    return NextResponse.json({ error: "URI required" }, { status: 400 });

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
    await client.connect();

    const db = client.db();
    const collections = await db.listCollections().toArray();
    const names = collections.map((c) => c.name);

    const counts: Record<string, number> = {};
    for (const name of names) {
      counts[name] = await db.collection(name).countDocuments();
    }

    return NextResponse.json({
      success: true,
      collections: names,
      counts,
      dbName: db.databaseName,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Connection failed" },
      { status: 400 },
    );
  } finally {
    await client?.close();
  }
}
