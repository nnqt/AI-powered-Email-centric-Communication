# Developer Setup Checklist

This checklist ensures a minimal working environment to implement and
test FR-01/02/03/04/07/08 locally.

## Prerequisites

- **Node.js 20+**
- **Python 3.12+**
- **Docker & Docker Compose**
- Ability to run **MongoDB** (typically via Docker).

## Local Setup Steps

1. Clone the repository:

   ```bash
   git clone git@github.com:nnqt/AI-powered-Email-centric-Communication.git
   cd AI-powered-Email-centric-Communication
   ```

2. Install root dependencies:

   ```bash
   npm install
   ```

3. Create `.env` files for each service:

   - `/apps/backend/.env`
   - `/apps/ai-service/.env`

4. Set up the AI service Python environment:

   ```bash
   npm run dev:setup:ai
   ```

5. Start the database (MongoDB in Docker):

   ```bash
   npm run dev:db
   ```

6. Start all services in parallel:

   ```bash
   npm run start:all
   ```

   This runs Backend (4000), Frontend (3000), AI Service (5000), and MongoDB concurrently.

7. Verify services are running:

   ```bash
   curl http://localhost:4000/api/health
   curl http://localhost:5000/
   ```

## Environment Variables (Example)

Add these to `.env` files instead of hard-coding values in code.

**`apps/backend/.env`**:

```text
MONGODB_URI=mongodb://localhost:27017/emailhub
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:4000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
AI_SERVICE_URL=http://localhost:5000
```

**`apps/ai-service/.env`**:

```text
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL_NAME=gemini-1.5-flash
```

> **Note**: Use `gemini-1.5-flash` for faster responses or `gemini-2.0-flash` for the latest model.

## Redis Usage

- **Cache layer**: store recent summaries for threads.
- **Pub/Sub or queues**: broadcast timeline updates and/or offload
  heavier AI jobs.

## Quick Testing

- Use `curl` or `Postman` to test backend and AI endpoints.
- Test the AI service summarization endpoint:

  ```bash
  curl -X POST http://localhost:5000/summarize \
    -H "Content-Type: application/json" \
    -d '{
      "thread_id": "test-123",
      "messages": [
        {
          "id": "m1",
          "from": "user@example.com",
          "to": ["support@example.com"],
          "sent_at": "2025-01-01T10:00:00Z",
          "text": "I need help with my account."
        }
      ]
    }'
  ```

- Test the backend health endpoint:

  ```bash
  curl http://localhost:4000/api/health
  ```

- Check Docker logs if MongoDB fails to start:

  ```bash
  npm run logs:infra
  ```

## Deployment Note

Keep Docker Compose simple for the PoC. Future deployment can move to
managed services (e.g. AWS ECS/EC2) without changing the basic
container boundaries.
