export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { register } from "@bitebase/api/lib/metrics";

export async function GET() {
  try {
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      headers: {
        "Content-Type": register.contentType,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
