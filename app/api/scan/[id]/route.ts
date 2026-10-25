import { NextResponse } from "next/server";
import { getScan } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const scan = await getScan(params.id);
  if (!scan) return NextResponse.json({ error: "scan not found" }, { status: 404 });
  return NextResponse.json(scan);
}
