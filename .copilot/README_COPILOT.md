# AI-Powered Email-Centric Communication Platform

## Overview

You are GitHub Copilot, assisting in building a **communication management platform** centered around **Email**, with optional integration for **multi-channel messaging** (WhatsApp, Telegram, Viber, Zalo, etc.) through API-based extensions.

The system integrates, unifies, and summarizes communication data into a central timeline view for each customer/applicant, providing AI-powered summarization and auto-reply suggestions.

---

## Core Features

* Unified email management dashboard.
* Optional integration with external messaging APIs.
* Merged contact profiles and communication timeline.
* AI summarization and key-issue extraction.
* AI-assisted contextual reply suggestions.
* Modular architecture for rapid expansion.

---

## Tech Stack

| Layer         | Technology                               | Notes                                           |
| ------------- | ---------------------------------------- | ----------------------------------------------- |
| Frontend      | Next.js (React, TypeScript)              | Modern UI + API Routes support                  |
| Backend       | Next.js API Routes + Redis + MongoDB     | REST/Realtime data backend                      |
| AI Service    | Python (FastAPI)                         | Independent microservice, real-time capable     |
| Cache & Queue | Redis                                    | For caching summaries & async jobs              |
| Database      | MongoDB                                  | Simple NoSQL for unified contact & message data |
| Infra         | Docker Compose                           | Multi-service orchestration                     |
| OS/Env        | Ubuntu via WSL (Windows) / Ubuntu Laptop | Cross-device development                        |

---

## Architecture Summary

Monorepo structure with separate modules:

* `/apps/frontend` — Next.js web app
* `/apps/backend` — Next.js API backend
* `/apps/ai-service` — FastAPI AI microservice
* `/infra` — Docker, Redis, Mongo setup
* `/shared` — Common models and utilities
* `/copilot` — AI instructions and dev docs

---

## Goals for Copilot

1. Follow the conventions in `PROJECT_STRUCTURE.md` and `CODE_STYLE_GUIDE.md`.
2. Understand that **AI service is independent** and communicates via REST/WebSocket.
3. Suggest code respecting async and scalable patterns.
4. Always write modular and documented functions.
5. Assume Docker Compose is used for orchestration.
