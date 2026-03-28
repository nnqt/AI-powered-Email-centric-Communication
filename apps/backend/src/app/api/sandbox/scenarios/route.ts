import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSandboxScenarioList } from "@/lib/sandbox-scenarios";

export async function GET() {
  try {
    const sandboxApiEnabled =
      process.env.NODE_ENV === "development" ||
      process.env.ENABLE_SANDBOX_API === "true";
    if (!sandboxApiEnabled) {
      return NextResponse.json(
        { error: "Sandbox API is disabled in this environment" },
        { status: 403 },
      );
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ scenarios: getSandboxScenarioList() });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load sandbox scenarios", details: error.message },
      { status: 500 },
    );
  }
}
