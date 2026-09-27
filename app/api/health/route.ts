import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "kickpredict-togo", time: new Date().toISOString() });
}
