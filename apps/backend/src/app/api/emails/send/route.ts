import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { GmailService } from "@/modules/email/gmail.service";
import { emitToUser } from "@/lib/socketServer";

// POST /api/emails/send
// Body: { to: string; subject: string; body: string; threadId?: string }
export async function POST(request: NextRequest) {
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
    const {
      to,
      subject,
      body: emailBody,
      htmlBody,
      attachmentIds,
      threadId,
    } = body as {
      to: string;
      subject: string;
      body?: string;
      htmlBody?: string;
      attachmentIds?: string[];
      threadId?: string;
    };

    if (!to || !subject || (!emailBody && !htmlBody)) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body or htmlBody" },
        { status: 422 },
      );
    }

    const service = new GmailService(userId);
    const result = await service.sendEmail({
      to,
      subject,
      body: emailBody,
      htmlBody,
      attachmentIds,
      threadId,
    });

    // Notify frontend that a new email was sent (so thread list can refresh)
    emitToUser(userId, "EMAIL_SENT", {
      threadId: result.gmailThreadId ?? threadId,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to send email", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 },
    );
  }
}
