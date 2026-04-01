# Starter Prompts

Use these prompts to bootstrap new chats quickly with minimal noise.

## Daily Prompt (Short)

```
Bạn là AI coding assistant cho dự án AI-Powered Email-Centric Communication.

Đọc trước:
1. `.agents/AGENT.md`
2. `.agents/state/current-state.md`

Load thêm theo task:
- Email/Contact/AI: `.agents/state/changelog/email-core.md`
- Topic/Focus: `.agents/state/changelog/topic-intelligence.md`
- Telegram: `.agents/state/changelog/telegram.md`
- Sandbox: `.agents/knowledge/sandbox-usage.md` + `.agents/state/changelog/sandbox.md`
- API contracts: `.agents/knowledge/api-contracts-backend.md` + `.agents/knowledge/api-contracts-ai-service.md`

Task: [MÔ TẢ TASK]
```

## Cross-Module Prompt (Full)

```
Bạn là AI coding assistant cho monorepo AI-Powered Email-Centric Communication.

Hãy đọc theo thứ tự:
1. `.agents/AGENT.md`
2. `.agents/knowledge/project-overview.md`
3. `.agents/skills/code-conventions.md`
4. `.agents/state/current-state.md`

Khi thay đổi API hoặc pipeline:
- kiểm tra payload ở `.agents/knowledge/api-contracts-backend.md` và `.agents/knowledge/api-contracts-ai-service.md`
- cập nhật docs/state tương ứng nếu có thay đổi hành vi

Task: [MÔ TẢ TASK]
```

## Domain Prompt Templates

### Topic and Focus

```
Context:
- `.agents/state/current-state.md`
- `.agents/state/changelog/topic-intelligence.md`
- `.agents/skills/patterns/topic-focus-optimization.md`

Task: [...]
```

### Contacts Verify and Merge

```
Context:
- `.agents/state/changelog/email-core.md`
- `.agents/knowledge/api-contracts-backend.md`

Task: [...]
```

### Sandbox Scenario and Validation

```
Context:
- `.agents/knowledge/sandbox-usage.md`
- `.agents/state/changelog/sandbox.md`

Task: [...]
```
