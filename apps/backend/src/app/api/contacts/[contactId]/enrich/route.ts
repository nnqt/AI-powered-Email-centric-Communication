import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";

const contactService = new ContactService();
const aiService = new AIService();

export async function POST(
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

    const contact = await contactService.getContactById(userId, contactId);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Get a recent snippet from the contact's timeline for better enrichment context
    let snippet: string | undefined;
    try {
      const threads = await contactService.getContactTimeline(
        userId,
        contactId,
      );
      const firstThread = threads?.[0];
      if ((firstThread as any)?.snippet) {
        snippet = (firstThread as any).snippet;
      }
    } catch {
      // snippet is optional, continue without it
    }

    const enriched = await aiService.enrichContact(
      contact.email,
      contact.name,
      snippet,
    );

    // Persist enrichment back to the contact
    const updates: Record<string, any> = { aiEnriched: true };
    if (enriched.display_name) updates.name = enriched.display_name;
    if (enriched.org) updates.org = enriched.org;
    if (enriched.language) updates.language = enriched.language;

    const updated = await contactService.updateContact(
      userId,
      contactId,
      updates as any,
    );

    return NextResponse.json({ contact: updated, enriched });
  } catch (error: any) {
    console.error("[contacts/enrich] error:", error.message);
    return NextResponse.json(
      { error: "Enrichment failed", details: error.message },
      { status: 500 },
    );
  }
}
