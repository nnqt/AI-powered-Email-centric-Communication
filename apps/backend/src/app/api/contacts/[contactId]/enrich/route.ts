import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";
import { emitToUser } from "@/lib/socketServer";

const contactService = new ContactService();
const aiService = new AIService();

export async function POST(
  request: Request,
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

    // Guard: return cached enrichment unless caller explicitly requests a re-run
    if (contact.aiEnriched) {
      const url = new URL(request.url);
      const force = url.searchParams.get("force") === "true";
      if (!force) {
        return NextResponse.json({ contact, cached: true });
      }
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

    // Derive user's email domain for colleague inference
    const userEmailDomain = (session as any).user.email
      ? ((session as any).user.email as string).split("@")[1]?.toLowerCase()
      : undefined;

    const jobId = `enrich-${contactId}-${Date.now()}`;
    emitToUser(userId, "AI_JOB_START", {
      jobId,
      label: `Enriching contact ${contact.name ?? contact.email}…`,
    });

    let enriched: any;
    try {
      enriched = await aiService.enrichContact(
        contact.email,
        contact.name,
        snippet,
        userEmailDomain,
      );
    } catch (enrichErr: any) {
      emitToUser(userId, "AI_JOB_DONE", {
        jobId,
        label: `Failed to enrich ${contact.name ?? contact.email}`,
        success: false,
      });
      throw enrichErr;
    }

    // Persist enrichment back to the contact
    const updates: Record<string, any> = {
      aiEnriched: true,
      enrichedAt: new Date(),
    };
    if (enriched.display_name) updates.name = enriched.display_name;
    if (enriched.org) updates.org = enriched.org;
    if (enriched.language) updates.language = enriched.language;
    // Save AI category suggestion (only if not already user-confirmed)
    if (enriched.category_suggestion && contact.categorySource !== "user") {
      updates.categoryAiSuggestion = enriched.category_suggestion;
    }

    const updated = await contactService.updateContact(
      userId,
      contactId,
      updates as any,
    );

    emitToUser(userId, "AI_JOB_DONE", {
      jobId,
      label: `Contact enriched: ${updated?.name ?? contact.email}`,
      success: true,
    });

    return NextResponse.json({ contact: updated, enriched });
  } catch (error: any) {
    console.error("[contacts/enrich] error:", error.message);
    return NextResponse.json(
      { error: "Enrichment failed", details: error.message },
      { status: 500 },
    );
  }
}
