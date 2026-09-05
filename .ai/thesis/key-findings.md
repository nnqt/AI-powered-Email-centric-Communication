# Key Findings & Arguments

This file serves as a **consistency anchor** across thesis chapters. Before writing or editing any chapter, check that your content aligns with these established arguments.

Last updated: September 5, 2026

---

## Core Problem (Chapter 1)

**Thesis statement**: Sự tồn tại đồng thời của Email và các ứng dụng IM đã tạo nên hệ sinh thái giao tiếp đa kênh phức tạp, dẫn đến:

1. **Phân mảnh dữ liệu** (Data Fragmentation) — lịch sử trao đổi bị phân tán trên nhiều ứng dụng
2. **Đứt gãy ngữ cảnh** (Contextual Discontinuity) — khó dựng lại bức tranh bối cảnh
3. **Suy giảm hiệu suất** — context switching liên tục giảm năng suất
4. **Quá tải thông tin** (Information Overload) — khối lượng email/tin nhắn khổng lồ

## Proposed Solution

**Email-centric approach**: Email là "xương sống" (backbone) — kênh chính thức, có cấu trúc, dễ lưu trữ → dùng làm trung tâm để hợp nhất dữ liệu đa kênh.

**AI augmentation**: LLM (Google Gemini) để:
- Tóm tắt thread → giảm information overload
- Gợi ý phản hồi → tăng tốc xử lý
- Phân loại chủ đề + tính focus score → ưu tiên hóa

## Architecture Decisions (Chapter 4)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | Next.js 16 (App Router) | SSR + API routes in one framework |
| Backend framework | Next.js 16 API Routes | Shared TypeScript ecosystem with frontend |
| AI service | Separate FastAPI microservice | Stateless, language-appropriate (Python), independently scalable |
| Database | MongoDB | Flexible schema for semi-structured email/contact data |
| Realtime | Socket.IO + Redis adapter | Proven WebSocket library, Redis pub/sub for multi-instance |
| LLM | Google Gemini (gemini-2.0-flash) | Free tier available, fast, good Vietnamese support |
| Telegram integration | GramJS (MTProto, user-level) | Full chat history access (not Bot API limitation) |

## FR Coverage Summary (Chapter 2 + 5)

- **FR-01..FR-05**: Core email operations — sync, compose, read/unread/archive, inbox view, realtime
- **FR-06**: AI-assisted contact management — auto-create, enrich, merge suggestions
- **FR-07**: Thread summarization — structured JSON (summary + key_issues + action_required)
- **FR-08**: Smart reply — 2-3 options, message or email format, always Vietnamese
- **FR-09**: Multi-channel Telegram — GramJS MTProto, phone OTP auth, chat history sync
- **FR-10**: Topic Intelligence — thread categorization (22 enums), heuristic clustering, AI labeling, focus score engine

## Existing Solutions Gap (Chapter 1)

| Category | Representatives | Strength | Gap |
|----------|----------------|----------|-----|
| Email-centric | Superhuman, Front, Missive | UX optimized for email | No real multi-channel data unification |
| CRM platforms | Zendesk, HubSpot, Intercom | Full omnichannel | Expensive, over-engineered for small teams |
| Open-source | Chatwoot, Rocket.Chat | Customizable | Chat-first, not email-centric; limited AI |

**This project fills the gap**: Email-centric + AI-augmented + multi-channel ready + lightweight (PoC for small teams).

## Terms to Use Consistently

| Vietnamese | English | First-mention format |
|-----------|---------|---------------------|
| Mô hình Ngôn ngữ Lớn | Large Language Model | Mô hình Ngôn ngữ Lớn (Large Language Model — LLM) |
| Tóm tắt luồng | Thread Summarization | — |
| Phản hồi thông minh | Smart Reply | — |
| Quản lý liên hệ | Contact Management | — |
| Điểm ưu tiên | Focus Score | — |
| Phân loại chủ đề | Topic Classification | — |
| Chứng minh khái niệm | Proof of Concept | Chứng minh khái niệm (Proof of Concept — PoC) |
