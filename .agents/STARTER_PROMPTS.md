# Starter Prompts — AI-Powered Email-Centric Communication

Dùng những prompt này khi bắt đầu chat mới để AI nắm context nhanh nhất.

---

## Prompt ngắn — dùng hằng ngày

```
Bạn là AI coding assistant cho dự án AI-Powered Email-Centric Communication.

Đọc ngay 2 file này trước khi làm bất kỳ việc gì:
1. `.agents/AGENT.md` — role, load order, working principles
2. `.agents/state/current-state.md` — trạng thái hiện tại, bugs gần đây

Sau đó load thêm context theo task:
- Làm Telegram → `.agents/state/changelog/telegram.md`
- Làm Topics/Focus → `.agents/state/changelog/topic-intelligence.md`
- Làm Email/Contact/AI → `.agents/state/changelog/email-core.md`
- Cần API reference → `.agents/knowledge/api-contracts-backend.md`
- Cần Docker/deploy → `.agents/state/changelog/infra-fixes.md`

Task hôm nay: [MÔ TẢ TASK Ở ĐÂY]
```

---

## Prompt đầy đủ — dùng khi task phức tạp / cross-cutting

```
Bạn là AI coding assistant cho dự án AI-Powered Email-Centric Communication.

**Monorepo structure:**
- `apps/frontend/` — Next.js 16, port 3000
- `apps/backend/` — Next.js 16 API + Socket.IO, port 4000
- `apps/ai-service/` — FastAPI + Gemini, port 5000
- `infra/` — Docker Compose

**Context files (đọc theo thứ tự này):**
1. `.agents/AGENT.md` — working principles và load order đầy đủ
2. `.agents/knowledge/project-overview.md` — stack, ports, request flow, auth
3. `.agents/skills/code-conventions.md` — naming conventions, patterns
4. `.agents/state/current-state.md` — status hiện tại, bugs gần đây
5. [Load thêm tùy task — xem bảng trong AGENT.md]

**Nguyên tắc:**
- Hỏi trước khi code nếu scope chưa rõ
- Propose options + trade-offs trước khi implement
- Chỉ thay đổi những gì được yêu cầu
- Sau khi implement: cập nhật `.agents/state/current-state.md`

Task: [MÔ TẢ TASK Ở ĐÂY]
```

---

## Template theo domain

### Khi làm Telegram

```
Context: `.agents/AGENT.md` + `.agents/state/changelog/telegram.md`

Key files:
- `apps/backend/src/lib/telegramManager.ts` — syncDialogs, syncChatHistory, setupMessageListener
- `apps/backend/src/app/api/telegram/` — routes
- `apps/frontend/src/hooks/useTelegramChats.ts`, `useTelegramMessages.ts`

Task: [...]
```

### Khi làm Topics / Focus

```
Context: `.agents/AGENT.md` + `.agents/state/changelog/topic-intelligence.md`

Key files:
- `apps/backend/src/modules/topics/topic.service.ts`
- `apps/backend/src/app/api/topics/`, `api/focus/`
- `apps/frontend/src/features/focus/FocusTopicCard.tsx`

Task: [...]
```

### Khi làm Email / Contact

```
Context: `.agents/AGENT.md` + `.agents/state/changelog/email-core.md`

Key files:
- `apps/backend/src/modules/email/gmail.service.ts`
- `apps/backend/src/modules/contacts/contact.service.ts`
- `apps/frontend/src/features/inbox/ThreadList.tsx`

Task: [...]
```

### Khi setup / deploy

```
Context: `.agents/AGENT.md` + `.agents/state/changelog/infra-fixes.md`

Key files:
- `infra/docker-compose.yml`
- `apps/backend/next.config.ts`, `server.ts`

Task: [...]
```

---

## Tips

- **Prompt ngắn** đủ dùng cho 90% task thông thường
- **Prompt đầy đủ** dùng khi task span nhiều modules (vd: thêm feature từ AI service → backend → frontend)
- Luôn điền `[Task]` rõ ràng — càng cụ thể AI càng ít hỏi lại
- Nếu AI cần thêm context, nó sẽ tự biết đọc file nào theo bảng trong `AGENT.md`
