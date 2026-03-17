# Database Schema — MongoDB (Mongoose)

Connection: `MONGO_URI` (`mongodb://mongo:27017/emailhub` in Docker)

---

## User (`apps/backend/src/models/User.ts`)

| Field                | Type    | Constraints       | Notes                         |
| -------------------- | ------- | ----------------- | ----------------------------- |
| `email`              | String  | required, indexed |                               |
| `name`               | String  | optional          |                               |
| `image`              | String  | optional          | Google profile picture URL    |
| `googleId`           | String  | required, unique  |                               |
| `accessToken`        | String  |                   | Latest Google access token    |
| `refreshToken`       | String  |                   | For token refresh + Gmail API |
| `gmailNextPageToken` | String  | nullable          | null = fully synced           |
| `gmailSyncComplete`  | Boolean | default false     | true = no more Gmail pages    |
| `telegramSession`    | String  | nullable          | GramJS StringSession          |
| `telegramPhone`      | String  | nullable          | Phone number used for login   |
| `createdAt`          | Date    | timestamps        |                               |
| `updatedAt`          | Date    | timestamps        |                               |

---

## Thread (`apps/backend/src/models/Thread.ts`)

| Field                  | Type     | Constraints          | Notes                                                |
| ---------------------- | -------- | -------------------- | ---------------------------------------------------- |
| `id`                   | String   | required, unique     | Gmail thread ID                                      |
| `userId`               | ObjectId | ref: User            |                                                      |
| `historyId`            | String   |                      | Gmail history marker                                 |
| `snippet`              | String   |                      | Preview text                                         |
| `lastMessageDate`      | Date     |                      | Sort key + pagination cursor                         |
| `participants`         | String[] |                      | From + To across all messages (deduped)              |
| `subject`              | String   |                      | First message Subject header                         |
| `summary`              | Object   |                      | `{ text, key_issues[], action_required[] }`          |
| `isRead`               | Boolean  | default false        |                                                      |
| `isArchived`           | Boolean  | default false        |                                                      |
| `isUrgent`             | Boolean  | default false        | Set by AI urgent classifier (fire-and-forget)        |
| `urgentClassifiedAt`   | Date     | nullable             | Timestamp of last urgent classification              |
| `urgentDismissed`      | Boolean  | default false        | Set true on markRead(true); hides from urgent filter |
| `categories`           | String[] |                      | ThreadCategory enum values (22-value)                |
| `categorizedAt`        | Date     | nullable             | Timestamp of last category classification            |
| `categorySource`       | String   | enum                 | `"ai"` or `"user"` or `"rule"`                       |
| `lastMessageDirection` | String   | enum                 | `"inbound"` or `"outbound"`                          |
| `lastInboundAt`        | Date     | nullable             | Date of last inbound message                         |
| `noiseFiltered`        | Boolean  | default false        | true = Tier 1 noise (noreply/automated)              |
| `topicId`              | ObjectId | ref: Topic, nullable | Topic this thread is clustered into                  |
| `createdAt`            | Date     | timestamps           |                                                      |
| `updatedAt`            | Date     | timestamps           |                                                      |

**Pagination cursor**: composite key `"${lastMessageDate.toISOString()}_${_id}"`, parsed with `lastIndexOf("_")`.

**ThreadFilter** values:

- `"all"` → `isArchived: { $ne: true }`
- `"unread"` → `isRead: false, isArchived: { $ne: true }`
- `"archived"` → `isArchived: true`
- `"urgent"` → `isUrgent: true, isArchived: { $ne: true }, urgentDismissed: { $ne: true }`

**ThreadCategory enum** (22 values):

```
inquiry | introduction | follow_up | thank_you
proposal | contract | invoice | negotiation
project_update | task_request | meeting_request | report
support_request | bug_report | complaint | feedback
notification | newsletter | receipt | security_alert
personal | other
```

---

## Contact (`apps/backend/src/models/Contact.ts`)

| Field                  | Type     | Constraints                 | Notes                                               |
| ---------------------- | -------- | --------------------------- | --------------------------------------------------- |
| `email`                | String   | required, unique per userId | Primary email address                               |
| `userId`               | ObjectId | ref: User                   |                                                     |
| `name`                 | String   |                             | Display name (AI-inferred or user-set)              |
| `org`                  | String   |                             | Organisation / company                              |
| `language`             | String   |                             | Preferred language (`"vi"`, `"en"`)                 |
| `alternateEmails`      | String[] | default `[]`                | Alias addresses                                     |
| `aiEnriched`           | Boolean  | default false               | true after successful AI enrichment                 |
| `enrichedAt`           | Date     | nullable                    | Timestamp of last AI enrichment                     |
| `mergedInto`           | ObjectId | ref: Contact, nullable      | Set on soft-merge (record kept for audit trail)     |
| `category`             | String   | enum; default `"unknown"`   | `colleague \| customer \| other \| spam \| unknown` |
| `categories`           | String[] | enum values; default `[]`   | Multi-category — all applicable categories          |
| `categorySource`       | String   | enum; default `"rule"`      | `rule \| ai \| user`                                |
| `categoryAiSuggestion` | String   | nullable                    | Latest AI category suggestion pending user confirm  |
| `telegramId`           | String   | sparse, unique if present   | Telegram user ID                                    |
| `telegramUsername`     | String   | nullable                    | Telegram @username                                  |
| `telegramName`         | String   | nullable                    | Telegram display name                               |
| `createdAt`            | Date     | timestamps                  |                                                     |
| `updatedAt`            | Date     | timestamps                  |                                                     |

**Key constraint**: `{ email, userId }` unique compound index.  
**Merge**: soft-delete pattern — set `mergedInto`, never delete source document.  
**Timeline query**: regex anchor `(?:^|<)email(?:>|$)` on `participants` field to avoid substring false-positives.

---

## Topic (`apps/backend/src/models/Topic.ts`)

| Field              | Type       | Constraints            | Notes                                               |
| ------------------ | ---------- | ---------------------- | --------------------------------------------------- |
| `userId`           | ObjectId   | ref: User, required    |                                                     |
| `contactId`        | ObjectId   | ref: Contact, required | The contact this topic belongs to                   |
| `name`             | String     | required               | Topic label (AI-generated or user-renamed)          |
| `nameEditedByUser` | Boolean    | default false          | Prevents AI re-labeling when true                   |
| `threadIds`        | ObjectId[] | ref: Thread            | All threads in this topic                           |
| `threadCount`      | Number     | default 0              | Denormalized count                                  |
| `noiseCount`       | Number     | default 0              | Threads filtered as noise                           |
| Field                      | Type       | Constraints             | Notes                                               |
| -------------------------- | ---------- | ----------------------- | --------------------------------------------------- |
| `userId`                   | ObjectId   | ref: User, required     |                                                     |
| `contactId`                | ObjectId   | ref: Contact, required  | The contact this topic belongs to                   |
| `name`                     | String     | required                | Topic label (AI-generated or user-renamed)          |
| `nameEditedByUser`         | Boolean    | default false           | Prevents AI re-labeling when true                   |
| `threadIds`                | ObjectId[] | ref: Thread             | All threads in this topic                           |
| `threadCount`              | Number     | default 0               | Denormalized count                                  |
| `noiseCount`               | Number     | default 0               | Threads filtered as noise                           |
| `focusScore`               | Number     | default 0               | Computed: `unansweredCount×40 + recency + weight`   |
| `lastScoredAt`             | Date       | nullable                | Timestamp of last score computation                 |
| `lastInboundAt`            | Date       | nullable                | Date of most recent inbound message across threads  |
| `lastOutboundAt`           | Date       | nullable                | Date of most recent outbound message across threads |
| `unansweredCount`          | Number     | default 0               | Inbound threads with no subsequent outbound reply   |
| `aiLabeled`                | Boolean    | default false           | true after AI has set the name                      |
| `aiLabeledAt`              | Date       | nullable                | Timestamp of last AI labeling                       |
| `chatInsights`             | Object[]   | subdocument array       | Extracted intents from Telegram chunks              |
| `lastAnalyzedMessageDate`  | Date       | nullable                | Latest Telegram message date already processed      |
| `createdAt`                | Date       | timestamps              |                                                     |
| `updatedAt`                | Date       | timestamps              |                                                     |

**ChatInsight subdocument**:

| Field          | Type   | Notes                                   |
| -------------- | ------ | --------------------------------------- |
| `intent`       | String | Main intent of the conversation chunk   |
| `summary`      | String | Short summary of the discussion         |
| `sourceChatId` | String | Telegram Chat ID this insight came from |
| `date`         | Date   | When the chunk was analyzed             |

**Index**: compound `{ userId: 1, contactId: 1 }`

**Focus Score Formula**:

```
focusScore = unansweredCount × 40
           + recencyScore(lastInboundAt)   // <6h=30 | 6-24h=24 | 1-3d=18 | 3-7d=9 | 7-30d=3 | >30d=0
           + contactWeight                 // colleague|customer=10 | other|unknown=5 | spam=0
```

---

## Message (`apps/backend/src/models/Message.ts`)

| Field       | Type     | Constraints      | Notes                      |
| ----------- | -------- | ---------------- | -------------------------- |
| `id`        | String   | required, unique | Gmail message ID           |
| `threadId`  | ObjectId | ref: Thread      |                            |
| `userId`    | ObjectId | ref: User        |                            |
| `from`      | String   |                  | Raw From header            |
| `to`        | String[] |                  | Parsed To header           |
| `subject`   | String   |                  | Subject header             |
| `body`      | String   |                  | Decoded HTML or plain text |
| `snippet`   | String   |                  | Gmail message snippet      |
| `date`      | Date     |                  | From `internalDate`        |
| `labelIds`  | String[] |                  | Gmail label IDs            |
| `createdAt` | Date     | timestamps       |                            |
| `updatedAt` | Date     | timestamps       |                            |

---

## Summary Subdocument (embedded in Thread)

```typescript
{
  text: string;          // Vietnamese paragraph summary
  key_issues: string[];  // Short bullet points
  action_required: string[]; // Action items
}
```

---

## Redis Keys

| Key Pattern                          | TTL | Value                           |
| ------------------------------------ | --- | ------------------------------- |
| `contact:merge_suggestions:{userId}` | 6h  | JSON array of merge suggestions |

Cache invalidated on `POST /api/contacts/merge` success.

---

## TelegramChat (`apps/backend/src/models/TelegramChat.ts`)

| Field              | Type     | Constraints              | Notes                                     |
| ------------------ | -------- | ------------------------ | ----------------------------------------- |
| `chatId`           | String   | unique per user          | Telegram chat ID                          |
| `userId`           | ObjectId | ref: User                |                                           |
| `title`            | String   |                          | Chat/group title or contact name          |
| `type`             | String   | enum                     | `"private"` or `"group"`                 |
| `lastMessageDate`  | Date     |                          | Date of most recent message               |
| `unreadCount`      | Number   | default 0                | Unread message count                      |
| `createdAt`        | Date     | timestamps               |                                           |
| `updatedAt`        | Date     | timestamps               |                                           |

**Index**: compound `{ userId: 1, lastMessageDate: -1 }`

---

## TelegramMessage (`apps/backend/src/models/TelegramMessage.ts`)

| Field        | Type     | Constraints | Notes                            |
| ------------ | -------- | ----------- | -------------------------------- |
| `messageId`  | Number   |             | Telegram message ID              |
| `chatId`     | String   |             | Ref to TelegramChat.chatId       |
| `userId`     | ObjectId | ref: User   |                                  |
| `senderId`   | String   |             | Telegram sender user ID          |
| `text`       | String   |             | Message text content             |
| `date`       | Date     |             | Message sent date                |
| `isOutbound` | Boolean  |             | true if sent by authenticated user |
| `createdAt`  | Date     | timestamps  |                                  |
| `updatedAt`  | Date     | timestamps  |                                  |
