# Copilot Workspace Instructions

## Project

AI-Powered Email-Centric Communication Platform — monorepo with Email sync, Telegram multi-channel, AI summarization, smart replies, topic intelligence, and contact management.

## Canonical Knowledge Base

All project knowledge is centralized in `.ai/`. Read these files for context:

### Always Read
- `.ai/CONTEXT.md` — project identity, stack, context load order
- `.ai/skills/code-conventions.md` — naming, patterns, file structure (TypeScript + Python)
- `.ai/state/current-state.md` — current runtime snapshot and guardrails

### Read When Relevant
- `.ai/knowledge/project-overview.md` — stack, ports, Docker, request flow
- `.ai/knowledge/architecture.md` — FR mapping, app responsibilities, communication flow
- `.ai/knowledge/api-contracts-backend.md` — backend REST API contracts
- `.ai/knowledge/api-contracts-ai-service.md` — Python AI service API contracts
- `.ai/knowledge/database-schema.md` — MongoDB schemas
- `.ai/knowledge/ai-service.md` — AI service module structure, Gemini clients
- `.ai/skills/feature-patterns.md` — route templates, pagination, optimistic UI
- `.ai/skills/patterns/topic-focus-optimization.md` — topic/focus score patterns

### Roles
- `.ai/roles/developer.md` — developer coding persona and execution protocol
- `.ai/roles/thesis-writer.md` — academic writing persona for LaTeX thesis

### Thesis Context
- `.ai/thesis/chapter-status.md` — chapter progress
- `.ai/thesis/writing-conventions.md` — LaTeX/bkthesis.sty patterns
- `.ai/thesis/key-findings.md` — core arguments for consistency

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + TailwindCSS |
| Backend  | Next.js 16 API Routes + NextAuth v4 + Mongoose + Socket.IO + GramJS |
| AI       | FastAPI + Google Gemini (`gemini-2.0-flash`) |
| DB       | MongoDB 7 + Redis 7 |
| Deploy   | Docker Compose |

## Behavioral Rules

- **Language**: Vietnamese for chat; English for code identifiers and API routes
- **Scope control**: only change what is requested — no unrequested refactors
- **After code changes**: update `.ai/state/current-state.md` if behavior changed
- **Naming**: camelCase for variables/functions, PascalCase for components/types, UPPER_SNAKE for constants
- **Data fetching**: SWR for reads, axios for mutations
- **Styling**: TailwindCSS utilities, indigo as primary color
- **Components**: functional React only, hooks only, BEM className identifiers
