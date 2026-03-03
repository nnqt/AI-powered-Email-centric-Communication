import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";

const service = new ContactService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  try {
    const { contactId } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const threads = await service.getContactTimeline(userId, contactId);
    return NextResponse.json({ threads });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch contact timeline", details: error.message },
      { status: 500 },
    );
  }
}
