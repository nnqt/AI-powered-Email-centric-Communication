# Hướng dẫn Delegate Task cho AI Coder (Sandbox Feature)

Đây là các prompt đã được thiết kế theo best practices để bạn có thể copy & paste giao cho AI coder thực thi từng Phase. Mỗi prompt có đủ Context, Constraints và Yêu cầu rõ ràng.

---

## 🚀 Prompt Cho Phase 1: Foundation (Schema & API Guards)

```markdown
Bạn là AI coding assistant cho dự án AI-Powered Email-Centric Communication.
Hãy đọc các file context sau trước khi thực hiện (dùng tool view_file):
1. `.agents/knowledge/project-overview.md`
2. `.agents/knowledge/database-schema.md`
3. `.agents/skills/code-conventions.md`

**TASK: Implement Sandbox Phase 1 - Database Update & API Guards.**

**Yêu cầu công việc:**
1. Mở tất cả các Mongoose Models hiện hành: `Thread`, `Message`, `Contact`, `Topic`, `TelegramChat`, `TelegramMessage` (tại `apps/backend/src/models/`).
2. Thêm field `isMock: { type: Boolean, default: false }` vào Schema của các models trên. Đừng quên update cả TypeScript interfaces của chúng (nếu có).
3. Tạo Guards an toàn (Tuyệt đối quan trọng):
   - Mở `apps/backend/src/modules/email/gmail.service.ts`. Tại hàm xử lý `sendEmail` (hoặc reply), check nếu `thread` hiện tại có `isMock: true`, thì KHÔNG gọi Google API. Chỉ lưu `Message` mới vào DB với `isMock: true` và kết thúc hàm.
   - Làm tương tự với `apps/backend/src/lib/telegramManager.ts` (Hàm send message không gọi ra GramJS/Tele API nếu `chat/message` là data mock).
4. Tạo API Xóa Sandbox:
   - Tạo route `DELETE apps/backend/src/app/api/sandbox/clear/route.ts`.
   - Lấy `userId` từ session. Chạy `deleteMany({ userId, isMock: true })` cho toàn bộ 6 collections trên. Return success.

**Constraints (Bắt buộc tuân thủ):**
- Giữ nguyên convention của NextRoute (handlers GET/POST/DELETE) như trong `code-conventions.md`.
- Validate kĩ session auth trước khi thực thi `DELETE`.
- Không tự ý sửa logic của data thật (khi `isMock: false`).

Sau khi hoàn thành, hãy update changelog/status vào file `.agents/state/current-state.md`.
```

---

## 🚀 Prompt Cho Phase 2: Sandbox API & Injector

```markdown
Bạn là AI coding assistant. Trước khi bắt đầu, hãy đọc file `.agents/test-sandbox.md` (nếu cần xem tổng thể) và `.agents/knowledge/project-overview.md`.

**TASK: Implement Sandbox Phase 2 - Injector API & Logic.**

**Yêu cầu công việc:**
1. Định nghĩa Type/Interface cho `SandboxScenario` JSON (nơi định cấu trúc data test: list contacts, threads, messages) tại `apps/backend/src/types/sandbox.ts`.
2. Tạo API Route `POST apps/backend/src/app/api/sandbox/inject/route.ts`. Route này nhận array các object JSON theo chuẩn scenario vừa tạo.
3. Trong API Inject:
   - Verify `userId` từ session.
   - Insert Contact giả -> Lấy id -> Insert Thread giả -> Insert Message giả (đặt cờ `isMock: true` cho tất cả).
   - Gọi `socketServer.ts` (hàm `emitToUser`) để bắn event `EMAIL_SYNCED` báo Frontend update giao diện.
   - (Quan trọng) Thủ công trigger việc gọi module AI: Pass instance Thread giả này cho hàm generate Summary và Topic Intelligence (Service AI / FastAPI) hệt như một email thật đang được xử lý.

**Constraints:**
- Gói gọn việc xử lý DB trong một khối `try-catch` an toàn.
- Data mock khi set ngày (Date) cần lùi thời gian một chút (ví dụ `Date.now() - 5000`) để test được workflow sắp xếp.
- Response trả về JSON chứa số lượng record được tạo.

Sau khi hoàn thành, viết 1 file mock JSON mẫu vào folder `apps/backend/src/lib/mock-data/scenario-fr-topic-01.json`.
```

---

## 🚀 Prompt Cho Phase 3: Developer Dashboard (UI)

```markdown
Bạn là AI coding assistant (Frontend & Backend). Hãy load cấu trúc file quy định tại `.agents/skills/code-conventions.md`.

**TASK: Implement Sandbox Phase 3 - Developer UI Dashboard**

**Yêu cầu công việc (Frontend Next.js):**
1. Tạo Page dành riêng cho Dev tại `apps/frontend/src/app/(dashboard)/dev/sandbox/page.tsx`.
   - Chỉ cho truy cập khi `process.env.NODE_ENV === "development"` hoặc `NEXT_PUBLIC_ENABLE_SANDBOX_UI=true`; ngoài ra redirect về trang chủ.
2. Build UI (dùng Tailwind, áp dụng BEM convention):
   - Load options từ `GET /api/sandbox/scenarios` rồi cho phép chọn scenario.
   - Khi click "Load Selected Scenario": gọi `GET /api/sandbox/scenarios/:slug` để lấy payload rồi gửi `POST /api/sandbox/inject`.
   - Nút đỏ "Clear All Sandbox Data" -> Gọi API `DELETE /api/sandbox/clear`.
   - Form giả lập "Fake Webhook": Chứa input (Sender Name, Email, Subject, Message) -> Nút Submit -> Gọi Injection tạo ra đúng 1 email ngay lập tức.
3. Update giao diện hiển thị: Tại component `ThreadList.tsx` hoặc `ContactRow.tsx`, nếu item có `isMock === true`, hãy hiển thị một Badge nhỏ màu tím nhạt có text `[MOCK]` để team Dev dễ phân biệt phân biệt giữa data thật và giả.

**Constraints:**
- Áp dụng triệt để hook SWR hoặc `axios` chuẩn từ `lib/api.ts`.
- Có xử lý Loading state và `Toast` báo lỗi hoặc thành công.
- Tuân thủ thiết kế đẹp, hiện đại.
- Nếu có AI summary actions, giữ format 1 action/line; ưu tiên metadata `[Priority][Owner][Deadline]` để UI parse chip.

Khi deploy xong chạy test thử, hãy update `.agents/state/current-state.md` để xác nhận done tính năng.
```
