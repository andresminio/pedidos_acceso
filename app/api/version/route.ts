import { NextResponse } from "next/server";
import version from "@/lib/version.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(version, { headers: { "Cache-Control": "no-store" } });
}
