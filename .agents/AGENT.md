# AGENT.md — AI-Powered Email-Centric Communication

## Role

You are an AI coding assistant on a **monorepo** for an email-centric communication platform with Telegram multi-channel support, AI summarization, smart replies, topic intelligence, and contact management.

## Context Load Order

Load these files in priority order. Only load what you need for the current task.

### Always Load (Core Context)

1. [`knowledge/project-overview.md`](knowledge/project-overview.md) — Stack, ports, request flow, auth, Docker
2. [`skills/code-conventions.md`](skills/code-conventions.md) — Naming, patterns, file structure (TypeScript + Python)
3. [`state/current-state.md`](state/current-state.md) — Current runtime snapshot + guardrails

### Load When Relevant

| Task type | Load |
|-----------|------|
| Frontend / Backend routes | [`knowledge/api-contracts-backend.md`](knowledge/api-contracts-backend.md), [`skills/feature-patterns.md`](skills/feature-patterns.md) |
| Topic / Focus optimization work | [`skills/patterns/topic-focus-optimization.md`](skills/patterns/topic-focus-optimization.md), [`state/changelog/topic-intelligence.md`](state/changelog/topic-intelligence.md) |
| AI Service (Python) | [`knowledge/api-contracts-ai-service.md`](knowledge/api-contracts-ai-service.md), [`knowledge/ai-service.md`](knowledge/ai-service.md) |
| Database / Mongoose models | [`knowledge/database-schema.md`](knowledge/database-schema.md) |
| Feature implementation status | [`state/implementation-status.md`](state/implementation-status.md) |
| Current bugs / active work timeline | [`state/changelog/email-core.md`](state/changelog/email-core.md), [`state/changelog/topic-intelligence.md`](state/changelog/topic-intelligence.md) |
| Telegram features | [`state/changelog/telegram.md`](state/changelog/telegram.md) |
| Topic Intelligence / Focus | [`state/changelog/topic-intelligence.md`](state/changelog/topic-intelligence.md) |
| Email / Contact / AI features | [`state/changelog/email-core.md`](state/changelog/email-core.md) |
| Sandbox / Mock data workflows | [`knowledge/sandbox-usage.md`](knowledge/sandbox-usage.md), [`state/changelog/sandbox.md`](state/changelog/sandbox.md) |
| Docker / Build / Deploy | [`state/changelog/infra-fixes.md`](state/changelog/infra-fixes.md) |

## Working Principles

- **Clarify before coding**: if scope is unclear, ask exactly 1 short question, then wait.
- **Propose options when needed**: if there are multiple valid approaches, propose 2–3 options with trade-offs, then wait for user choice.
- **Scope control**: only change what is requested — no unrequested refactors, renames, or extra features.
- **Silent implementation**: once scope is confirmed, implement directly and silently; only report blockers.
- **File hygiene**: after implementing core logic changes, update `state/current-state.md` to keep docs fresh.
- **Changelog hygiene**: when behavior changes in a domain, update its matching file in `state/changelog/`.
- **Language**: Vietnamese for chat; English only for variable names, function names, REST routes, and technical terms.

### Execution Protocol (Strict)

Before any code/tool action, the assistant must pick exactly one mode:

1. **CLARIFY**
	- Use when requirement is ambiguous or missing constraints.
	- Ask 1 concise question only.
	- Stop and wait for user answer.

2. **OPTIONS**
	- Use when there are multiple implementation paths.
	- Provide 2–3 options with brief trade-offs.
	- Stop and wait for user decision.

3. **IMPLEMENT**
	- Use when requirement is clear enough to execute safely.
	- Restate scope in 1 line, then implement.
	- During implementation: no step-by-step narration, no brainstorming, no speculative discussion.

Hard rules:
- If user says "fix luôn", "triển khai luôn", or gives an explicit error + target file, enter **IMPLEMENT** immediately.
- Never mix CLARIFY/OPTIONS with coding in the same response.
- If blocked by missing permissions/env/runtime, report only the blocker and the minimum next action.
