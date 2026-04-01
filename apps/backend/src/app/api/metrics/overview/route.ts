import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getRuntimeMetricsSnapshot } from "@/lib/runtimeMetrics";

// GET /api/metrics/overview
// Lightweight runtime counters/timers for operational monitoring.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getRuntimeMetricsSnapshot());
}
