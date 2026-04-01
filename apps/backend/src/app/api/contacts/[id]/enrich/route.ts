import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";

const contactService = new ContactService();
const aiService = new AIService();

/**
 * POST /api/contacts/[id]/enrich
 * Enrich one contact with AI signals (name/org/language/category suggestion).
 *
 * Query params:
 * - force=true: re-run enrichment even when aiEnriched=true.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session as any).user.id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const { id } = await params;
    const contact = await contactService.getContactById(userId, id);
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const force = request.nextUrl.searchParams.get("force") === "true";
    if (contact.aiEnriched && !force) {
      return NextResponse.json({ contact, cached: true });
    }

    let conversationSnippet: string | undefined;
    try {
      const timeline = await contactService.getContactTimeline(userId, id);
      const firstThread = timeline[0] as any;
      if (firstThread?.snippet) {
        conversationSnippet = firstThread.snippet;
      }
    } catch {
      // Optional context only; continue without snippet.
    }

    const userEmailDomain = session.user.email
      ? session.user.email.split("@")[1]?.toLowerCase()
      : undefined;

    const enriched = await aiService.enrichContact(
      contact.email,
      contact.name,
      conversationSnippet,
      userEmailDomain,
    );

    const updates: Record<string, unknown> = {
      aiEnriched: true,
      enrichedAt: new Date(),
    };

    if (enriched.display_name) {
      updates.name = enriched.display_name;
    }
    if (enriched.org) {
      updates.org = enriched.org;
    }
    if (enriched.language) {
      updates.language = enriched.language;
    }
    if (enriched.category_suggestion && contact.categorySource !== "user") {
      updates.categoryAiSuggestion = enriched.category_suggestion;
    }

    const updated = await contactService.updateContact(userId, id, updates as any);
    if (!updated) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact: updated, cached: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to enrich contact", details: error.message },
      { status: 500 },
    );
  }
}
