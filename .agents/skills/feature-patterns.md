# Feature Implementation Patterns

This file keeps only reusable patterns used frequently in day-to-day changes.
Long FR-10 optimization details were moved to:

- `.agents/skills/patterns/topic-focus-optimization.md`

For endpoint payloads, always use contract docs as source of truth:

- `.agents/knowledge/api-contracts-backend.md`
- `.agents/knowledge/api-contracts-ai-service.md`

## Backend API Route Pattern

1. Create route at `apps/backend/src/app/api/<resource>/route.ts`.
2. Guard with NextAuth session (`401` if unauthenticated).
3. Delegate logic to module service (`apps/backend/src/modules/*`).
4. Return consistent JSON (`result` or `{ error }`).

Template:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const result = await myService.doThing(session.user.id, body);
  return NextResponse.json(result);
}
```

## Backend AI Adapter Pattern

### Architecture Hygiene

1. Keep one backend AI adapter only: `apps/backend/src/modules/ai/ai.service.ts`.
2. Do not create parallel adapters under `apps/backend/src/services/*`.
3. AI routes import from `@/modules/ai/ai.service` only.
4. If AI contract changes, update both contract docs in the same change-set.

### Add New AI Call

1. Add typed method in `AIService`.
2. Wrap in `try/catch` with non-breaking fallback when possible.
3. Log/measure latency if endpoint is in sync pipeline or user-triggered hot path.

## AI Service Endpoint Pattern

1. Add request/response models under `apps/ai-service/models`.
2. Add business logic under `apps/ai-service/services`.
3. Add route under `apps/ai-service/routes`.
4. Register route in `apps/ai-service/main.py`.

## Contacts Pattern (Field or Flow Changes)

1. Update `apps/backend/src/models/Contact.ts`.
2. Update DTO + service mapping in `apps/backend/src/modules/contacts/contact.service.ts`.
3. Update `ContactDTO` in `apps/frontend/src/hooks/useContacts.ts`.
4. Update related UI pages under contacts dashboard.
5. Sync `.agents/knowledge/database-schema.md` if schema changed.

## Focus Refresh Pattern (Current)

1. Use `GET /api/focus/overview` for sidebar counters/badges.
2. Use `GET /api/focus?limit=` for focus list.
3. Use `POST /api/focus/recompute?limit=` for explicit recompute.
4. Do not re-introduce old double-fetch refresh style.

## SWR Optimistic Update Pattern

```typescript
mutate(
  (prev) =>
    prev
      ? {
          ...prev,
          threads: prev.threads.map((t) =>
            t.id === threadId ? { ...t, isRead: true } : t,
          ),
        }
      : prev,
  false,
);

try {
  await api.patch(`/api/threads/${threadId}/read`, { read: true });
  mutate();
} catch {
  mutate();
}
```

## Cursor Pagination Pattern

```typescript
const cursor = `${thread.lastMessageDate.toISOString()}_${thread._id}`;

const lastUnderscore = cursor.lastIndexOf("_");
const date = cursor.substring(0, lastUnderscore);
const id = cursor.substring(lastUnderscore + 1);
```

## Socket Event + AI Progress Pattern

1. Emit domain events with `emitToUser(userId, "EVENT_NAME", payload)`.
2. For long AI operations, emit both:
  - `AI_JOB_START { jobId, label }`
  - `AI_JOB_DONE { jobId, label, success }`
3. Keep global toast behavior in dashboard layout (single place).

## Sandbox Revalidation Pattern

After sandbox write operations (`inject`, `clear`, fake webhook), revalidate:

1. `/api/contacts*`
2. `/api/threads*`
3. `/api/focus*`
4. `/api/topics*`

## Thread Category + Topic Pipeline Reference

When touching topic clustering and consolidation, read:

1. `.agents/skills/patterns/topic-focus-optimization.md`
2. `.agents/state/changelog/topic-intelligence.md`
