import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";
import { redisClient } from "@/lib/redisClient";

const contactService = new ContactService();
const aiService = new AIService();

/** Redis cache TTL: 6 hours (suggestions rarely change between user sessions) */
const CACHE_TTL_SECONDS = 6 * 60 * 60;

function cacheKey(userId: string) {
  return `contact:merge_suggestions:${userId}`;
}

// GET /api/contacts/merge-suggestions
// Returns AI-generated merge candidate pairs for the current user's contacts.
// Results are cached in Redis for CACHE_TTL_SECONDS to avoid repeated AI calls.
// Append ?refresh=true to bypass the cache and force a new AI run.
export async function GET(request: Request) {
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
    const refresh = url.searchParams.get("refresh") === "true";

    // --- Cache read ---
    if (!refresh) {
      const cached = await redisClient.getCache<{ suggestions: unknown[] }>(
        cacheKey(userId),
      );
      if (cached) {
        return NextResponse.json({ ...cached, fromCache: true });
      }
    }

    // --- Fetch contacts with real thread snippets (2 DB queries, not N+1) ---
    const snippets =
      await contactService.getContactsForMergeSuggestions(userId);

    if (snippets.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const rawSuggestions = await aiService.suggestMerges(snippets);

    // --- Sanity-check: reject any suggestion where source == target
    //     or where an id wasn't actually in the set we sent to AI ---
    const validIdSet = new Set(snippets.map((s) => s.contact_id));
    const suggestions = rawSuggestions.filter(
      (s) =>
        s.source_id !== s.target_id &&
        validIdSet.has(s.source_id) &&
        validIdSet.has(s.target_id),
    );

    // --- Cache write ---
    const payload = { suggestions };
    await redisClient.setCache(cacheKey(userId), payload, CACHE_TTL_SECONDS);

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[contacts/merge-suggestions] error:", error.message);
    return NextResponse.json(
      { error: "Merge suggestion failed", details: error.message },
      { status: 500 },
    );
  }
}
