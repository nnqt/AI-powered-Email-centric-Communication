# UX Timeline & Badges Update — March 28, 2026

**Date**: March 28, 2026  
**Sprint**: UX Improvements Phase 1  
**Status**: ✅ Complete

## Summary

Redesigned AI summary display and Smart Reply Studio to use timeline-based format with colored priority badges, improving readability and visual hierarchy across the app.

## Features Implemented

### 1. Timeline Summary Format (FR-07)
- **AI Output Change**:
  - Now returns timeline array: `["Hôm nay, event...", "Hôm qua, event..."]`
  - Backward compatible with string format via Union types
  
- **Frontend Display**:
  - Date-grouped timeline blocks with left purple border
  - Clean visual grouping and hierarchy
  - Bullet points per date entry
  - Removed plain text paragraph format

### 2. Priority Badge System
- **Replaces Emoji Icons** (🔴🟡🟢):
  - Cao (High) → Red badge: `bg-red-100 text-red-700 border-red-200`
  - Trung bình (Medium) → Amber badge: `bg-amber-100 text-amber-700 border-amber-200`
  - Thấp (Low) → Slate badge: `bg-slate-100 text-slate-700 border-slate-200`

- **Applied To**:
  - Summary card action items (AISummaryCard)
  - Smart Reply Studio next actions (Step 2)
  
- **Deadline Chips**:
  - Sky-blue: `bg-sky-100 text-sky-700 border-sky-200`
  - Clock icon + deadline info

### 3. Smart Reply Studio (FR-08)
- **Step 1 - Summary Display**:
  - Shows timeline format matching thread detail
  - Refresh button to update from AI
  
- **Step 2 - Next Actions with Badges**:
  - Parsed action text (without metadata wrapper)
  - Color-coded priority badge
  - Deadline chip with clock icon
  - Improved checkbox UX: larger spacing, selected state highlighting
  
- **Step 3 - Context Preview**:
  - Shows combined context before generation

### 4. Thread Detail Enhancement (FR-04)
- **Default Collapsed Emails**:
  - Emails now collapsed by default (was expanded)
  - Collapsed header: From name + time + subject + snippet
  - Click to expand and view full content

## Technical Changes

### Backend Models & Services

| File | Changes |
|------|---------|
| `summarization_prompt.py` | Updated "Trung" → "Trung bình", emphasized priority values requirement |
| `models/summarize.py` | `summary: Union[str, List[str]]` |
| `Thread.ts` | `IThreadSummary.text: string \| string[]`, `schema.text: Schema.Types.Mixed` |
| `ai.service.ts` | `SummarizeResponse.summary: string \| string[]` |
| `suggest-reply/route.ts` | Added array-to-string join for timeline in context |

### Frontend Components

| File | Changes |
|------|---------|
| `AISummaryCard.tsx` | Timeline parsing, badge functions, helper utilities |
| `smart-reply/page.tsx` | Timeline display in Step 1, priority badges in Step 2 |
| `threads/[id]/page.tsx` | Changed default collapse logic for emails |

## Data Migration

### Summary Field Evolution
- **Old**: `summary: { text: "Paragraph format string..." }`
- **New**: `summary: { text: ["Date label, event...", "Date label, event..."] }`
- **Compatibility**: Union type + automatic parsing with fallback

### Pydantic Validation
- Python models updated to accept both formats
- MongoDB schema uses `Mix edTypes.Mixed` (no migration needed)
- TypeScript interfaces updated for type safety

## Code Helpers Added

### AISummaryCard.tsx
```typescript
function getPriorityBadgeClass(priority?: string): string
function getDisplayPriority(priority?: string): string
function parseTimelineSummary(summary: any): TimelineEntry[]
```

### smart-reply/page.tsx
```typescript
function parseActionItem(raw: string): ParsedAction
```

## UX Improvements

- ✅ Better visual hierarchy with date grouping
- ✅ Cleaner priority indication with color-coded badges
- ✅ Faster scanning of action items (visual + text)
- ✅ Reduced cognitive load (no emoji interpretation needed)
- ✅ Consistent design across Summary and Studio
- ✅ Emails less intrusive (default collapsed)
- ✅ Better placeholder visibility (darker text)

## Testing Checklist

- [x] Summary displays in timeline format
- [x] Priority badges render correctly in Summary
- [x] Priority badges render in Smart Reply Studio Step 2
- [x] Deadline chips display with icon
- [x] Array and string formats both parse correctly
- [x] MongoDB stores both types without casting error
- [x] Type checking passes in TypeScript
- [x] Emails default to collapsed in thread detail
- [x] Studio context budget warning displays
- [x] Placeholder text visible on textareas

## Files Modified Summary

**Backend**: 5 files  
**Frontend**: 3 files  
**Documentation**: 3 files

**Total impact**: Low risk, backward compatible with Union types

## Known Issues

- Timeline grouping depends on AI date format in response
- Manual summary/action editing not yet available
- No UI for format conversion (array ↔ string)

## Future Enhancements

- User-editable timeline entries
- Custom badge colors per priority level
- Smart action item suggestions
- Archive/snooze actions directly from summary

---

**Author**: AI Assistant  
**Review status**: ✅ Ready for production
