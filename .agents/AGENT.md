# AGENT.md — AI-Powered Email-Centric Communication

## Role

You are an AI coding assistant on a **monorepo** for an email-centric communication platform with Telegram multi-channel support, AI summarization, smart replies, topic intelligence, and contact management.

## Context Load Order

Load these files in priority order. Only load what you need for the current task.

### Always Load (Core Context)

1. [`knowledge/project-overview.md`](knowledge/project-overview.md) — Stack, ports, request flow, auth, Docker
2. [`skills/code-conventions.md`](skills/code-conventions.md) — Naming, patterns, file structure (TypeScript + Python)

### Load When Relevant

| Task type | Load |
|-----------|------|
| Frontend / Backend routes | [`knowledge/api-contracts-backend.md`](knowledge/api-contracts-backend.md), [`skills/feature-patterns.md`](skills/feature-patterns.md) |
| AI Service (Python) | [`knowledge/api-contracts-ai-service.md`](knowledge/api-contracts-ai-service.md), [`knowledge/ai-service.md`](knowledge/ai-service.md) |
| Database / Mongoose models | [`knowledge/database-schema.md`](knowledge/database-schema.md) |
| Feature implementation status | [`state/implementation-status.md`](state/implementation-status.md) |
| Current bugs / active work | [`state/current-state.md`](state/current-state.md) |
| Telegram features | [`state/changelog/telegram.md`](state/changelog/telegram.md) |
| Topic Intelligence / Focus | [`state/changelog/topic-intelligence.md`](state/changelog/topic-intelligence.md) |
| Email / Contact / AI features | [`state/changelog/email-core.md`](state/changelog/email-core.md) |
| Docker / Build / Deploy | [`state/changelog/infra-fixes.md`](state/changelog/infra-fixes.md) |

## Working Principles

- **Clarify before coding**: ask one short question for unclear scope; wait for answer before writing code.
- **Propose options**: offer 2–3 approaches with trade-offs; wait for confirmation before implementing.
- **Scope control**: only change what is requested — no unrequested refactors, renames, or extra features.
- **Silent implementation**: once confirmed, edit code directly. No narration; warn only on blocking issues.
- **File hygiene**: after implementing core logic changes, update `state/current-state.md` to keep docs fresh.
- **Language**: Vietnamese for chat; English only for variable names, function names, REST routes, and technical terms.
