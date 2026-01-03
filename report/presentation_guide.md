# PRESENTATION GENERATION GUIDE

# AI-Powered Email-Centric Communication Platform

**INSTRUCTIONS FOR AI SLIDE GENERATOR:**

You are generating a **20-minute presentation** for an undergraduate thesis defense (HCMUT - Vietnam). The audience is **mixed**: some technical evaluators, some focus on research process. Language: **Vietnamese primary, English for technical terms**.

**Key Requirements:**

1. **Balance**: 50% technical system design + 50% academic journey (timeline, challenges, lessons)
2. **Tone**: Academic but accessible, honest about gaps between design and PoC reality
3. **Visual Placeholders**: Use `[IMAGE: description]` where diagrams/screenshots are needed - the presenter will add them manually
4. **Demo Integration**: Include a transition slide for live demo (5-7 min reserved for demo during presentation)
5. **Slide Count**: Aim for 18-25 slides for 20 minutes (excluding Q&A)

**Context You Need to Know:**

- **Project**: Email-centric communication platform enhanced by AI (LLMs)
- **Problem**: Data fragmentation across Email + IM apps (Zalo, WhatsApp, Telegram) causing information overload
- **Solution**: Centralize email as backbone + AI summarization/smart replies + modular architecture for future multi-channel
- **Approach**: Design full system architecture, then implement a Proof of Concept (PoC) demonstrating core features
- **Key Gap**: Many features are "design-only" (ideal architecture) vs "PoC reality" (simplified implementation due to time/resource constraints)

**PoC Implementation Status:**

- ✅ Implemented: FR-01 (manual email sync), FR-04 (inbox/timeline view), FR-07 (AI summarization - synchronous)
- ❌ Design-only: FR-02 (compose/send), FR-03 (email state management), FR-05 (real-time updates), FR-06 (AI contact unification), FR-08 (smart reply), FR-09 (multi-channel architecture)

**Tech Stack:**

- Frontend: Next.js, React, TypeScript, TailwindCSS
- Backend: Next.js API Routes, NextAuth, Mongoose
- AI Service: FastAPI, Google Gemini API
- Database: MongoDB
- Cache: Redis

**Academic Timeline:**

- Phase 1 (GD1): 14 weeks - Planned 30% implementation (~4 weeks), Actual 10% (~1 week) due to extended literature review and design phase
- Phase 2 (GD2): 14 weeks planned - 50% completing FR-01 to FR-09, 50% future features + user testing + final report

---

# PRESENTATION STRUCTURE & CONTENT

## Slide 1: Title

**Title (Vietnamese)**: Nền tảng Quản lý Trao đổi Tập trung với Email là lõi, tăng cường bởi AI  
**Subtitle (English)**: AI-Powered Email-Centric Communication Platform

**Student**: [Your Name]  
**Advisor**: [Advisor Name]  
**Institution**: Trường Đại học Bách Khoa TP.HCM (HCMUT)  
**Date**: January 2026

---

## Slide 2: Agenda

**Nội dung trình bày (Presentation Outline)**

1. Bối cảnh & Vấn đề (Problem & Context)
2. Mục tiêu & Phạm vi (Objectives & Scope)
3. Giải pháp Đề xuất (Proposed Solution)
4. Kiến trúc Hệ thống (System Architecture)
5. Thiết kế vs Hiện thực (Design vs PoC Reality)
6. **Demo Trực tiếp** (Live Demo)
7. Quá trình Thực hiện (Timeline & Progress)
8. Kết quả & Hạn chế (Results & Limitations)
9. Kế hoạch Tương lai (Future Work - Phase 2)
10. Tổng kết (Conclusion)

---

## Slide 3: Bối cảnh - Phân mảnh Dữ liệu

**Tiêu đề**: Vấn đề Phân mảnh Dữ liệu trong Giao tiếp Doanh nghiệp  
**English Title**: Data Fragmentation in Business Communication

**Bullet Points**:

- 📧 Email: Kênh chính thức, pháp lý → nhưng thường bị "quá tải"
- 💬 Instant Messaging (Zalo, WhatsApp, Telegram): Nhanh, tiện → nhưng thiếu cấu trúc
- ⚠️ Hệ quả: Context bị mất, thông tin rời rạc, khó truy xuất
- 👥 Đối tượng hướng tới: Nhóm nhỏ và vừa (SMEs, startup teams)

**Visual Placeholder**:
`[IMAGE: Diagram showing fragmented communication channels - Email, Zalo, WhatsApp, Telegram icons scattered with question marks between them]`

---

## Slide 4: Nghiên cứu Giải pháp Hiện có

**Tiêu đề**: Các Hướng Tiếp cận Hiện tại  
**English Title**: Existing Solutions Analysis

**3 Groups (Table Format)**:

| Nhóm                   | Ví dụ                      | Ưu điểm               | Hạn chế                         |
| ---------------------- | -------------------------- | --------------------- | ------------------------------- |
| **Email-centric Apps** | Superhuman, Front, Missive | UX tốt cho email      | Hạn chế đa kênh                 |
| **Multi-channel CRMs** | Zendesk, HubSpot, Intercom | Toàn diện             | Đắt, phức tạp, overkill cho SME |
| **Open-source**        | Chatwoot, Mautic           | Linh hoạt, tự quản lý | Cần nhiều công sức setup        |

**Gap identified**: Cần giải pháp **Email-centric + AI-enhanced + Modular + Phù hợp SME**

---

## Slide 5: Mục tiêu Nghiên cứu

**Tiêu đề**: Mục tiêu & Phạm vi Đồ án  
**English Title**: Research Objectives & Scope

**Mục tiêu chính**:

1. 🎯 Thiết kế kiến trúc hệ thống Email-centric có khả năng mở rộng đa kênh
2. 🤖 Tích hợp AI (LLMs) để tóm tắt thread và gợi ý phản hồi
3. 🛠️ Xây dựng Proof of Concept (PoC) demo các tính năng lõi

**Phạm vi Đồ án**:

- **Giai đoạn 1 (GD1)**: Thiết kế + PoC với Email sync + AI Summarization + Inbox/Timeline view
- **Giai đoạn 2 (GD2)**: Hoàn thiện FR-01 đến FR-09 + Multi-channel + User testing (kế hoạch)

---

## Slide 6: Yêu cầu Chức năng - Tổng quan

**Tiêu đề**: Functional Requirements (FR)  
**Subtitle**: 9 FR - Trạng thái trong PoC

**Table Format**:

| FR    | Tên                                   | Status in PoC         |
| ----- | ------------------------------------- | --------------------- |
| FR-01 | Đồng bộ Email gần thời gian thực      | ✅ Partially (manual) |
| FR-02 | Soạn thảo và gửi Email                | ❌ Design only        |
| FR-03 | Quản lý trạng thái Email              | ❌ Design only        |
| FR-04 | Hiển thị Inbox & Timeline theo Thread | ✅ Fully implemented  |
| FR-05 | Cập nhật giao diện tức thời           | ❌ Design only        |
| FR-06 | Tự động tạo & hợp nhất Contact (AI)   | ❌ Design only        |
| FR-07 | Tóm tắt luồng trao đổi (AI)           | ✅ Fully implemented  |
| FR-08 | Gợi ý phản hồi thông minh (AI)        | ❌ Design only        |
| FR-09 | Kiến trúc mở rộng đa kênh             | ❌ Design only        |

**Note**: PoC tập trung vào 3 FR cốt lõi để chứng minh tính khả thi

---

## Slide 7: Giải pháp Đề xuất - Tổng quan

**Tiêu đề**: Email-Centric Platform với AI Enhancement  
**English Title**: Proposed Solution Overview

**4 Core Pillars**:

1. **📧 Email as Backbone**

   - Email là kênh chính thức, pháp lý → làm trung tâm
   - Dữ liệu có cấu trúc (subject, thread, participants)

2. **🤖 AI/LLM Integration**

   - Summarization: Tóm tắt thread dài
   - Smart Reply: Gợi ý phản hồi thông minh
   - Contact Unification (future): Hợp nhất contact từ nhiều nguồn

3. **🔌 Modular Architecture**

   - Thiết kế sẵn adapter pattern cho multi-channel (Zalo, WhatsApp, Telegram)
   - Microservices: Frontend / Backend / AI Service riêng biệt

4. **👥 Target SME Teams**
   - Dễ deploy, cost-effective
   - Self-hosted option (MongoDB + Redis)

---

## Slide 8: Tech Stack - Lựa chọn Công nghệ

**Tiêu đề**: Technology Stack & Rationale  
**Subtitle**: Lý do chọn từng công nghệ

**Comparison Table**:

| Layer            | Chosen             | Alternatives             | Why Chosen                                          |
| ---------------- | ------------------ | ------------------------ | --------------------------------------------------- |
| **Frontend**     | Next.js + React    | Vue.js, Angular          | TypeScript sharing với Backend, App Router tốt      |
| **Backend**      | Next.js API Routes | Express, NestJS, FastAPI | Share types, event-driven Node.js phù hợp I/O-bound |
| **AI Service**   | FastAPI + Python   | Flask, Spring Boot       | Ecosystem AI/ML mạnh, async native                  |
| **Database**     | MongoDB            | PostgreSQL, MySQL        | Schema linh hoạt cho semi-structured email data     |
| **Cache/Queue**  | Redis              | RabbitMQ, Kafka          | Đa năng: cache + queue + pub/sub                    |
| **LLM Provider** | Google Gemini      | OpenAI GPT, Local LLM    | Cost-effective, free tier, `gemini-1.5-flash` nhanh |

---

## Slide 9: Kiến trúc Hệ thống - Production Design

**Tiêu đề**: System Architecture - Ideal Design  
**English Title**: Production-Level Architecture (Design Intent)

**Visual Placeholder**:
`[IMAGE: Overall architecture diagram showing:

- Load Balancer / Reverse Proxy (Nginx)
- Frontend Cluster (Next.js)
- Backend Cluster (Next.js API)
- AI Worker Cluster (FastAPI)
- Data Layer: Redis (cache + queue + pub/sub) + MongoDB
- External: Gmail API, Google Gemini API, Future IM APIs]`

**Key Design Principles**:

- **Horizontal Scalability**: Stateless services, containerized
- **Async Processing**: Redis Queue cho AI tasks
- **Real-time Push**: Redis Pub/Sub + WebSocket
- **Separation of Concerns**: Microservices cho AI workload

---

## Slide 10: Database Design

**Tiêu đề**: Database Schema - MongoDB Collections  
**Subtitle**: Chiến lược Embedding vs Referencing

**Visual Placeholder**:
`[IMAGE: ERD diagram showing 3 collections:

- USER (email, googleId, accessToken, refreshToken, timestamps)
- THREAD (id, userId ref, historyId, snippet, lastMessageDate, embedded summary, timestamps)
- MESSAGE (id, threadId ref, userId ref, from, to[], subject, body, date, timestamps)
  Arrows showing: USER owns THREAD, THREAD contains MESSAGE refs, THREAD embeds SUMMARY]`

**Design Decision**:

- **Embed Summary in Thread**: Nhỏ, truy xuất thường xuyên → tối ưu read performance
- **Reference Messages**: Có thể lớn (HTML emails) → tránh giới hạn 16MB MongoDB document

---

## Slide 11: Sequence Diagram - FR-07 AI Summarization

**Tiêu đề**: AI Summarization Flow (Ideal Design)  
**English Title**: Async AI Processing with Queue

**Visual Placeholder**:
`[IMAGE: Sequence diagram showing:
Phase 1 - Dispatch: User → Frontend → Backend API → Redis Queue → Return 202 Accepted
Phase 2 - Processing: AI Worker dequeue → Fetch thread from DB → Call Gemini API → Save summary to MongoDB
Phase 3 - Notification: AI Worker → Redis Pub/Sub → Frontend WebSocket → Update UI
Note rectangles before each phase explaining purpose]`

**Design vs PoC Reality**:

- **Design**: 3-phase async (non-blocking UX)
- **PoC**: Synchronous call (user waits for AI response)
- **Reason**: Time constraint, PoC simplification

---

## Slide 12: Design vs PoC Reality - Key Gaps

**Tiêu đề**: Thiết kế Lý tưởng vs Thực tế PoC  
**English Title**: Design Intent vs PoC Implementation

**Comparison Table**:

| Aspect                | Ideal Design (Chapter 5)            | PoC Reality (Chapter 6) | Reason for Gap                |
| --------------------- | ----------------------------------- | ----------------------- | ----------------------------- |
| **Email Sync**        | Gmail Webhook → Pub/Sub → WebSocket | Manual button trigger   | Save API quota, simpler setup |
| **Real-time Updates** | WebSocket + Redis Pub/Sub           | Manual refresh          | Time constraint               |
| **AI Processing**     | Async Redis Queue → Workers         | Sync HTTP call          | Simpler implementation        |
| **Smart Reply**       | AI generates 2-3 options            | Not implemented         | Prioritized Summarization     |
| **Multi-channel**     | Adapter pattern for Zalo/WhatsApp   | Not implemented         | Out of PoC scope              |

**Honesty in Academic Work**: Phân biệt rõ "thiết kế" vs "hiện thực" để thể hiện tư duy kỹ thuật và quản lý phạm vi

---

## Slide 13: PoC Implementation - Tech Stack Actual

**Tiêu đề**: PoC Technology Stack (Thực tế đã dùng)  
**English Title**: Proof of Concept - Actual Technologies

**Monorepo Structure**:

```
apps/
├── frontend/      (Next.js, React, TypeScript, TailwindCSS, SWR)
├── backend/       (Next.js API, NextAuth, Mongoose)
├── ai-service/    (FastAPI, Google Generative AI SDK)
infra/
└── docker-compose.yml  (MongoDB 7.x, Redis)
```

**Key Components Implemented**:

- **Frontend**: ThreadList, ThreadDetail pages, AISummaryCard, SyncButton
- **Backend**: `/api/auth`, `/api/emails/sync`, `/api/threads`, `/api/threads/[id]/summarize`
- **AI Service**: `POST /summarize` endpoint with Gemini integration
- **Database**: User/Thread/Message schemas với embedded summary

**Startup**:

```bash
npm install && npm run dev:setup:ai
npm run dev:db        # Start MongoDB + Redis
npm run start:all     # Start all 3 services
```

---

## Slide 14: Demo Transition

**Tiêu đề**: Live Demo - PoC Walkthrough  
**English Title**: Proof of Concept Demonstration

**Demo Flow (5-7 minutes planned)**:

1. **Login**: NextAuth Google OAuth
2. **Manual Email Sync**: Click "Sync" button → Fetch from Gmail
3. **Inbox View (FR-04)**: ThreadList với snippet, lastMessageDate
4. **Thread Detail**: Click thread → Message timeline
5. **AI Summarization (FR-07)**: Click "Summarize" → Loading → Display summary card
   - Show: Key issues, Action required, Summary text

**Visual Placeholder**:
`[IMAGE: Screenshot of inbox page showing thread list with sync button highlighted]`

`[IMAGE: Screenshot of thread detail page with AI summary card displayed]`

**Note for Presenter**: Pause presentation, switch to live demo. After demo, return to slides for timeline & evaluation.

---

## Slide 15: Quá trình Thực hiện - Giai đoạn 1 (GD1)

**Tiêu đề**: Timeline Phase 1 - Kế hoạch vs Thực tế  
**English Title**: Phase 1 Execution - Planned vs Actual

**Visual Placeholder**:
`[IMAGE: Gantt chart comparison:

- Top half: GD1 Planned (14 weeks) - Literature review 30%, Requirement 10%, Design 20%, Implementation 30%, Testing 10%
- Bottom half: GD1 Actual (14 weeks) - Literature review 40%, Requirement 15%, Design 25%, Implementation 10%, Testing 0%
  Highlight the 30% → 10% implementation gap]`

**Key Statistics**:

- **Kế hoạch ban đầu**: 30% thời gian (~4 tuần) cho implementation
- **Thực tế**: 10% thời gian (~1 tuần) cho implementation
- **Lý do**: Literature review & design phase kéo dài do scope lớn, chưa quen tech stack mới

**Deliverables GD1**:

- ✅ Full system architecture design (production-level)
- ✅ PoC demonstrating 3 core FRs (FR-01, FR-04, FR-07)
- ✅ Technical report (LaTeX, 6 chapters)

---

## Slide 16: Bài học Rút ra - Phase 1

**Tiêu đề**: Lessons Learned & Challenges  
**Subtitle**: Những khó khăn và bài học từ GD1

**Challenges Encountered**:

1. **Scope Creep**: Thiết kế hệ thống production-level → phạm vi quá rộng cho PoC
2. **Tech Stack Learning Curve**: Next.js App Router, Mongoose, FastAPI đều mới → tốn thời gian học
3. **Gmail API Complexity**: OAuth2 flow, incremental sync với historyId phức tạp hơn dự kiến
4. **Trade-off Decisions**: Chọn manual sync thay vì webhook để tiết kiệm thời gian setup

**Lessons Learned**:
✅ **Quản lý phạm vi**: Phân biệt rõ "design intent" vs "PoC reality" từ đầu  
✅ **Prioritization**: Tập trung vào core features (FR-04, FR-07) thay vì làm đầy đủ  
✅ **Incremental Development**: Build theo vertical slice (end-to-end cho 1 feature) thay vì horizontal layers  
✅ **Documentation**: LaTeX report song song với coding → không bị quá tải cuối kỳ

---

## Slide 17: Đánh giá Kết quả - What Works

**Tiêu đề**: PoC Achievements & Validation  
**English Title**: Results - What Was Successfully Demonstrated

**Successful Implementations**:

| Feature                     | Status                  | Evidence                                         |
| --------------------------- | ----------------------- | ------------------------------------------------ |
| **FR-01**: Email Sync       | ✅ Manual trigger works | Fetches threads & messages from Gmail API        |
| **FR-04**: Inbox/Timeline   | ✅ Fully functional     | ThreadList + ThreadDetail pages với SWR          |
| **FR-07**: AI Summarization | ✅ End-to-end           | Gemini API → MongoDB → Display in UI             |
| **OAuth Authentication**    | ✅ Works                | NextAuth Google Provider                         |
| **Database Design**         | ✅ Validated            | Embed summary, reference messages strategy works |

**Technical Validation**:

- ✅ Monorepo structure phù hợp cho PoC
- ✅ TypeScript sharing giữa Frontend/Backend hiệu quả
- ✅ Google Gemini cost-effective cho student use (free tier đủ dùng)
- ✅ MongoDB schema linh hoạt phù hợp với semi-structured email data

---

## Slide 18: Hạn chế & Limitations

**Tiêu đề**: Known Limitations (Trung thực về hạn chế)  
**English Title**: PoC Limitations & Future Work Needed

**Technical Limitations**:

1. ❌ **No Real-time Updates**: User phải refresh để thấy data mới
2. ❌ **Synchronous AI Call**: User bị block khi chờ summarization (poor UX)
3. ❌ **Manual Sync**: Không tự động, phụ thuộc user trigger
4. ❌ **No Retry Logic**: Failed API calls không được retry
5. ❌ **Limited Gmail Sync**: Chỉ pull 10 threads gần nhất, chưa dùng incremental sync (historyId)
6. ❌ **No Error Handling**: AI failures hiển thị generic error

**Scope Limitations** (Design-only, not implemented):

- FR-02, FR-03, FR-05, FR-06, FR-08, FR-09 chỉ có design, chưa implement
- Multi-channel architecture chưa được test với IM APIs thực tế
- Chưa có user testing với real users

---

## Slide 19: Kế hoạch Tương lai - Giai đoạn 2 (GD2)

**Tiêu đề**: Phase 2 Plan - Multi-channel & Production-Ready  
**English Title**: Future Work - 14-week Phase 2 Roadmap

**Visual Placeholder**:
`[IMAGE: Gantt chart for GD2 (14 weeks):
Week 1-7: Complete FR-01 to FR-09 (50%) - Real-time updates, async AI queue, smart reply, compose/send
Week 8-14: Future features + Testing + Final report (50%) - Multi-channel (Zalo PoC), User testing, Performance optimization, Final thesis report]`

**50% - Complete Core FRs (Week 1-7)**:

- Implement FR-02, FR-03: Compose/send email, state management
- Implement FR-05: Real-time updates (WebSocket + Redis Pub/Sub)
- Implement FR-06: AI contact unification
- Implement FR-08: Smart reply with Gemini
- Refactor FR-07: Async queue-based AI processing

**50% - Multi-channel + Testing (Week 8-14)**:

- FR-09: Multi-channel adapter với Zalo PoC
- User testing với 5-10 small teams
- Performance testing & optimization
- Security audit
- Final thesis report completion

---

## Slide 20: Risks - Giai đoạn 2

**Tiêu đề**: Phase 2 Risks & Mitigation  
**English Title**: Identified Risks for Phase 2

**Risk Table**:

| Risk                     | Impact | Probability | Mitigation                                            |
| ------------------------ | ------ | ----------- | ----------------------------------------------------- |
| **Zalo API Access**      | High   | Medium      | Liên hệ sớm, backup plan: sử dụng mock data demo      |
| **User Recruitment**     | Medium | Medium      | Leverage university networks, offer incentives        |
| **Gemini Rate Limits**   | High   | High        | Implement queue + retry, consider paid tier           |
| **Time Constraint**      | High   | High        | Weekly sprint planning, cut scope nếu cần             |
| **WebSocket Complexity** | Medium | Medium      | Use proven libraries (Socket.io), incremental testing |

**Contingency Plan**:

- Nếu multi-channel không khả thi: Deep-dive vào Email features (advanced search, filters, labels)
- Nếu AI costs vượt ngân sách: Giới hạn quota per user, hoặc chuyển local LLM (Llama 2)

---

## Slide 21: Đóng góp của Đồ án

**Tiêu đề**: Research Contributions  
**English Title**: Key Contributions of This Work

**Academic Contributions**:

1. **System Design**: Kiến trúc Email-centric platform với modular multi-channel design
2. **AI Integration Pattern**: Thiết kế async AI processing workflow với queue + pub/sub
3. **Database Strategy**: Embedding vs Referencing trade-offs cho email data với AI results
4. **Honest PoC Methodology**: Phân biệt rõ "ideal design" vs "PoC reality" (valuable cho future students)

**Practical Contributions**:

1. **Working PoC**: Demonstrable Email + AI Summarization integration
2. **Open-source Potential**: Monorepo structure sẵn sàng cho community contributions
3. **Cost-effective AI**: Validation of Gemini API cho student/SME use cases
4. **Tech Stack Blueprint**: Next.js + FastAPI + MongoDB + Redis cho email platforms

---

## Slide 22: Kết luận

**Tiêu đề**: Tổng kết  
**English Title**: Conclusion

**Summary**:

- 📧 **Problem Addressed**: Data fragmentation in business communication → Email-centric solution
- 🎯 **Scope Achieved**: Full system design + PoC demonstrating 3 core FRs
- 🤖 **AI Validation**: Google Gemini successfully integrated for summarization
- 📊 **Honest Evaluation**: Clear documentation of Design Intent vs PoC Reality
- 🚀 **Future Ready**: Phase 2 plan for multi-channel + production features

**Key Takeaways**:

1. ✅ Email-centric approach vẫn relevant cho SMEs (formal + structured data)
2. ✅ AI/LLM democratization → cost-effective cho students/startups (Gemini free tier)
3. ✅ Modular architecture → scalable từ PoC → production
4. ✅ Scope management → critical skill cho đồ án (design vs implement trade-offs)

**Personal Growth**:

- Full-stack development (Next.js + FastAPI)
- System architecture design thinking
- Academic research & technical writing (LaTeX)
- Time management & prioritization under constraints

---

## Slide 23: Q&A

**Tiêu đề**: Câu hỏi & Thảo luận  
**English Title**: Questions & Discussion

**Prepared for Questions on**:

- Tech stack choices & alternatives
- Design decisions (why async in design but sync in PoC?)
- Scope management (why 30% → 10% implementation?)
- AI prompt engineering details
- Multi-channel architecture feasibility
- Performance & scalability considerations
- Security & privacy (OAuth token storage, data encryption)

**Thank You**:
Cảm ơn Hội đồng đã lắng nghe!  
Thank you for your attention!

---

**Contact**:  
📧 Email: [your.email@hcmut.edu.vn]  
🔗 GitHub: github.com/nnqt/AI-powered-Email-centric-Communication  
📄 Full Report: [Link to thesis PDF if available]

---

# END OF PRESENTATION GUIDE

**Notes for Presenter**:

1. Replace `[Your Name]`, `[Advisor Name]`, email placeholders with actual info
2. Add actual images/diagrams where `[IMAGE: ...]` placeholders are marked
3. Practice demo flow separately (5-7 min target)
4. Prepare backup answers for Q&A section
5. Total speaking time target: 13-15 min (slides) + 5-7 min (demo) = 20 min
6. Keep 1-2 min buffer for transitions and Q&A intro

**Image Assets Needed** (to be added manually):

- Slide 3: Communication fragmentation diagram
- Slide 9: Overall architecture diagram (you have this: `architechture_diagram.png`)
- Slide 10: ERD diagram (you have this: `erd_diagram.png`)
- Slide 11: FR-07 sequence diagram (you have this: `sequence_diagram_fr7.png`)
- Slide 14: PoC screenshots (inbox + thread detail with AI summary)
- Slide 15: GD1 Gantt chart comparison (export from `gd1_planned_w*.mmd` and `gd1_actual_w*.mmd`)
- Slide 19: GD2 Gantt chart (export from `gd2_plan_w*.mmd`)
