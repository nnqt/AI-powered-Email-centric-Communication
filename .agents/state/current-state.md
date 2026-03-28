# Current State — March 28, 2026

## Status: All FRs Implemented ✅

| FR    | Feature                                          | Status                                       |
| ----- | ------------------------------------------------ | -------------------------------------------- |
| FR-01 | Email sync (Gmail)                               | ✅ Manual sync; webhook architecture-pending |
| FR-02 | Compose + send + attachments                     | ✅                                           |
| FR-03 | Read/unread/archive (two-way Gmail)              | ✅                                           |
| FR-04 | Inbox + Thread timeline + pagination             | ✅                                           |
| FR-05 | Real-time UI (Socket.IO)                         | ✅                                           |
| FR-06 | Contact management (enrich + merge + categories) | ✅                                           |
| FR-07 | Thread AI summarization (Vietnamese)             | ✅ Timeline format + colored badges           |
| FR-08 | Smart reply suggestions                          | ✅ Studio flow + priority badges              |
| FR-09 | Multi-channel Telegram (Phases 1–5)              | ✅                                           |
| FR-10 | Topic Intelligence (Phases 1–6)                  | ✅                                           |

## Latest Updates (March 28, 2026 - UX Timeline & Badges)

### FR-07 AI Summarization — Timeline Format with Badges
- **Summary Display Redesign**:
  - AI now returns timeline array: `["Hôm nay, event...", "Hôm qua, event..."]`
  - `AISummaryCard.tsx` parses and groups timeline entries by date with left border accent
  - Removed paragraph format; replaced with date-grouped timeline blocks
  - Clean visual hierarchy with bullet points per date entry

- **Priority Badge System** (replaces emoji icons):
  - Priority mapping: "Cao" (High) → Red badge, "Trung bình" (Medium) → Amber badge, "Thấp" (Low) → Slate badge
  - Deadline chip: sky-blue with clock icon
  - Applied to: Summary action items + Smart Reply Studio next actions
  - Functions: `getPriorityBadgeClass()` → Tailwind classes, `getDisplayPriority()` → Vietnamese labels

- **Backend Compatibility**:
  - `summarization_prompt.py`: Updated "Trung" → "Trung bình" in examples
  - `normalize_summarization_output()`: Preserves array format (not converted to string)
  - `SummarizeResponse` Pydantic model: `summary: Union[str, List[str]]` (backward compatible)
  - MongoDB schema: `summary.text: Schema.Types.Mixed` accepts both string and array formats
  - `Thread.summary` interface updated: `text: string | string[]`

### FR-08 Smart Reply Studio — Enhanced Context Selection
- **Step 1 - Summary Display**:
  - Shows timeline format matching thread detail, not plain text
  - Grouped by date with visual indentation

- **Step 2 - Next Actions with Badges**:
  - Each action checkbox displays:
    - Extracted action text (without priority/deadline wrapper)
    - Priority badge (Cao/Trung bình/Thấp with color)
    - Deadline chip (⏰ deadline info)
  - Checkbox UX improved: larger p-3 spacing, selected state with indigo background
  - Functions: `parseActionItem()` extracts priority/deadline using regex pattern

- **Placeholder Text Improvement**:
  - Textarea: `text-black` default + `placeholder-gray-500 placeholder:font-medium` for better visibility

### FR-04 Thread Detail — Default Collapsed Emails
- Emails now **collapsed by default** instead of expanded
- Changed logic: `isExpanded = expandedMessages[msg._id] === true` (default false)
- Users click to expand and view full content
- Collapsed header shows: From name (linkable) + relative time + subject + body snippet

## Affected Files (March 28, 2026 - UX Timeline & Badges)

| File | Changes | Impact |
|------|---------|--------|
| `apps/frontend/src/components/AISummaryCard.tsx` | Added timeline parsing, replaced emoji with colored badges, new helper functions | FR-07 summary display |
| `apps/ai-service/core/prompts/summarization_prompt.py` | Updated "Trung" → "Trung bình", emphasized "must be exactly" for priority values | AI prompt accuracy |
| `apps/ai-service/models/summarize.py` | `summary: Union[str, List[str]]` | Allow array format from AI |
| `apps/backend/src/models/Thread.ts` | `IThreadSummary.text: string \| string[]`, `schema.text: Schema.Types.Mixed` | Support both formats in DB |
| `apps/backend/src/modules/ai/ai.service.ts` | `SummarizeResponse.summary: string \| string[]` | Type compatibility |
| `apps/backend/src/app/api/threads/[threadId]/suggest-reply/route.ts` | Added array-to-string join for timeline in context builder | Handle new format |
| `apps/frontend/src/app/(dashboard)/threads/[id]/smart-reply/page.tsx` | Added timeline parsing, priority badges, action item parsing | Studio Step 1 & 2 display |
| `apps/frontend/src/app/(dashboard)/threads/[id]/page.tsx` | Changed default collapse: `isExpanded === true` (was `!== false`) | Email default collapsed |

## Data Model Updates

### Thread Summary Format
- **Old format** (string): `"Alex requested update on AC-1042, support acknowledged within 4h..."`
- **New format** (array): `["Hôm nay sáng, Alex thông báo AC-1042 trễ 3 ngày", "Hôm nay 8:57, Support phản hồi..."]`
- **Migration**: Automatic via Union type + parseTimelineSummary() fallback

### Action Item Format
- **Unchanged** but now parsed and styled with badges
- Format: `"Action text (Priority | Deadline)"` → extracted and colored separately

## Known Limitations / Next Steps

- Timeline grouping relies on date parsing from AI response (format must include date label)
- If AI returns array without date markers, falls back to "Summary" grouping
- No UI yet for users to manually edit summary or next actions

---

## Recent Bug Fixes Previously (March 28, 2026)

| Bug | Fix | Date |
|-----|-----|------|
| Pydantic validation error: summary as array not string | Updated SummarizeResponse to Union[str, List[str]] | 28-Mar |
| MongoDB schema cast error for array summary | Changed summary.text to Schema.Types.Mixed | 28-Mar |
| TypeScript type mismatch in suggest-reply context | Added array-to-string join logic | 28-Mar |
| Summary parsing in suggest-reply route | Handles both string and array formats | 28-Mar |

## Recent Updates (March 17, 2026 - Sandbox Hardening)

- Added production safety guard for sandbox APIs (`inject`, `clear`, `scenarios`) with env gate:
  - Allowed in development by default.
  - Allowed in non-development only when `ENABLE_SANDBOX_API=true`.
- Standardized scenario source: frontend now fetches scenario list and payload from backend APIs (`/api/sandbox/scenarios`, `/api/sandbox/scenarios/:slug`) instead of hardcoded JSON.
- Added dev-only sidebar navigation item for Sandbox dashboard.
- Added short usage documentation: `.agents/knowledge/sandbox-usage.md`.

## Recent Updates (March 28, 2026 - Sandbox Multi-Scenario & UX)

- Added registry-based sandbox scenario architecture with list endpoint (`GET /api/sandbox/scenarios`) and slug endpoint (`GET /api/sandbox/scenarios/:slug`).
- Added second built-in scenario (`payment-dispute`) and migrated scenario metadata/content to Vietnamese.
- Updated frontend sandbox page to load scenario options dynamically and inject selected slug payload.
- Reworked built-in scenarios into interrupted unresolved threads to improve Smart Reply evaluation quality.
- Refined summary prompt contract and moved prompt builder/normalizer into `apps/ai-service/core/prompts/summarization_prompt.py`.
- Improved thread detail UX:
  - `AISummaryCard` action metadata chips for Priority/Owner/Deadline.
  - Stable SVG checkbox icon rendering.
  - Plain-text message body normalization for escaped newline characters.

## Changelog Files (load only what you need)

| File                                                                 | When to load                               |
| -------------------------------------------------------------------- | ------------------------------------------ |
| [`changelog/telegram.md`](changelog/telegram.md)                     | Telegram auth, chat, messages, sync        |
| [`changelog/topic-intelligence.md`](changelog/topic-intelligence.md) | Topics, Focus page, clustering, scoring    |
| [`changelog/email-core.md`](changelog/email-core.md)                 | Email sync, compose, contacts, AI features |
| [`changelog/infra-fixes.md`](changelog/infra-fixes.md)               | Docker, build config, production fixes     |
