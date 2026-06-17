export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { MongoClient } from "mongodb";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { uri, collection } = await req.json();
  if (!uri || !collection)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
    await client.connect();
    const db = client.db();
    const sample = await db.collection(collection).find({}).limit(3).toArray();
    const count = await db.collection(collection).countDocuments();
    return NextResponse.json({ sample, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  } finally {
    await client?.close();
  }
}
