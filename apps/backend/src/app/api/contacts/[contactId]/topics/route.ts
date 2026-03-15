import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TopicService } from "@/modules/topics/topic.service";

const topicService = new TopicService();

type Params = { params: Promise<{ contactId: string }> };

/**
 * GET /api/contacts/[contactId]/topics
 * List all topics for a specific contact belonging to the authenticated user.
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contactId } = await params;

  try {
    const topics = await topicService.listTopicsForContact(
      session.user.id,
      contactId,
    );
    return NextResponse.json({ topics });
  } catch (err: any) {
    console.error("[GET /api/contacts/[contactId]/topics]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
