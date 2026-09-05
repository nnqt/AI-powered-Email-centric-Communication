# AI-Powered Email-Centric Communication — Project Context

## Project Identity

Monorepo for an email-centric communication platform with Telegram multi-channel support, AI summarization, smart replies, topic intelligence, and contact management.

**Author**: Ngô Nguyễn Quốc Thịnh (HCMUT — BK)
**Thesis supervisor**: ThS. Võ Thanh Hùng
**Thesis title**: Nền tảng quản lý trao đổi Email và mở rộng đa kênh ứng dụng AI

## Stack

| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript    |
| Backend  | Next.js 16 API Routes + NextAuth v4 + Mongoose + GramJS |
| AI       | FastAPI + Google Gemini (`gemini-2.0-flash`)       |
| DB       | MongoDB 7                                          |
| Cache    | Redis 7                                            |
| Realtime | Socket.IO + `@socket.io/redis-adapter`             |
| Deploy   | Docker Compose (each app has own build context)    |

## Context Load Order

Load only what you need for the current task.

### Always Load (Core Context)

1. This file (`.ai/CONTEXT.md`)
2. [`.ai/skills/code-conventions.md`](skills/code-conventions.md) — naming, patterns, file structure
3. [`.ai/state/current-state.md`](state/current-state.md) — runtime snapshot + guardrails

### Load When Relevant

| Task type | Load |
|-----------|------|
| Frontend / Backend routes | [`knowledge/api-contracts-backend.md`](knowledge/api-contracts-backend.md), [`skills/feature-patterns.md`](skills/feature-patterns.md) |
| Topic / Focus optimization | [`skills/patterns/topic-focus-optimization.md`](skills/patterns/topic-focus-optimization.md), [`state/changelog/topic-intelligence.md`](state/changelog/topic-intelligence.md) |
| AI Service (Python) | [`knowledge/api-contracts-ai-service.md`](knowledge/api-contracts-ai-service.md), [`knowledge/ai-service.md`](knowledge/ai-service.md) |
| Database / Mongoose models | [`knowledge/database-schema.md`](knowledge/database-schema.md) |
| Feature implementation status | [`state/implementation-status.md`](state/implementation-status.md) |
| Architecture overview | [`knowledge/architecture.md`](knowledge/architecture.md) |
| Telegram features | [`state/changelog/telegram.md`](state/changelog/telegram.md) |
| Email / Contact / AI features | [`state/changelog/email-core.md`](state/changelog/email-core.md) |
| Sandbox / Mock data | [`knowledge/sandbox-usage.md`](knowledge/sandbox-usage.md), [`state/changelog/sandbox.md`](state/changelog/sandbox.md) |
| Docker / Build / Deploy | [`state/changelog/infra-fixes.md`](state/changelog/infra-fixes.md) |
| Thesis writing | [`roles/thesis-writer.md`](roles/thesis-writer.md), [`thesis/`](thesis/) |

## Roles

This project has two distinct work contexts. Each conversation should use one role:

1. **Developer** ([`roles/developer.md`](roles/developer.md)) — code generation, debugging, feature implementation
2. **Thesis Writer** ([`roles/thesis-writer.md`](roles/thesis-writer.md)) — academic writing, LaTeX, Vietnamese formal register

## Working Principles (All Roles)

- **Language**: Vietnamese for chat; English for variable names, function names, REST routes, and technical terms.
- **Scope control**: only change what is requested — no unrequested refactors.
- **File hygiene**: after implementing core logic changes, update `state/current-state.md`.
- **Changelog hygiene**: when behavior changes in a domain, update its matching file in `state/changelog/`.
