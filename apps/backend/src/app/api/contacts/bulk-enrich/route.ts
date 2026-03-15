import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Contact } from "@/models/Contact";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";
import { emitToUser } from "@/lib/socketServer";

const contactService = new ContactService();
const aiService = new AIService();

/**
 * POST /api/contacts/bulk-enrich
 *
 * Enrich all contacts that have not been enriched yet (aiEnriched=false).
 * Processes in sequential batches of 5 to stay within Gemini rate limits.
 * Returns { processed, skipped, failed, total }.
 *
 * Query params:
 *   ?limit=50  — max contacts to process per call (default 50, max 200)
 */
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

    const url = new URL(request.url);
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Math.min(Math.max(1, rawLimit), 200);

    await connectToDatabase();

    const mongoose = (await import("mongoose")).default;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Fetch unenriched, non-merged contacts
    const unenriched = await Contact.find({
      userId: userObjectId,
      aiEnriched: false,
      mergedInto: { $exists: false },
    })
      .limit(limit)
      .lean();

    if (unenriched.length === 0) {
      return NextResponse.json({
        processed: 0,
        skipped: 0,
        failed: 0,
        total: 0,
      });
    }

    const userEmailDomain = (session as any).user.email
      ? ((session as any).user.email as string).split("@")[1]?.toLowerCase()
      : undefined;

    const bulkJobId = `bulk-enrich-${Date.now()}`;
    emitToUser(userId, "AI_JOB_START", {
      jobId: bulkJobId,
      label: `Enriching ${unenriched.length} contact(s)…`,
    });

    let processed = 0;
    let failed = 0;

    // Process in batches of 5 sequentially
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 300;

    for (let i = 0; i < unenriched.length; i += BATCH_SIZE) {
      const batch = unenriched.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (contact) => {
          try {
            // Get snippet from timeline for better enrichment context
            let snippet: string | undefined;
            try {
              const threads = await contactService.getContactTimeline(
                userId,
                contact._id.toString(),
              );
              const firstThread = threads?.[0];
              if ((firstThread as any)?.snippet) {
                snippet = (firstThread as any).snippet;
              }
            } catch {
              // optional
            }

            const enriched = await aiService.enrichContact(
              contact.email,
              contact.name,
              snippet,
              userEmailDomain,
            );

            const updates: Record<string, any> = {
              aiEnriched: true,
              enrichedAt: new Date(),
            };
            if (enriched.display_name) updates.name = enriched.display_name;
            if (enriched.org) updates.org = enriched.org;
            if (enriched.language) updates.language = enriched.language;
            if (
              enriched.category_suggestion &&
              contact.categorySource !== "user"
            ) {
              updates.categoryAiSuggestion = enriched.category_suggestion;
            }

            await Contact.updateOne({ _id: contact._id }, { $set: updates });
            processed++;
          } catch {
            failed++;
          }
        }),
      );

      // Throttle between batches (skip delay after last batch)
      if (i + BATCH_SIZE < unenriched.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    emitToUser(userId, "AI_JOB_DONE", {
      jobId: bulkJobId,
      label: `Enriched ${processed} of ${unenriched.length} contact(s)${failed > 0 ? ` (${failed} failed)` : ""}`,
      success: failed === 0,
    });

    return NextResponse.json({
      processed,
      skipped: 0,
      failed,
      total: unenriched.length,
    });
  } catch (error: any) {
    console.error("[contacts/bulk-enrich] error:", error.message);
    return NextResponse.json(
      { error: "Bulk enrichment failed", details: error.message },
      { status: 500 },
    );
  }
}
