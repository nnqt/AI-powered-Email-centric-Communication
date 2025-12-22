# Thesis Context & Memory for AI Assistant

**⚠️ IMPORTANT**: The original thesis report is written in **Vietnamese**. When assisting with this project, AI assistants MUST continue writing in Vietnamese to maintain consistency.

**Last Updated**: December 22, 2025  
**Repository**: AI-powered-Email-centric-Communication  
**Document Type**: Undergraduate Thesis (Đồ án tốt nghiệp)  
**Institution**: HCMUT (Trường ĐH Bách Khoa TP.HCM)

---

## Project Summary

**Title**: AI-Powered Email-Centric Communication Platform (Vietnamese: Nền tảng Quản lý Trao đổi Tập trung với Email là lõi, tăng cường bởi AI)

**Core Problem**: Modern organizations face severe data fragmentation across multiple communication channels (Email, Zalo, WhatsApp, Telegram). Email is still the formal channel but instant messaging is increasingly used, causing context loss and inefficiency.

**Solution**: Build an Email-centric platform that:

- Centralizes email communication as the backbone
- Uses AI (LLMs) to summarize threads and suggest smart replies
- Designed with modular architecture to support future multi-channel integration
- Targets small-medium teams initially

**Approach**: Design a full system architecture, then implement a Proof of Concept (PoC) demonstrating core features (email sync, inbox/timeline view, AI summarization).

---

## Thesis Structure & Chapter Status

### Chapter 1: Title Page (1-Title.tex)

- Standard HCMUT thesis cover page format
- Table of contents

### Chapter 2: Overview (2-Overview.tex) ✅ COMPLETE

**Status**: Fully written

**Key Sections**:

1. **Đặt vấn đề (Problem Statement)**:

   - Data fragmentation across email and IM apps
   - Information overload with long email threads
   - Difficulty tracking conversation context

2. **Nghiên cứu giải pháp hiện có (Existing Solutions Analysis)**:

   - Group 1: Email-centric apps (Superhuman, Front, Missive) - Good email UX but limited multi-channel
   - Group 2: Multi-channel CRMs (Zendesk, HubSpot, Intercom) - Comprehensive but expensive and heavy
   - Group 3: Open-source solutions (Chatwoot, Mautic) - Flexible but require significant setup effort

3. **Gap identified**: Need a solution that is Email-centric + AI-enhanced + modular architecture + suitable for small teams

### Chapter 3: Requirement Analysis (3-RequirementAnalysis.tex) ✅ COMPLETE

**Status**: Fully written with updated FR numbering

**Functional Requirements (FR)**:

| FR Code | Name (Vietnamese)                      | Name (English)                               | Status in PoC                 |
| ------- | -------------------------------------- | -------------------------------------------- | ----------------------------- |
| FR-01   | Đồng bộ Email gần thời gian thực       | Near real-time Email sync                    | ✅ Partially (manual trigger) |
| FR-02   | Soạn thảo và gửi Email trực tiếp       | Compose & Send Email                         | ❌ Design only                |
| FR-03   | Quản lý trạng thái Email               | Email state management (read/archive/labels) | ❌ Design only                |
| FR-04   | Hiển thị Inbox và Timeline theo Thread | Inbox & Thread Timeline View                 | ✅ Fully implemented          |
| FR-05   | Cập nhật giao diện tức thời            | Real-time UI update                          | ❌ Design only                |
| FR-06   | Tự động tạo & hợp nhất Contact (AI)    | Auto-create & unify Contact (AI)             | ❌ Design only                |
| FR-07   | Tóm tắt luồng trao đổi (AI)            | Thread Summarization (AI)                    | ✅ Fully implemented          |
| FR-08   | Gợi ý phản hồi thông minh              | Smart Reply Suggestion                       | ❌ Design only                |
| FR-09   | Kiến trúc mở rộng đa kênh              | Multi-channel adapter architecture           | ❌ Design only                |

**Non-Functional Requirements (NFR)**:

- Performance: Email sync latency < 5s (target), async AI processing
- Security: OAuth tokens in env vars, no hardcoded secrets
- Scalability: Containerized services, stateless design for horizontal scaling

**Technology Decisions**:

- Backend: Next.js API Routes (Node.js, TypeScript)
- Frontend: Next.js (React, TypeScript, TailwindCSS)
- AI Service: FastAPI (Python)
- Database: MongoDB (semi-structured data)
- Cache/Queue: Redis
- AI Provider: Google Gemini API (chosen for cost-effectiveness)

### Chapter 4: Cơ sở công nghệ và lựa chọn Tech stack (4-AIAndLLM.tex) ✅ COMPLETE

**Status**: Đã viết hoàn chỉnh và tái cấu trúc theo hướng “Tech stack & rationale”, đồng thời vẫn giữ phần AI/LLM để flow đọc hợp lý.

**Key Topics**:

1. **Cơ sở công nghệ và lựa chọn Tech stack**:

- Frontend/Backend orchestration/Database/Redis/Infrastructure
- Mỗi công nghệ có phần giới thiệu (giả định người đọc chưa biết) + **bảng so sánh** theo tiêu chí

2. **AI & LLM (giữ nội dung)**:

- Local vs Cloud AI (bảng so sánh)
- Các phương pháp tiếp cận LLM: Prompt Engineering, Fine-tuning/LoRA, RAG
- Mapping AI với FR-06/FR-07/FR-08

### Chapter 5: System Design (5-SystemDesign.tex) ✅ COMPLETE

**Status**: Fully written with diagrams (user-provided)

**Structure**:

1. **Overall Architecture Diagram** (Fig 5.1):

   - Shows **production-level design** (not just PoC):
     - Load Balancer / Reverse Proxy (Nginx)
     - Frontend Cluster (Next.js)
     - Backend Cluster (Next.js API)
     - AI Worker Cluster (FastAPI)
     - Data Layer: Redis (shared cache + queue) + MongoDB
   - External services: Gmail API, Google Gemini API

2. **Use Case Diagram** (Fig 5.2):

   - Actors: User, Gmail API, Google Gemini API, IM Apps (future)
   - Use cases: UC01-Sync Email, UC02-View Inbox, UC03-View Thread Detail, UC04-Summarize Thread, UC05-Smart Reply, UC06-Compose Email, UC07-Send Email, UC09-IM Integration

3. **Sequence Diagrams**:

   - **FR-01 Sequence** (Fig 5.3): Shows **ideal design** with Gmail webhook → Backend → Redis Pub/Sub → Frontend WebSocket
     - Note: PoC implements manual sync instead
   - **FR-04 Sequence** (Fig 5.4): Client-side data fetching (frontend gọi API để lấy threads/thread detail)
     - Phase 1: Initial load (App Shell)
     - Phase 2: Data fetching (GET /api/threads)
   - **FR-07 Sequence** (Fig 5.5): **Async design** with Redis Queue

     - Phase 1: Dispatch (Backend → Redis Queue → 202 Accepted)
     - Phase 2: Processing (AI Worker → Gemini → MongoDB)
     - Phase 3: Notification (Redis Pub/Sub → Frontend)

   - **FR-02/FR-03/FR-05/FR-06/FR-08**: Đã bổ sung mục mô tả luồng + placeholder hình (PNG sẽ chèn sau) trong Chapter 5.
     - Expected PNG names:
       - `Images/sequence_diagram_fr2.png`
       - `Images/sequence_diagram_fr3.png`
       - `Images/sequence_diagram_fr5.png`
       - `Images/sequence_diagram_fr6.png`
       - `Images/sequence_diagram_fr8.png`
     - Mermaid sources (để export PNG): `report/Diagrams/sequence/sequence_fr02.mmd`, `sequence_fr03.mmd`, `sequence_fr05.mmd`, `sequence_fr06.mmd`, `sequence_fr08.mmd`

4. **Database Design (ERD)** (Fig 5.6):

   - **User** collection: auth info + OAuth tokens
   - **Thread** collection: thread metadata + **embedded Summary** (for read performance)
   - **Message** collection: **referenced** from Thread (to avoid 16MB document limit)
   - Strategy: Embedding for Summary, Referencing for Messages

5. **Database Field-level Tables**:

- Đã bổ sung các bảng mô tả field-level cho `User`, `Thread`, `Message` (bám sát Mongoose schema trong PoC)
- Mermaid ERD đầy đủ field cũng được lưu tại `report/Diagrams/sequence/erd_full.mmd`

**Important Note**: Chapter 5 describes the **ideal production architecture**. The PoC (Chapter 6) implements a simplified version.

### Chapter 6: Implementation & Testing (6-ImplementAndTesting.tex) ✅ COMPLETE

**Status**: Fully written, focused on PoC reality

**Structure**:

1. **6.1 Environment & Running PoC**:

   - Monorepo structure:

     - `apps/frontend` (Next.js, port 3000)
     - `apps/backend` (Next.js API, port 4000)
     - `apps/ai-service` (FastAPI, port 5000)
     - `infra` (Docker Compose for MongoDB, Redis)

   - Tech Stack:

     - Frontend: Next.js, React, TypeScript, TailwindCSS, SWR
     - Backend: Next.js API, NextAuth, TypeScript, Mongoose
     - AI Service: FastAPI, Google Generative AI SDK
     - Database: MongoDB 7.x
     - Cache: Redis

   - Environment Variables:

     - `apps/backend/.env`: MONGODB_URI, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, AI_SERVICE_URL
     - `apps/ai-service/.env`: GEMINI_API_KEY, GEMINI_MODEL_NAME

   - Startup Process:

     ```bash
     npm install                # Install Node.js dependencies
     npm run dev:setup:ai       # Setup Python venv for AI service
     npm run dev:db             # Start MongoDB + Redis via Docker
     npm run start:all          # Start all services concurrently
     ```

   - Health checks:
     - Backend: http://localhost:4000/api/health
     - AI Service: http://localhost:5000/
     - Frontend: http://localhost:3000

2. **6.5 Summary of Implemented Features** (Table 6.1):
   - Comprehensive table showing all FRs with implementation status
   - Clear distinction between "Đã hiện thực" / "Đã hiện thực một phần" / "Chưa hiện thực"

**Key Implementation Highlights**:

- **FR-01 (Email Sync)**:
  - PoC: Manual trigger via Sync button
  - Design: Webhook + Pub/Sub (not implemented due to time/cost)
- **FR-04 (Inbox/Timeline)**:

  - Fully implemented: ThreadList, ThreadDetail pages
  - Uses SWR for data fetching
  - No real-time updates (need manual refresh)

- **FR-07 (AI Summarization)**:
  - Fully implemented end-to-end
  - Flow: User clicks "Summarize" → Backend calls AI Service → Gemini generates summary → Saved to MongoDB → Displayed in AISummaryCard component
  - PoC: Synchronous call (user waits)
  - Design: Async with Redis Queue (not implemented)

### Chapter 7: Tổng kết (7-Conclusion.tex) ✅ COMPLETE

**Status**: Đã viết hoàn chỉnh theo kịch bản GD1 (plan vs actual) và kế hoạch GD2 (14 tuần).

**Key Topics**:

- Tổng kết GD1: scope ban đầu lớn; implement dự kiến 30\% (~4 tuần, làm tròn xuống) nhưng thực tế còn 10\% (~1 tuần)
- Kế hoạch GD2: multi-channel, phân bổ 50\% hoàn tất FR-01..FR-09 và 50\% cho future features + user testing + báo cáo tổng kết
- Có mục **Risks giai đoạn 2**
- Gantt chart được chèn dưới dạng PNG; Mermaid sources lưu tại `report/Diagrams/gantt/`

---

## Detailed FR Status Table

| FR    | Vietnamese Name                  | English Name                | Design                                  | PoC Status                    | Key Components                                                                                                | Notes                                            |
| ----- | -------------------------------- | --------------------------- | --------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| FR-01 | Đồng bộ Email gần thời gian thực | Near real-time Email sync   | Webhook + Pub/Sub                       | Manual trigger via button     | `GmailService`, `POST /api/emails/sync`                                                                       | Design: webhook. PoC: manual to save tokens/time |
| FR-02 | Soạn thảo và gửi Email           | Compose & Send Email        | Rich text editor + Gmail API send       | Not implemented               | N/A                                                                                                           | Design only                                      |
| FR-03 | Quản lý trạng thái Email         | Email state management      | Two-way sync with Gmail                 | Not implemented               | N/A                                                                                                           | Design only, users use Gmail directly            |
| FR-04 | Hiển thị Inbox và Timeline       | Inbox & Thread Timeline     | Client-side fetching with SWR           | ✅ Fully implemented          | `TimelineService`, `GET /api/threads`, `GET /api/threads/[id]`, `ThreadList`, `useThreads`, `useThreadDetail` | Core PoC feature                                 |
| FR-05 | Cập nhật giao diện tức thời      | Real-time UI update         | WebSocket + Redis Pub/Sub               | Not implemented               | N/A                                                                                                           | Architecture ready, not implemented in PoC       |
| FR-06 | Tự động tạo & hợp nhất Contact   | Auto-create & unify Contact | AI analysis + user approval             | Not implemented               | N/A                                                                                                           | Design only                                      |
| FR-07 | Tóm tắt luồng trao đổi           | Thread Summarization        | Async queue with AI workers             | ✅ Implemented (sync version) | `POST /api/threads/[id]/summarize`, AI Service `/summarize`, `GeminiSummarizationClient`, `AISummaryCard`     | PoC: sync call. Design: async queue              |
| FR-08 | Gợi ý phản hồi thông minh        | Smart Reply Suggestion      | AI context + prompt engineering         | Not implemented               | Stub exists in AI service                                                                                     | Design only, FR-07 prioritized                   |
| FR-09 | Kiến trúc mở rộng đa kênh        | Multi-channel adapter       | Abstract Message/Conversation interface | Not implemented               | N/A                                                                                                           | Architecture pattern defined                     |

---

## Technology Stack Details

### Frontend (apps/frontend)

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI**: React 18+, TailwindCSS
- **Data Fetching**: SWR (stale-while-revalidate)
- **HTTP Client**: Axios (via `apiClient`)
- **Auth**: NextAuth v4 (client session)

**Key Files**:

- `src/app/page.tsx`: Home/Inbox page
- `src/app/threads/[id]/page.tsx`: Thread detail page
- `src/features/inbox/ThreadList.tsx`: Inbox list component
- `src/components/AISummaryCard.tsx`: AI summary display
- `src/components/SyncButton.tsx`: Manual sync trigger
- `src/hooks/useThreads.ts`: SWR hook for thread list
- `src/hooks/useThreadDetail.ts`: SWR hook for thread detail
- `src/lib/api.ts`: Axios client config

### Backend (apps/backend)

- **Framework**: Next.js 14+ API Routes
- **Language**: TypeScript
- **Auth**: NextAuth v4 with Google Provider
- **Database**: MongoDB via Mongoose
- **Cache**: Redis (ioredis)
- **Gmail Integration**: googleapis package

**Key Files**:

- `src/app/api/auth/[...nextauth]/route.ts`: NextAuth config
- `src/app/api/emails/sync/route.ts`: Email sync endpoint
- `src/app/api/threads/route.ts`: Thread list endpoint
- `src/app/api/threads/[threadId]/route.ts`: Thread detail endpoint
- `src/app/api/threads/[threadId]/summarize/route.ts`: Summarization endpoint
- `src/modules/email/gmail.service.ts`: Gmail API integration
- `src/modules/timeline/timeline.service.ts`: Thread query logic
- `src/modules/ai/ai.service.ts`: AI Service HTTP client
- `src/models/User.ts`: User Mongoose schema
- `src/models/Thread.ts`: Thread Mongoose schema (with embedded summary)
- `src/models/Message.ts`: Message Mongoose schema

### AI Service (apps/ai-service)

- **Framework**: FastAPI
- **Language**: Python 3.12+
- **LLM**: Google Gemini via `google-generativeai`
- **Config**: python-dotenv for env vars

**Key Files**:

- `main.py`: FastAPI app entry point
- `routes/summarize.py`: POST /summarize endpoint
- `routes/reply.py`: POST /suggest-reply endpoint (stub)
- `services/summarizer.py`: Summarization business logic
- `services/smart_reply.py`: Smart reply logic (stub)
- `models/summarize.py`: Pydantic request/response models
- `core/config.py`: Environment config
- `core/llm_client.py`: `GeminiSummarizationClient` class

### Infrastructure (infra)

- **Orchestration**: Docker Compose
- **Services**:
  - MongoDB: port 27017
  - Redis: port 6379

---

## Architecture Decisions & Rationale

### 1. Why Email-Centric?

- Email remains the formal, legally-binding communication channel
- Most business processes start with email (job applications, quotes, contracts)
- Email has structured data (subject, thread, participants) suitable for AI processing

### 2. Why Monorepo?

- Easier to share types between Frontend/Backend (TypeScript)
- Single source of truth for configs
- Simpler development workflow for small team

### 3. Why Next.js for Backend?

- TypeScript sharing with Frontend
- Built-in API routes
- Event-driven Node.js suits I/O-bound tasks (Gmail API, DB, AI calls)
- Faster PoC development than Java/Go

### 4. Why MongoDB?

- Email data is semi-structured (varied headers, HTML/text bodies)
- Schema flexibility during exploration phase
- Easy to embed AI results (summary object) in Thread document

### 5. Why Google Gemini over OpenAI?

- **Cost**: Gemini offers more competitive pricing for personal/student use
- **Performance**: `gemini-1.5-flash` provides fast responses suitable for real-time feel
- **API Availability**: Free tier accessible during development
- Architecture designed to be LLM-agnostic (can swap to OpenAI or local models)

### 6. Why Manual Sync in PoC vs Webhook in Design?

- **Design Intent**: Webhook + Pub/Sub for near real-time (< 5s latency)
- **PoC Reality**: Manual trigger to:
  - Save Gmail API quota
  - Avoid complexity of webhook setup & ngrok tunneling
  - Focus development time on core features (FR-04, FR-07)

### 7. Why Sync AI Call in PoC vs Async Queue in Design?

- **Design Intent**: Redis queue + worker pool for:
  - Non-blocking UX (202 Accepted response)
  - Better resource utilization
  - Rate limiting tolerance
- **PoC Reality**: Direct sync call to:
  - Simplify implementation (no queue management)
  - Acceptable for demo with small thread count
  - User sees loading state (acceptable UX for PoC)

### 8. Why Embed Summary but Reference Messages?

- **Summary**: Small, frequently accessed with Thread → embed for read performance
- **Messages**: Can grow large (HTML emails, attachments) → reference to avoid 16MB document limit

---

## Design vs PoC Reality Mapping

| Aspect             | Ideal Design (Chapter 5)                                             | PoC Implementation (Chapter 6)                                       | Reason for Gap                             |
| ------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Email Sync         | Gmail Webhook → Backend → Redis Pub/Sub → Frontend WebSocket         | Manual button → Backend polls Gmail API → MongoDB → Frontend refresh | Save API quota, simpler setup              |
| Real-time Updates  | WebSocket connection with Redis Pub/Sub                              | Manual page refresh or re-fetch                                      | Time constraint, focus on core features    |
| AI Processing      | Async: Backend → Redis Queue → AI Worker → MongoDB → Notify Frontend | Sync: Backend → AI Service (direct call) → MongoDB → Response        | Simpler implementation for PoC             |
| Smart Reply        | AI generates 2-3 options → User edits → Send                         | Not implemented                                                      | Time constraint, prioritized Summarization |
| Multi-channel      | Abstract adapter pattern for Zalo/WhatsApp/Telegram                  | Not implemented                                                      | Out of PoC scope                           |
| Contact Management | AI-assisted enrichment & unification                                 | Not implemented                                                      | Out of PoC scope                           |
| Email Operations   | Send/Archive/Label with two-way Gmail sync                           | Not implemented                                                      | Out of PoC scope                           |

---

## Known Limitations & Issues

### PoC Limitations:

1. **No Real-time Updates**: Users must refresh or re-navigate to see new data
2. **Manual Sync**: Email synchronization requires user action
3. **Sync AI Call**: Summarization blocks request thread, poor UX for long threads
4. **No Queue Management**: Risk of hitting Gemini rate limits with concurrent requests
5. **Limited Gmail Sync**: Only pulls recent 10 threads, no incremental sync via historyId
6. **No Error Handling for AI Failures**: If Gemini fails, user sees generic error
7. **No Retry Logic**: Failed API calls are not retried
8. **Single User Testing**: Not tested with multiple concurrent users
9. **No Pagination**: Thread list and messages are not paginated
10. **No Search Functionality**: Cannot search within emails or threads

### Design Limitations:

1. **Email-only in PoC**: Multi-channel integration architecture designed but not tested
2. **Cloud AI Dependency**: Relies on Google Gemini availability and pricing
3. **No RAG Implementation**: Prompt engineering only, no retrieval-augmented generation
4. **No Fine-tuning**: Uses base Gemini model without domain-specific training

---

## Next Steps (Current)

1. Export Mermaid diagrams (sequence + gantt) → PNG và đặt đúng tên trong `report/Images/`.
2. Chạy LaTeX compile để kiểm tra thiếu hình/tham chiếu (nếu cần).

---

## LaTeX File Structure

```
report/
├── main.tex                              # Main document, includes all sections
├── hcmut.sty                            # HCMUT thesis style package
├── THESIS_CONTEXT.md                    # This file
├── Sections/
│   ├── 1-Title.tex                      # ✅ Title page + TOC
│   ├── 2-Overview.tex                   # ✅ Problem statement, existing solutions
│   ├── 3-RequirementAnalysis.tex        # ✅ FR/NFR, tech decisions
│   ├── 4-AIAndLLM.tex                   # ✅ AI context, Local vs Cloud, approaches
│   ├── 5-SystemDesign.tex               # ✅ Architecture, use cases, sequences, ERD
│   ├── 6-ImplementAndTesting.tex        # ✅ Environment, PoC summary
│   └── 7-Conclusion.tex                 # ✅ Tổng kết + kế hoạch GD2 (Gantt PNG placeholders)
├── Diagrams/
│   ├── gantt/                           # Mermaid sources for Gantt
│   │   ├── gd1_planned_w1_7.mmd
│   │   ├── gd1_planned_w8_14.mmd
│   │   ├── gd1_actual_w1_7.mmd
│   │   ├── gd1_actual_w8_14.mmd
│   │   ├── gd2_plan_w1_7.mmd
│   │   └── gd2_plan_w8_14.mmd
│   └── sequence/                        # Mermaid sources for sequence + ERD
│       ├── sequence_fr02.mmd
│       ├── sequence_fr03.mmd
│       ├── sequence_fr05.mmd
│       ├── sequence_fr06.mmd
│       ├── sequence_fr08.mmd
│       └── erd_full.mmd
└── Images/
    ├── bachkhoa_logo.png
    ├── architechture_diagram.png        # Overall architecture (user-provided)
    ├── use_case_diagram.png             # Use case diagram (user-provided)
    ├── sequence_diagram_fr1.png         # FR-01 sequence (user-provided)
    ├── sequence_diagram_fr4.png         # FR-04 sequence (user-provided)
    ├── sequence_diagram_fr7.png         # FR-07 sequence (user-provided)
    └── erd_diagram.png                  # Database ERD (user-provided)

    # Expected (to be exported/added)
    # ├── sequence_diagram_fr2.png
    # ├── sequence_diagram_fr3.png
    # ├── sequence_diagram_fr5.png
    # ├── sequence_diagram_fr6.png
    # ├── sequence_diagram_fr8.png
    # ├── gantt_gd1_planned_w1_7.png
    # ├── gantt_gd1_planned_w8_14.png
    # ├── gantt_gd1_actual_w1_7.png
    # ├── gantt_gd1_actual_w8_14.png
    # ├── gantt_gd2_plan_w1_7.png
    # └── gantt_gd2_plan_w8_14.png
```

**Compilation Command**:

```bash
cd report
pdflatex main.tex
# Run twice for TOC and references
pdflatex main.tex
```

---

## Important Notes for AI Assistant

### Language Rules:

1. **Primary Language**: Vietnamese
2. **Technical Terms**: Keep in English (FR-01, Backend, MongoDB, Thread, WebSocket, etc.)
3. **Code/Commands**: Always in English
4. **LaTeX Labels**: Use English (e.g., `\label{sec:ThietKe}` is acceptable)

### Writing Style:

- **Academic but accessible**: Suitable for undergraduate thesis
- **Structured**: Use bullet points, tables, diagrams extensively
- **Evidence-based**: Reference design decisions to requirements
- **Honest about gaps**: Clearly distinguish "design intent" vs "PoC reality"

### When Editing Thesis:

1. Always read existing sections first to match tone and structure
2. Maintain consistency with established terminology
3. Update THESIS_CONTEXT.md if major changes are made
4. Use `\ref{}` for cross-references between chapters
5. Keep figure captions bilingual when possible (Vietnamese primary, English in parentheses)

### Code References:

- When mentioning code files, use relative paths from repo root
- Use `\texttt{}` for code elements in LaTeX
- Don't dump code into thesis; describe architecture and flow instead

### Diagram Requirements:

- All diagrams are user-provided (PNG files in Images/)
- Use `\includegraphics` with appropriate width
- Always include `\caption{}` and `\label{}`
- Reference diagrams in text using `Hình~\ref{fig:xxx}`

---

## Quick Reference Commands

### For Next Session:

**To understand current state:**

```bash
# Read this file first
cat report/THESIS_CONTEXT.md

# Check chapter status
ls -la report/Sections/*.tex

# View specific chapter
cat report/Sections/7-Conclusion.tex
```

**To continue work:**

```bash
# Compile PDF
cd report && pdflatex main.tex

# View FR status
grep "FR-0" report/THESIS_CONTEXT.md

# Check TODO items
grep -r "TODO" report/Sections/
```

---

## Glossary

| Vietnamese                | English                        | Abbreviation |
| ------------------------- | ------------------------------ | ------------ |
| Yêu cầu chức năng         | Functional Requirements        | FR           |
| Yêu cầu phi chức năng     | Non-Functional Requirements    | NFR          |
| Bản mẫu                   | Proof of Concept               | PoC          |
| Đồng bộ                   | Synchronization                | Sync         |
| Luồng trao đổi            | Thread / Conversation          | -            |
| Tóm tắt                   | Summarization                  | -            |
| Gợi ý phản hồi            | Reply Suggestion               | -            |
| Hộp thư đến               | Inbox                          | -            |
| Dòng thời gian            | Timeline                       | -            |
| Mô hình ngôn ngữ lớn      | Large Language Model           | LLM          |
| Kỹ thuật prompt           | Prompt Engineering             | -            |
| Tinh chỉnh mô hình        | Fine-tuning                    | -            |
| Sinh tăng cường truy xuất | Retrieval-Augmented Generation | RAG          |
| Tác nhân AI               | AI Agent                       | -            |

---

## Change Log

| Date         | Section | Change                                                              | Author Context                                 |
| ------------ | ------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| Dec 8, 2025  | Chap 3  | Restructured FRs, merged FR-05/06 → FR-06, added FR-04 for Timeline | After reviewing PoC status                     |
| Dec 8, 2025  | Chap 4  | Updated OpenAI references to Gemini                                 | Reflecting actual PoC implementation           |
| Dec 8, 2025  | Chap 5  | Rewrote to focus on diagrams, less code detail                      | User feedback: diagram-centric                 |
| Dec 9, 2025  | Chap 5  | User manually edited and added actual diagrams                      | User provided architecture/sequence/ERD images |
| Dec 9, 2025  | Chap 6  | Rewrote to focus on environment + FR summary table                  | User feedback: less code, more overview        |
| Dec 19, 2025 | -       | Created THESIS_CONTEXT.md                                           | For AI assistant context preservation          |

---

**END OF CONTEXT FILE**

_This file should be updated whenever significant changes are made to the thesis structure, content, or project direction._
