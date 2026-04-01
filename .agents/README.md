# .agents Index

This index helps contributors find the right context fast.

## Start Here

1. `AGENT.md`
2. `state/current-state.md`
3. `knowledge/project-overview.md`

## Skills

1. `skills/code-conventions.md`
2. `skills/feature-patterns.md`
3. `skills/patterns/topic-focus-optimization.md`

## API Contracts

1. `knowledge/api-contracts-backend.md`
2. `knowledge/api-contracts-ai-service.md`

## State and History

1. Snapshot: `state/current-state.md`
2. FR status: `state/implementation-status.md`
3. Domain history:
  - `state/changelog/email-core.md`
  - `state/changelog/topic-intelligence.md`
  - `state/changelog/telegram.md`
  - `state/changelog/sandbox.md`
  - `state/changelog/infra-fixes.md`

## Practical Guides

1. Sandbox usage: `knowledge/sandbox-usage.md`
2. Database schema: `knowledge/database-schema.md`
3. Starter prompts: `STARTER_PROMPTS.md`

## Maintenance Rules

1. Keep `state/current-state.md` concise and current.
2. Put detailed timeline logs in `state/changelog/*`.
3. If endpoint contracts change, update both API contract docs in the same change-set.
4. Keep one backend AI adapter path at `apps/backend/src/modules/ai/ai.service.ts`.
