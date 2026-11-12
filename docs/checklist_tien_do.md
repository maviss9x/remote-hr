# BẢNG THEO DÕI TIẾN ĐỘ & CHECKLIST DỰ ÁN WEB HYBRID HR

> **Dự án:** Web Quản Lý Nhân Sự Hybrid - Freetrip  
> **Cập nhật lần cuối:** 16/09/2026 (Sau khi hoàn tất kết nối CSDL PostgreSQL & Seed dữ liệu thực tế)  
> **Trạng thái tổng quan:** Đã hoàn thành 100% Khởi tạo Nền tảng (Phase 1) & Kiến trúc CSDL thực tế; Đang bắt đầu triển khai các Modules Nghiệp vụ (Phase 2).

---

## 1. TỔNG QUAN TIẾN ĐỘ THỰC HIỆN

| Hạng mục / Module | Trọng số | Trạng thái | Tỷ lệ hoàn thành | Ghi chú |
|-------------------|----------|------------|------------------|---------|
| **1. Khảo sát & Phân tích nghiệp vụ** | 10% | ✅ Hoàn thành | 100% | Phân tích 100% file tài liệu, báo cáo mẫu |
| **2. Kiến trúc & CSDL (Prisma / PostgreSQL)** | 15% | ✅ Hoàn thành | 100% | Đã push 12 bảng vào PostgreSQL `hybrid_hr`, seed 30 users |
| **3. Xác thực & Phân quyền (Auth & RBAC)** | 15% | ✅ Hoàn thành | 100% | JWT jose, Bcrypt, Login UI, Middleware RBAC hoàn tất |
| **4. Layout & Dashboard tổng quan** | 10% | 🔄 Hoàn thành cơ bản | 85% | Sidebar Role-based, Dashboard overview, Dark/Light theme |
| **5. Module Quản lý Nhân sự & HĐ (HRM)** | 10% | ⏳ Đang bắt đầu | 0% | Chuẩn bị làm CRUD nhân sự & cảnh báo HĐ |
| **6. Module Đăng ký & Duyệt ca làm việc** | 15% | ⏳ Chưa bắt đầu | 0% | Grid matrix ca tuần, auto-lock Chủ Nhật |
| **7. Module Báo cáo Seeding hàng ngày** | 15% | ⏳ Chưa bắt đầu | 0% | Form nộp link FB/Threads/Drive, auto counter |
| **8. Module Kiểm duyệt QC (Review)** | 10% | ⏳ Chưa bắt đầu | 0% | Quy trình chấm KPI, phạt muộn, SLA 7 ngày |
| **9. Module KPI, Nghiệm thu & Tính lương** | 10% | ⏳ Chưa bắt đầu | 0% | Công thức lương, xuất Excel/PDF nghiệm thu |

**Tổng tiến độ dự án ước tính:** **~45%**

---

## 2. CHECKLIST CHI TIẾT THEO TỪNG HẠNG MỤC

### 2.1. Phân Tích & Kế Hoạch Nghiệp Vụ
- [x] Đọc và trích xuất dữ liệu quy định nhân sự Hybrid (`QUY ĐỊNH NHÂN SỰ HYBRID SEEDING.txt`).
- [x] Phân tích quy trình quản lý 4 giai đoạn (`Quy Trình Quản Lý Nhân Sự Hybrid - Freetrip.txt`).
- [x] Phân tích cấu trúc dữ liệu báo cáo thực tế:
  - [x] Báo cáo ngày seeding tháng 8 (file Excel cấu trúc 10 FB, 4 Threads, 50 CMT).
  - [x] Báo cáo tuần 4 & Báo cáo tháng 8 team seeding.
  - [x] Mẫu biên bản nghiệm thu (ảnh scan thực tế).
- [x] Xây dựng tài liệu kế hoạch tổng thể: [`docs/implementation_plan.md`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/docs/implementation_plan.md).

---

### 2.2. Kiến Trúc CSDL & Dữ Liệu Nền Tảng (Database & Seed)
- [x] Khởi tạo cấu trúc schema Prisma [`app/prisma/schema.prisma`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/prisma/schema.prisma):
  - [x] Model `User`: Hỗ trợ 6 Roles (`SUPER_ADMIN`, `ADMIN`, `HR`, `MANAGER`, `QC`, `NHAN_SU_HYBRID`), trạng thái hồ sơ.
  - [x] Model `Contract`: Quản lý hợp đồng khoán việc 3 tháng, cờ cảnh báo hết hạn `alert_sent`.
  - [x] Model `ShiftRegistration`: Đăng ký ca (Sáng/Chiều/Tối), chế độ Online/Offline, tuần/năm.
  - [x] Model `ShiftScheduleConfig`: Cấu hình tuần mở/đóng đăng ký, khóa ca.
  - [x] Model `LoginSession`: Quản lý điểm danh ca, tracking vào muộn, tự động vắng.
  - [x] Model `DailyReport`: Nộp báo cáo link FB (10), link bổ sung, link Threads (4), link Drive comment, link content nữ, link viral.
  - [x] Model `QcReview`: Đánh giá QC số lượng FB/Threads/Comment, kết quả Đạt/Không đạt, feedback.
  - [x] Model `WeeklyEvaluation`: Đánh giá tuần, tỷ lệ tăng trưởng, chất lượng nội dung, xếp hạng nhân sự.
  - [x] Model `MonthlyAcceptance`: Biên bản nghiệm thu tháng, tổng gói, tính thù lao & thưởng viral.
  - [x] Model `KpiConfig`: Cấu hình KPI ca, giới hạn nghỉ phép, ngưỡng vào muộn.
  - [x] Model `ViralBonusTier`: Bảng chính sách thưởng viral bài viết & bình luận FB/Threads.
  - [x] Model `Notification`: Hệ thống thông báo in-app.
- [x] Cấu hình kết nối PostgreSQL local database `hybrid_hr` và đồng bộ schema qua `npx prisma db push`.
- [x] Xây dựng và thực thi script Seed dữ liệu [`app/prisma/seed.ts`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/prisma/seed.ts):
  - [x] Seed cấu hình KPI chuẩn.
  - [x] Seed bảng thưởng viral chuẩn (Facebook & Threads).
  - [x] Seed 30 tài khoản người dùng: Super Admin, Admin, HR, Manager, QC và 25 nhân sự Hybrid thực tế (mật khẩu mặc định: `123456`).
  - [x] Seed 25 hợp đồng khoán việc 3 tháng cho nhân sự Hybrid.

---

### 2.3. Hệ Thống Xác Thực & Phân Quyền (Auth & RBAC)
- [x] Token Engine: Cơ chế JWT chuẩn qua thư viện `jose` [`app/src/lib/auth.ts`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/src/lib/auth.ts).
- [x] Quản lý Cookie an toàn (`httpOnly`, `sameSite: lax`, thời hạn 24 giờ).
- [x] Middleware bảo vệ route và phân tầng truy cập RBAC [`app/src/middleware.ts`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/src/middleware.ts):
  - `/nhan-su`: Chỉ cho phép `SUPER_ADMIN`, `ADMIN`, `HR`.
  - `/kiem-duyet`: Chỉ cho phép `SUPER_ADMIN`, `ADMIN`, `MANAGER`, `QC`.
  - `/nghiem-thu`: Chỉ cho phép `SUPER_ADMIN`, `ADMIN`, `HR`, `MANAGER`.
  - `/admin`: Chỉ cho phép `SUPER_ADMIN`, `ADMIN`.
- [x] API Auth:
  - [x] `POST /api/auth/login`: Xác thực số điện thoại & mật khẩu bcrypt, phát cookie token.
  - [x] `POST /api/auth/logout`: Xóa session cookie.
  - [x] `GET /api/auth/session`: Lấy thông tin user hiện tại.
- [x] UI Trang Đăng nhập [`app/src/app/login/page.tsx`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/src/app/login/page.tsx): Giao diện hiện đại, validate dữ liệu, thông báo lỗi.

---

### 2.4. Khung Giao Diện & Dashboard Trung Tâm
- [x] Thiết lập Design System & CSS Variables [`app/src/app/globals.css`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/src/app/globals.css): Biến màu thương hiệu Freetrip, dark/light theme, card glassmorphism.
- [x] Navigation Sidebar [`app/src/components/Sidebar.tsx`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/src/components/Sidebar.tsx): Phân nhóm menu theo quyền (Role-based UI render), hỗ trợ responsive di động & desktop.
- [x] Dashboard Trung tâm [`app/src/app/(dashboard)/page.tsx`](file:///d:/Quang/Cong%20Viec%20Dev/WebHybrid/app/src/app/%28dashboard%29/page.tsx): Thẻ chỉ số tổng quan (Nhân sự, Ca làm việc, HĐ sắp hết hạn, Báo cáo chờ duyệt, Tỷ lệ KPI, Thưởng viral).

---

### 2.5. Trạng Thái Build & Chất Lượng Code
- [x] TypeScript Compilation (`npx tsc --noEmit`): **Passed 100% (0 errors)**.
- [x] Next.js Production Build (`npm run build`): **Compiled successfully (Turbopack, 8/8 static pages & API routes)**.
- [x] Đã cấu hình và giải quyết triệt để các thư viện: `lucide-react`, `bcryptjs`, `@prisma/client`, `@prisma/adapter-pg`, `pg`, `tsx`.

---

### 2.6. Các Chức Năng Nghiệp Vụ Đang & Sắp Triển Khai

#### Module Quản Lý Hồ Sơ Nhân Sự (HRM) - `/nhan-su` (ĐÃ HOÀN THÀNH)
- [x] Bảng danh sách nhân sự (lọc theo role, trạng thái: thử việc / chính thức / đã nghỉ, tìm kiếm tức thời, phân trang).
- [x] Modal tạo mới & sửa hồ sơ nhân sự (CCCD, SĐT, STK Ngân hàng, khởi tạo mật khẩu mặc định 123456).
- [x] Quản lý hợp đồng 3 tháng, cảnh báo hợp đồng sắp hết hạn trước 7-14 ngày, ký mới & gia hạn hợp đồng an toàn.
- [x] Import/Export danh sách nhân sự Excel (.xlsx) hỗ trợ định dạng cột và rollback an toàn qua Transaction.

#### Module Đăng Ký & Quản Lý Ca - `/ca-lam-viec` (ĐÃ HOÀN THÀNH)
- [x] Grid Matrix đăng ký ca tuần cho nhân sự (Thứ 2 - Chủ Nhật, 3 ca/ngày: Sáng/Chiều/Tối).
- [x] Ràng buộc nghiệp vụ: Tối đa 1 ca/ngày, tối thiểu 5 ca/tuần, ít nhất 1 ca Offline tại công ty/tuần (live feedback & validation).
- [x] Tự động khóa đăng ký sau 23:59 Chủ Nhật (hỗ trợ mở khóa bù cá nhân qua reopenedBy).
- [x] Grid Matrix tổng hợp dành cho Quản lý để duyệt và chốt ca toàn đội.
- [x] Đăng ký nghỉ phép ca (tính tổng ca nghỉ trong tháng, cảnh báo nghiêm ngặt nếu > 3 ca/tháng).

#### Module Báo Cáo Seeding Hàng Ngày - `/bao-cao` (ĐÃ HOÀN THÀNH)
- [x] Form nhập báo cáo ca cho nhân sự:
  - [x] 10 ô link bài viết Facebook (kèm tính năng thêm link bổ sung phòng khi bài bị gỡ).
  - [x] 4 ô link bài viết Threads.
  - [x] 1 link Google Drive chứa ảnh chụp bình luận (yêu cầu 50 comments).
  - [x] Gắn tag link bài content nữ (🌸) & link bài có tiềm năng viral (🔥).
- [x] Tự động đếm số lượng link đã nộp và kiểm tra tính hợp lệ.
- [x] Lịch sử báo cáo cá nhân theo tuần/tháng kèm kết quả chấm điểm QC (Đạt/Không đạt/Feedback).

#### Module Kiểm Duyệt QC (Review & Quality Control) - `/kiem-duyet` (ĐÃ HOÀN THÀNH)
- [x] Hàng đợi các ca cần duyệt trong vòng 7 ngày (đánh dấu ưu tiên ca sắp hết hạn duyệt với SLA đếm ngược).
- [x] Giao diện chấm bài: Đếm số lượng đạt FB, Threads, Comment; Đánh giá Đạt/Không đạt; Feedback gửi thông báo tức thời.
- [x] Cơ chế cảnh báo vào muộn > 1 tiếng & đánh vắng ca tự động.
- [x] Mở khóa nộp bù ca cho nhân sự khi có lý do chính đáng.

#### Module KPI & Đánh Giá Tuần/Tháng - `/kpi` (ĐÃ HOÀN THÀNH)
- [x] Tổng hợp tự động kết quả tuần: % hoàn thành KPI, tốc độ tăng trưởng so với tuần trước.
- [x] Đánh giá chất lượng nội dung & xếp hạng nhân sự (Rất tốt -> Không tốt).
- [x] Bảng theo dõi bài viết viral và tự động tính tiền thưởng theo bậc quy định.

#### Module Nghiệm Thu & Tính Lương - `/nghiem-thu` (ĐÃ HOÀN THÀNH)
- [x] Tạo biên bản nghiệm thu tự động theo tháng từ dữ liệu ca ĐẠT và thưởng viral.
- [x] Khớp mẫu chuẩn với biên bản nghiệm thu Freetrip.
- [x] Xuất Excel & Xuất PDF biên bản nghiệm thu để in ký hoặc lưu trữ.

---

## 3. THÔNG TIN TÀI KHOẢN MẪU ĐÃ CẤP SẴN TRONG CSDL

| Role | Họ và tên | Số điện thoại (Tài khoản) | Mật khẩu mặc định |
|------|-----------|---------------------------|-------------------|
| **SUPER_ADMIN** | Admin System | `0900000001` | `123456` |
| **ADMIN** | Nguyễn Văn Admin | `0900000002` | `123456` |
| **HR** | Nguyễn Thị Linh | `0912509317` | `123456` |
| **MANAGER** | Nguyễn Thị Thủy | `0964774572` | `123456` |
| **QC** | Nguyễn Thị Dung | `0854201465` | `123456` |
| **NHAN_SU_HYBRID** | Nguyễn Tuyển Hải Anh | `0901000001` | `123456` |
| *(và 24 nhân sự khác)* | ... | `0901000002` → `0901000025` | `123456` |
