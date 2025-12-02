# Developer Setup Checklist

This checklist ensures a minimal working environment to implement and
test FR-01/02/03/04/07/08 locally.

## Prerequisites

- **Node.js 20+**
- **Python 3.10+**
- **Docker & Docker Compose**
- Ability to run **Redis** and **MongoDB** (typically via Docker).

## Local Setup Steps

1. Clone the repository:

   ```bash
   git clone git@github.com:nnqt/AI-powered-Email-centric-Communication.git
   cd AI-powered-Email-centric-Communication
   ```

2. Create `.env` files for each service (basic example):

   - `/apps/backend/.env`
   - `/apps/ai-service/.env`
   - `/infra/.env` (if needed)

3. Start infrastructure services with Docker Compose:

   ```bash
   docker compose up -d mongo redis
   ```

4. (Optional) Start backend, frontend, and AI service via Docker or
   directly with `npm`/`uvicorn` depending on the current stage of the
   project.

5. Verify containers:

   ```bash
   docker ps
   ```

## Environment Variables (Example)

Back these examples into `.env` files instead of hard-coding values in
code.

```text
# Common
MONGO_URI=mongodb://mongo:27017/emailhub
REDIS_URL=redis://redis:6379

# Backend
PORT=4000
AI_SERVICE_URL=http://ai-service:5000

# AI Service
OPENAI_API_KEY=sk-...
OPENAI_MODEL_NAME=gpt-4.1-mini
```

## Redis Usage

- **Cache layer**: store recent summaries for threads.
- **Pub/Sub or queues**: broadcast timeline updates and/or offload
  heavier AI jobs.

## Quick Testing

- Use `curl` or `Postman` to test backend and AI endpoints once they
  are implemented.
- For AI service, start a dev server (e.g. `uvicorn
main:app --reload`) and call:

  ```bash
  curl -X POST http://localhost:5000/summarize -H "Content-Type: application/json" -d '{"thread_id":"test","messages":[]}'
  ```

- Check Docker logs if MongoDB or Redis fail to start.

## Deployment Note

Keep Docker Compose simple for the PoC. Future deployment can move to
managed services (e.g. AWS ECS/EC2) without changing the basic
container boundaries.
