---
description: Start the project using Docker Compose in infra folder
---

Run this workflow to start the frontend, backend, AI service, MongoDB, and Redis.

// turbo-all
```bash
cd infra && docker compose build --no-cache && docker compose up -d
```
