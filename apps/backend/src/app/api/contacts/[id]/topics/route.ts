import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Contact } from "@/models/Contact";
import { TopicService } from "@/modules/topics/topic.service";

const topicService = new TopicService();

/**
 * GET /api/contacts/[id]/topics
 * List clustered topics for one contact of the authenticated user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const contact = await Contact.findOne({
      _id: new mongoose.Types.ObjectId(id),
      userId: new mongoose.Types.ObjectId(session.user.id),
    })
      .select({ _id: 1 })
      .lean();

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const topics = await topicService.listTopicsForContact(session.user.id, id);
    return NextResponse.json({ topics });
  } catch (err: any) {
    console.error("[GET /api/contacts/[id]/topics]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
