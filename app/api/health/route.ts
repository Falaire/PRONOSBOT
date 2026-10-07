import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "kickpredict-africa", time: new Date().toISOString() });
}
