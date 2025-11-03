# Developer Setup Checklist

## Prerequisites

* **GitHub SSH key** configured on both laptops.
* **Node.js 24+**
* **Python 3.10+**
* **Docker & Docker Compose**
* **Redis & MongoDB** (via Docker containers)
* **WSL2 (Ubuntu)** for Windows environment.

---

## Local Setup Steps

1. Clone the repository:

   ```bash
   git clone git@github.com:nnqt/AI-powered-Email-centric-Communication.git
   cd AI-powered-Email-centric-Communication
   ```

2. Create `.env` files for each service:

   * `/apps/backend/.env`
   * `/apps/ai-service/.env`
   * `/infra/.env`

3. Start all services with Docker Compose:

   ```bash
   docker compose up -d
   ```

4. Verify containers:

   ```bash
   docker ps
   ```

---

## Environment Variables (example)

```
# Common
MONGO_URI=mongodb://mongo:27017/emailhub
REDIS_URL=redis://redis:6379

# Backend
PORT=4000
AI_SERVICE_URL=http://ai-service:5000

# AI-Service
OPENAI_API_KEY=sk-...
```

---

## Redis Usage

* **Cache Layer:** store summaries, recent contacts.
* **Pub/Sub Queue:** push updates to frontend WebSocket events.

---

## Testing

* Use `curl` or `Postman` to test API routes.
* For local AI simulation, hit `http://localhost:5000/summarize`.
* Check Docker logs if AI service fails to start.

---

## Deployment Note

Keep Docker Compose lightweight for demo.
Future deployment can migrate to AWS ECS or EC2.
