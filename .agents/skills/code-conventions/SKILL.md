---
name: code-conventions
description: Code conventions for fullstack Next, Backend, and Python AI service.
---

# Code Conventions — Skill Reference

Stack: TypeScript (frontend + backend) · Python 3.12 (AI service) · TailwindCSS

---

## General

- Small, single-responsibility modules. Max ~200 lines per file.
- No hard-coded secrets. All secrets via environment variables.
- Async-first: non-blocking I/O everywhere.
- Structured logging. No `console.log` leaking to production.
- Error objects return `{ code, message }` — not raw strings.

---

## TypeScript / Next.js

### Naming

| Kind                 | Convention           | Example                           |
| -------------------- | -------------------- | --------------------------------- |
| Variables, functions | `camelCase`          | `syncEmails`, `threadId`          |
| React components     | `PascalCase`         | `ThreadList`, `AISummaryCard`     |
| Constants            | `UPPER_SNAKE_CASE`   | `MAX_RETRIES`, `LANG_INSTRUCTION` |
| Types / Interfaces   | `PascalCase`         | `ThreadDTO`, `ReplyItem`          |
| Next.js route files  | lowercase `route.ts` | `route.ts`                        |
| React hooks          | `use` prefix         | `useThreads`, `useSocket`         |

### Frontend Structure (`apps/frontend/src/`)

```
app/              # Next.js App Router (pages + layouts)
components/       # Reusable UI (Toast, ComposeDrawer, AISummaryCard, SmartReplyBar, ...)
features/         # Feature modules (inbox/ThreadList.tsx, ...)
hooks/            # Custom React hooks (useThreads, useSocket, useContacts, ...)
lib/              # HTTP client (api.ts / axiosClient.ts), socket setup
types/            # Shared TypeScript types/interfaces
```

### Frontend Patterns

- **Data fetching**: SWR for reads; `axios` mutations from `lib/api.ts`.
- **Optimistic UI**: `mutate(updatedData, false)` → API call → revert with `mutate()` on error.
- **Auth guard**: `useEffect` on `session.status === "unauthenticated"` → `router.replace("/")`.
- **Debounce search**: `useDebounce(value, 350)` + `useRef` diff detection to reset cursor.
- **Socket events**: handled in `useSocket(userId, { EVENT_NAME: handler })` — join room on **both** `connect` and `reconnect`.
- **Styling**: TailwindCSS utility classes; no custom CSS unless unavoidable. Indigo = primary brand color.
- **Components**: functional only; no class components. React hooks only.
- **Toast**: `const { toast } = useToast()` from `components/Toast.tsx`.
- **BEM className**: Every component/page root element và các structural child phải có BEM identifier className để dễ debug. Đặt BEM class **trước** Tailwind classes trong `className`.

### BEM className Convention

Format: `block`, `block__element`, `block--modifier` (kebab-case, PascalCase component → kebab-case block).

**Rules:**

1. Root element của mỗi component/page: `className="block-name [tailwind...]"`
2. Structural children: `className="block-name__element [tailwind...]"`
3. State variants: `className="block-name--modifier [tailwind...]"` (thêm vào sau block class)
4. Tailwind classes **không thay đổi** — BEM class chỉ được prepend thêm.
5. Sub-components nhỏ (ToolbarButton, InfoRow) cũng cần BEM block class riêng.

**Naming map (component → BEM block):**

| Component / Page          | BEM Block                     |
| ------------------------- | ----------------------------- |
| `DashboardLayout`         | `dashboard-layout`            |
| `<aside>` sidebar         | `sidebar`                     |
| `InboxPage`               | `inbox-page`                  |
| `ThreadList`              | `thread-list`                 |
| `ThreadDetailPage`        | `thread-detail`               |
| `ContactsPage`            | `contacts-page`               |
| `ContactRow`              | `contact-row`                 |
| `ContactDetailPage`       | `contact-detail`              |
| `AISummaryCard`           | `ai-summary-card`             |
| `SmartReplyBar`           | `smart-reply-bar`             |
| `ComposeDrawer`           | `compose-drawer`              |
| `ToolbarButton`           | `compose-drawer__toolbar-btn` |
| `SyncButton`              | `sync-button`                 |
| `ToastProvider` container | `toast-container`             |
| Individual toast          | `toast`                       |

**Example:**

```tsx
// Root element
<div className="thread-list space-y-3">
  {/* Structural child */}
  <div className="thread-list__search relative">...</div>
  <div className="thread-list__filters flex items-center gap-1 border-b border-gray-200">
    ...
  </div>
  <ul className="thread-list__items divide-y divide-gray-200 ...">
    <li className="thread-list__item">...</li>
  </ul>
</div>
```

### Backend Structure (`apps/backend/src/`)

```
app/api/                # Next.js route handlers (thin controllers)
lib/                    # db.ts, auth.ts, axiosClient.ts, socketServer.ts, logger.ts
models/                 # Mongoose models (User, Thread, Contact, Message)
modules/
  email/                # gmail.service.ts (sync, send, markRead, archive)
  timeline/             # timeline.service.ts (getThreads, getThreadDetails)
  contacts/             # contact.service.ts
  ai/                   # ai.service.ts (proxy calls to AI service)
types/                  # next-auth.d.ts extensions
```

### Backend Patterns

- **Route handler pattern**: validate input → call service → map to HTTP response.
- **Service functions**: all `async`, return typed results.
- **Error handling**: try/catch in routes; logs error; returns `{ error: message }` with appropriate status code.
- **Socket emit**: `emitToUser(userId, "EVENT_NAME", payload)` from `lib/socketServer.ts`. Silent if `io` not initialized.
- **Redis client**: from `lib/redis.ts`; use `await redis.get(key)` / `await redis.setex(key, ttl, value)`.
- **Mongoose**: always `lean()` for read queries where possible. Use `findOneAndUpdate(..., { upsert: true, new: true })` for upserts.

---

## Python (AI Service)

### Naming

| Kind                 | Convention           | Example                                        |
| -------------------- | -------------------- | ---------------------------------------------- |
| Variables, functions | `snake_case`         | `classify_urgent`, `thread_id`                 |
| Classes              | `PascalCase`         | `GeminiUrgentClassifier`                       |
| Constants            | `UPPER_SNAKE_CASE`   | `_URGENT_KEYWORDS`, `_MAX_TOTAL_CONTENT_CHARS` |
| Private helpers      | `_underscore` prefix | `_truncate`, `_gemini_with_retry`              |

### FastAPI Patterns

- All route functions: `async def`.
- All request/response bodies: Pydantic models.
- No business logic in route files — delegate to `services/`.
- Call `load_dotenv()` in `main.py` **before** importing `core/config.py`.
- `Optional[str]` for nullable fields; `None` default where appropriate.

### Error Handling (AI Service)

- Network errors / 429 → `_gemini_with_retry()` (exponential backoff).
- Any other Gemini error → log + return safe default (`is_urgent=False`, `display_name=None`, etc.).
- Never raise unhandled exceptions from service functions — always return a typed response.

---

## REST Naming Conventions

```
GET    /api/threads                     # list
GET    /api/threads/:id                 # single resource
PATCH  /api/threads/:id/read            # sub-resource action
POST   /api/threads/:id/summarize       # AI action
POST   /api/threads/:id/suggest-reply   # AI action
POST   /api/contacts/:id/enrich         # AI action
GET    /api/contacts/:id/timeline       # sub-collection
```

---

## Function Naming Pattern

Format: **verb + noun**

| Good               | Bad              |
| ------------------ | ---------------- |
| `syncEmails()`     | `doSync()`       |
| `classifyUrgent()` | `urgentCheck()`  |
| `upsertContact()`  | `saveOrUpdate()` |
| `suggestReplies()` | `getReplies()`   |
| `emitToUser()`     | `sendEvent()`    |

---

## Socket.IO Events

| Event           | Emitted by                        | Frontend handler                              |
| --------------- | --------------------------------- | --------------------------------------------- |
| `EMAIL_SYNCED`  | `POST /api/emails/sync`           | `mutate(/api/threads/*)` + toast if count > 0 |
| `SUMMARY_READY` | `POST /api/threads/:id/summarize` | `mutate()` refresh AISummaryCard              |
| `EMAIL_SENT`    | `POST /api/emails/send`           | `mutate(/api/threads/*)` refresh inbox        |

Room pattern: `user:<userId>`. Client `join(userId)` on `connect` + `reconnect`.
