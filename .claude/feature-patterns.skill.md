# Feature Implementation Patterns — Skill Reference

## Adding a New Backend API Route

1. Create route file: `apps/backend/src/app/api/<resource>/route.ts`
2. Import session auth: `const session = await getServerSession(authOptions)`; return 401 if not authenticated.
3. Call service function from `modules/<feature>/<feature>.service.ts`.
4. Return `NextResponse.json(result)` or `NextResponse.json({ error }, { status })`.
5. Emit Socket.IO event if needed: `emitToUser(session.user.id, "EVENT_NAME", payload)`.

**Route handler template:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // validate body...

  const result = await myService.doThing(session.user.id, body);
  return NextResponse.json(result);
}
```

---

## Adding a New AI Feature (Backend → AI Service)

1. Add method to `apps/backend/src/modules/ai/ai.service.ts`:
   ```typescript
   async myAiFeature(input: MyInput): Promise<MyOutput> {
     const res = await this.axiosClient.post("/my-endpoint", input);
     return res.data;
   }
   ```
2. Add fallback: wrap in try/catch, return safe default on error (non-fatal).
3. Add route: `POST /api/<resource>/[id]/my-action/route.ts` → call `AIService.myAiFeature()`.

---

## Adding a New AI Endpoint (AI Service)

1. **Model** (`models/my_feature.py`): Pydantic `MyRequest`, `MyResponse`.
2. **Service** (`services/my_service.py`): `async def do_thing(request: MyRequest) -> MyResponse`.
3. **Client** (`core/llm_client.py`): new class `GeminiMyClient` with `_gemini_with_retry` call.
4. **Route** (`routes/my_feature.py`):
   ```python
   @router.post("/my-endpoint", response_model=MyResponse)
   async def my_endpoint(request: MyRequest) -> MyResponse:
       return await do_thing(request)
   ```
5. **Wire** in `main.py`: `app.include_router(my_router)`.

---

## Adding a New Contact Field

1. `apps/backend/src/models/Contact.ts` — add to Mongoose schema + TypeScript interface.
2. `apps/backend/src/modules/contacts/contact.service.ts` — if needed, update `updateContact()` allowed fields.
3. `apps/frontend/src/hooks/useContacts.ts` — add to `ContactDTO` interface.
4. Update `contacts/[id]/page.tsx` to display/edit the new field.
5. Update `database-schema.spec.md` and `implementation-status.spec.md`.

---

## Thread Filter Pattern

`TimelineService.getThreads()` builds MongoDB query from `filter: ThreadFilter`:

```typescript
type ThreadFilter = "all" | "unread" | "archived";

const filterQuery = {
  all: { isArchived: { $ne: true } },
  unread: { isRead: false, isArchived: { $ne: true } },
  archived: { isArchived: true },
}[filter];
```

> Note: `"urgent"` filter tab was removed. The `isUrgent` badge still shows on thread rows.

To add a new filter:

1. Extend `ThreadFilter` type.
2. Add case to `filterQuery` map in `timeline.service.ts`.
3. Add to valid filter list in `GET /api/threads` route validation.
4. Add `ThreadFilter` export and handling in `useThreads.ts`.
5. Add tab to `ThreadList.tsx`.

---

## Cursor Pagination Pattern

```typescript
// Encode
const cursor = `${thread.lastMessageDate.toISOString()}_${thread._id}`;

// Decode (safe for ISO dates containing _)
const lastUnderscore = cursor.lastIndexOf("_");
const date = cursor.substring(0, lastUnderscore);
const id = cursor.substring(lastUnderscore + 1);

// Query
{
  lastMessageDate: {
    $lt: new Date(date);
  }
}
// or
{
  $or: [
    { lastMessageDate: { $lt: new Date(date) } },
    { lastMessageDate: new Date(date), _id: { $lt: new ObjectId(id) } },
  ];
}
```

---

## Optimistic UI Pattern (SWR)

```typescript
const { mutate } = useThreads();

// Optimistic update
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
  false, // don't revalidate yet
);

try {
  await api.patch(`/api/threads/${threadId}/read`, { read: true });
  mutate(); // revalidate from server
} catch {
  mutate(); // revert on error
}
```

---

## Fire-and-Forget Pattern (Backend)

Used for: urgent classification after sync, contact upsert after sync.

```typescript
// After upsert:
if (!threadDoc.urgentClassifiedAt) {
  aiService
    .classifyUrgent(threadId, subject, snippet)
    .then(({ isUrgent }) =>
      Thread.updateOne(
        { id: threadId },
        { isUrgent, urgentClassifiedAt: new Date() },
      ),
    )
    .catch(() => {}); // never block the main flow
}
```

---

## Contact Merge Suggestion Flow

1. Frontend: `GET /api/contacts/merge-suggestions` (cached 6h in Redis).
2. Backend route: check Redis, return cached if hit; else call `contact.service.getContactsForMergeSuggestions()`.
3. Service: 2 DB queries → in-memory match → build `ContactSnippetDTO[]` with real `sample_threads`.
4. Backend: send to AI service `POST /suggest-merge` (capped 100 contacts).
5. AI service: Gemini returns pairs; `valid_ids` Set guards hallucinations.
6. Backend: `validIdSet` cross-validation → cache in Redis → return `{ suggestions, fromCache }`.
7. On merge: `POST /api/contacts/merge` → soft-merge → delete Redis cache key.

---

## Adding a New Socket.IO Event

1. **Backend** — emit after relevant action:
   ```typescript
   import { emitToUser } from "@/lib/socketServer";
   emitToUser(userId, "MY_EVENT", { payload });
   ```
2. **Frontend** — add listener in relevant page/component:
   ```typescript
   useSocket(session.user.id, {
     MY_EVENT: (data) => { mutate(); toast(...); }
   });
   ```

---

## Global AI Progress Toast Pattern (AI_JOB_START / AI_JOB_DONE)

For any long-running AI operation, emit start + done events so `layout.tsx` shows a persistent toast automatically.

**Backend:**

```typescript
const jobId = `my-job-${Date.now()}`;
emitToUser(userId, "AI_JOB_START", { jobId, label: "Doing AI thing..." });
try {
  const result = await doAiThing();
  emitToUser(userId, "AI_JOB_DONE", { jobId, label: "Done!", success: true });
} catch {
  emitToUser(userId, "AI_JOB_DONE", { jobId, label: "Failed", success: false });
}
```

**Frontend (layout.tsx handles globally — no per-page code needed):**

- `AI_JOB_START` → `showToast(label, "processing")` (no auto-dismiss).
- `AI_JOB_DONE` → `updateToast(id, label, success ? "success" : "info")` (4s auto-dismiss).
- Map stored in `aiJobToastMap = useRef<Record<string, string>>({})`.

---

## Email Header Decoding (Vietnamese / Non-ASCII Names)

All `From` / `To` header values from Gmail API must be decoded before storing:

```typescript
import { decodeEmailHeader } from "@/modules/contacts/contact.service";

const from = decodeEmailHeader(getHeader("From")); // handles RFC 2047 + Mojibake
```

`decodeEmailHeader()` applies:

1. RFC 2047 (`=?charset?B/Q?...?=`) decode.
2. Up to 2 passes of Mojibake fix (UTF-8 bytes misread as Latin-1/CP1252).

Always use this for raw Gmail API header values before storing in `Thread.participants` or `Message.from`.

---

## FR → Module Mapping Quick Reference

| FR    | Backend modules                                                   | AI Service endpoint                 | Frontend                                       |
| ----- | ----------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| FR-01 | `modules/email/gmail.service.ts`, `api/emails/sync`               | —                                   | `SyncButton`, `useSocket`                      |
| FR-02 | `gmail.service.ts (sendEmail)`, `api/emails/send`                 | —                                   | `ComposeDrawer`                                |
| FR-03 | `gmail.service.ts (markRead/archive)`, `api/threads/:id/read`     | —                                   | `ThreadList` (optimistic)                      |
| FR-04 | `modules/timeline/timeline.service.ts`, `api/threads`             | —                                   | `ThreadList`, `useThreads`, thread `[id]` page |
| FR-05 | `server.ts`, `lib/socketServer.ts`                                | —                                   | `useSocket`, `useBackgroundSync`               |
| FR-06 | `modules/contacts/contact.service.ts`, `api/contacts`             | `/enrich-contact`, `/suggest-merge` | contacts pages, `useContacts`                  |
| FR-07 | `modules/ai/ai.service.ts`, `api/threads/:id/summarize`           | `/summarize`                        | `AISummaryCard`                                |
| FR-08 | `ai.service.ts (suggestReplies)`, `api/threads/:id/suggest-reply` | `/suggest-reply`                    | `SmartReplyBar`, thread `[id]` page            |
| FR-09 | `lib/telegramManager.ts`, `api/telegram/*`, `TelegramChat/Message` models | `/analyze-chat-chunk`       | `chat/page.tsx`, `settings/page.tsx`           |
| FR-10 | `modules/topics/topic.service.ts`, `api/topics`, `api/focus`      | `/classify-thread-category`, `/label-topic` | `FocusTopicCard`, `ContactTopicGroup`, `/focus` |
