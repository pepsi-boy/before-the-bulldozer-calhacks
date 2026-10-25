import { NextResponse } from "next/server";
import { getPermits } from "@/lib/permits";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getPermits());
}
