import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

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

    const jsonPath = path.join(
      process.cwd(),
      "src/lib/mock-data/scenario-angry-customer.json",
    );

    const raw = await readFile(jsonPath, "utf-8");
    const scenario = JSON.parse(raw);

    return NextResponse.json({ scenario });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load sandbox scenario", details: error.message },
      { status: 500 },
    );
  }
}
