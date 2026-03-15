import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TopicService } from "@/modules/topics/topic.service";

const topicService = new TopicService();

type Params = { params: Promise<{ topicId: string }> };

/**
 * GET /api/topics/[topicId]
 * Return a single topic with its threads.
 */
export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topicId } = await params;

  try {
    const result = await topicService.getTopicWithThreads(
      session.user.id,
      topicId,
    );
    if (!result) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[GET /api/topics/[topicId]]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/topics/[topicId]
 * Rename a topic.
 * Body: { name: string }
 */
export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { topicId } = await params;

  try {
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const updated = await topicService.renameTopic(
      session.user.id,
      topicId,
      name,
    );
    if (!updated) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }
    return NextResponse.json({ topic: updated });
  } catch (err: any) {
    console.error("[PATCH /api/topics/[topicId]]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
