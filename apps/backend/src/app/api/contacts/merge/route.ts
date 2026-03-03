import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";

const service = new ContactService();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const body = await request.json();
    const { sourceId, targetId } = body as {
      sourceId?: string;
      targetId?: string;
    };
    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: "sourceId and targetId are required" },
        { status: 400 },
      );
    }
    if (sourceId === targetId) {
      return NextResponse.json(
        { error: "sourceId and targetId must be different" },
        { status: 400 },
      );
    }

    const merged = await service.mergeContacts(userId, sourceId, targetId);
    return NextResponse.json(merged);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to merge contacts", details: error.message },
      { status: 500 },
    );
  }
}
