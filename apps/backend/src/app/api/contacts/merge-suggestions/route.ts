import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { ContactService } from "@/modules/contacts/contact.service";
import { AIService } from "@/modules/ai/ai.service";
import { redisClient } from "@/lib/redisClient";
import type { ContactSnippetDTO } from "@/modules/contacts/contact.service";

const contactService = new ContactService();
const aiService = new AIService();

/** Redis cache TTL: 6 hours (suggestions rarely change between user sessions) */
const CACHE_TTL_SECONDS = 6 * 60 * 60;

type MergeSuggestion = {
  source_id: string;
  target_id: string;
  source_email: string;
  target_email: string;
  source_display_name?: string;
  target_display_name?: string;
  confidence: number;
  reason: string;
  strategy?: "verified_anchor" | "selected_anchor" | "default";
  target_is_verified?: boolean;
};

function isSuggestionSetFresh(
  suggestions: MergeSuggestion[],
  validIdSet: Set<string>,
): boolean {
  return suggestions.every(
    (s) =>
      s.source_id !== s.target_id &&
      validIdSet.has(s.source_id) &&
      validIdSet.has(s.target_id),
  );
}

function cacheKey(userId: string) {
  return `contact:merge_suggestions:${userId}`;
}

function normalizeName(value?: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value?: string): Set<string> {
  const normalized = normalizeName(value);
  if (!normalized) return new Set();
  return new Set(normalized.split(" ").filter((t) => t.length >= 2));
}

function buildDisplayName(contact: ContactSnippetDTO): string {
  return (
    contact.name ||
    contact.telegram_name ||
    contact.telegram_username ||
    contact.email
  );
}

function displayNameOrEmail(contact?: ContactSnippetDTO, fallbackEmail?: string): string {
  if (!contact) return fallbackEmail || "";
  return buildDisplayName(contact) || contact.email || fallbackEmail || "";
}

function isTelegramPlaceholder(email: string): boolean {
  return /@telegram\.local$/i.test(email);
}

function isVerifiedContact(contact?: ContactSnippetDTO): boolean {
  if (!contact) return false;
  return (
    contact.category_source === "user" ||
    (contact.categories?.length ?? 0) > 0
  );
}

function routeSuggestion(
  suggestion: MergeSuggestion,
  contactMap: Map<string, ContactSnippetDTO>,
  selectedContactId?: string,
): MergeSuggestion {
  const sourceMeta = contactMap.get(suggestion.source_id);
  const targetMeta = contactMap.get(suggestion.target_id);

  const sourceVerified = isVerifiedContact(sourceMeta);
  const targetVerified = isVerifiedContact(targetMeta);

  let sourceId = suggestion.source_id;
  let targetId = suggestion.target_id;
  let strategy: MergeSuggestion["strategy"] = "default";

  // Rule 1: if one side is verified, always merge into that verified contact.
  if (sourceVerified !== targetVerified) {
    if (sourceVerified) {
      sourceId = suggestion.target_id;
      targetId = suggestion.source_id;
    }
    strategy = "verified_anchor";
  }

  // Rule 2: when both sides are unverified, selected contact becomes anchor target.
  if (!sourceVerified && !targetVerified && selectedContactId) {
    if (selectedContactId === suggestion.source_id) {
      sourceId = suggestion.target_id;
      targetId = suggestion.source_id;
      strategy = "selected_anchor";
    } else if (selectedContactId === suggestion.target_id) {
      sourceId = suggestion.source_id;
      targetId = suggestion.target_id;
      strategy = "selected_anchor";
    }
  }

  const routedTarget = contactMap.get(targetId);
  const routedSource = contactMap.get(sourceId);
  return {
    ...suggestion,
    source_id: sourceId,
    target_id: targetId,
    source_email: contactMap.get(sourceId)?.email ?? suggestion.source_email,
    target_email: routedTarget?.email ?? suggestion.target_email,
    source_display_name: displayNameOrEmail(routedSource, suggestion.source_email),
    target_display_name: displayNameOrEmail(routedTarget, suggestion.target_email),
    strategy,
    target_is_verified: isVerifiedContact(routedTarget),
  };
}

function buildHeuristicSuggestions(
  snippets: ContactSnippetDTO[],
  existing: MergeSuggestion[],
): MergeSuggestion[] {
  const seen = new Set<string>(
    existing.flatMap((s) => [
      `${s.source_id}::${s.target_id}`,
      `${s.target_id}::${s.source_id}`,
    ]),
  );
  const suggestions: MergeSuggestion[] = [];

  for (let i = 0; i < snippets.length; i += 1) {
    for (let j = i + 1; j < snippets.length; j += 1) {
      const a = snippets[i];
      const b = snippets[j];
      if (a.contact_id === b.contact_id) continue;

      const key = `${a.contact_id}::${b.contact_id}`;
      if (seen.has(key)) continue;

      const aName = buildDisplayName(a);
      const bName = buildDisplayName(b);
      const aNorm = normalizeName(aName);
      const bNorm = normalizeName(bName);
      if (!aNorm || !bNorm) continue;

      const aTokens = tokenize(aName);
      const bTokens = tokenize(bName);
      const intersection = [...aTokens].filter((t) => bTokens.has(t)).length;
      const union = new Set([...aTokens, ...bTokens]).size || 1;
      const jaccard = intersection / union;

      let confidence = 0;
      let reason = "";

      if (aNorm === bNorm && aNorm.length >= 4) {
        confidence = 0.95;
        reason = "Rule match: same normalized contact name";
      } else if (jaccard >= 0.8 && intersection >= 2) {
        confidence = 0.88;
        reason = "Rule match: highly similar contact name tokens";
      }

      if (confidence === 0) continue;

      const aTelegram = isTelegramPlaceholder(a.email);
      const bTelegram = isTelegramPlaceholder(b.email);
      if (aTelegram !== bTelegram) {
        confidence = Math.min(0.98, confidence + 0.03);
        reason += " + telegram placeholder pairing";
      }

      const source = aTelegram && !bTelegram ? a : !aTelegram && bTelegram ? b : a;
      const target = source.contact_id === a.contact_id ? b : a;

      const outKey = `${source.contact_id}::${target.contact_id}`;
      if (seen.has(outKey)) continue;
      seen.add(outKey);
      seen.add(`${target.contact_id}::${source.contact_id}`);

      suggestions.push({
        source_id: source.contact_id,
        target_id: target.contact_id,
        source_email: source.email,
        target_email: target.email,
        confidence,
        reason,
      });
    }
  }

  return suggestions;
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
    const selectedContactId = url.searchParams.get("selectedContactId") || undefined;

    // --- Fetch contacts with real thread snippets (2 DB queries, not N+1) ---
    const snippets =
      await contactService.getContactsForMergeSuggestions(userId);

    if (snippets.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const validIdSet = new Set(snippets.map((s) => s.contact_id));

    // Use cached base suggestions whenever possible to avoid AI confidence drift.
    let baseSuggestions: MergeSuggestion[] | null = null;
    if (!refresh) {
      const cached = await redisClient.getCache<{ suggestions: MergeSuggestion[] }>(
        cacheKey(userId),
      );
      if (
        cached?.suggestions?.length &&
        isSuggestionSetFresh(cached.suggestions, validIdSet)
      ) {
        baseSuggestions = cached.suggestions;
      }
    }

    if (!baseSuggestions) {
      const rawSuggestions = await aiService.suggestMerges(snippets);

      // --- Sanity-check: reject any suggestion where source == target
      //     or where an id wasn't actually in the set we sent to AI ---
      const aiSuggestions: MergeSuggestion[] = rawSuggestions.filter(
        (s) =>
          s.source_id !== s.target_id &&
          validIdSet.has(s.source_id) &&
          validIdSet.has(s.target_id),
      );

      const heuristicSuggestions = buildHeuristicSuggestions(
        snippets,
        aiSuggestions,
      );
      baseSuggestions = [...aiSuggestions, ...heuristicSuggestions].sort(
        (a, b) => b.confidence - a.confidence,
      );

      await redisClient.setCache(
        cacheKey(userId),
        { suggestions: baseSuggestions },
        CACHE_TTL_SECONDS,
      );
    }

    const contactMap = new Map(
      snippets.map((s) => [s.contact_id, s] as const),
    );
    const routed = baseSuggestions
      .filter(
        (s) =>
          s.source_id !== s.target_id &&
          validIdSet.has(s.source_id) &&
          validIdSet.has(s.target_id),
      )
      .map((s) => routeSuggestion(s, contactMap, selectedContactId))
      .filter((s) => s.source_id !== s.target_id);

    const deduped = new Map<string, MergeSuggestion>();
    for (const s of routed) {
      const key = `${s.source_id}::${s.target_id}`;
      const existing = deduped.get(key);
      if (!existing || s.confidence > existing.confidence) {
        deduped.set(key, s);
      }
    }

    const suggestions = Array.from(deduped.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error("[contacts/merge-suggestions] error:", error.message);
    return NextResponse.json(
      { error: "Merge suggestion failed", details: error.message },
      { status: 500 },
    );
  }
}
