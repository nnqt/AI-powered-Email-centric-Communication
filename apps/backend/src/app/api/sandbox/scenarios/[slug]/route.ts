import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSandboxScenarioBySlug } from "@/lib/sandbox-scenarios";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
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

    const { slug } = await params;
    const scenario = getSandboxScenarioBySlug(slug);
    if (!scenario) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    return NextResponse.json({
      slug: scenario.slug,
      title: scenario.title,
      description: scenario.description,
      scenario: scenario.scenario,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load sandbox scenario", details: error.message },
      { status: 500 },
    );
  }
}
