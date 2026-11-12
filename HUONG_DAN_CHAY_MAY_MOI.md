# HƯỚNG DẪN CHẠY DỰ ÁN TRÊN MÁY TÍNH MỚI (CHƯA CÀI ĐẶT GÌ)

Hệ thống đã được đóng gói trọn gói 100% bằng **Docker**. Máy mới **KHÔNG CẦN CÀI ĐẶT**:
- Không cần cài Node.js / npm
- Không cần cài SQL Server
- Không cần cài IIS hay Cloudflare CLI

---

## BƯỚC 1: Cài đặt Docker Desktop (Duy nhất)

1. Tải và cài đặt **Docker Desktop** cho Windows từ trang chủ: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Khi cài đặt, chọn tích hợp **WSL 2** (mặc định được khuyến nghị).
3. Mở Docker Desktop lên và chờ biểu tượng góc dưới chuyển sang màu xanh lá (**Engine running**).

---

## BƯỚC 2: Khởi chạy hệ thống

1. Copy toàn bộ thư mục dự án `WebHybrid` sang máy mới.
2. Nhấp đúp chuột vào file:
   👉 **`start.bat`**
3. Hệ thống sẽ tự động thực hiện:
   * Tải và dựng Database SQL Server 2022.
   * Tự động tạo cơ sở dữ liệu `remote_hr`, đồng bộ bảng và nạp sẵn tài khoản Admin, Manager, HR, QC, Nhân sự.
   * Khởi chạy ứng dụng Web Next.js và Crawler mạng xã hội (Playwright).
   * Kích hoạt đường truyền an toàn **Cloudflare Tunnel** và in đường link Public ra màn hình.

---

## BƯỚC 3: Truy cập hệ thống

* **Truy cập nội bộ:** Mở trình duyệt gõ `http://localhost:3000`
* **Truy cập từ xa (Tên miền cố định miễn phí):** `https://unbutton-finless-provided.ngrok-free.dev`

### Tài khoản đăng nhập mặc định:
* **Admin (Quản trị cao nhất):** `0900000001` / Mật khẩu: `123456`
* **HR (Nhân sự):** `0912509317` / Mật khẩu: `123456`
* **Manager (Quản lý):** `0964774572` / Mật khẩu: `123456`
* **QC (Kiểm duyệt):** `0854201465` / Mật khẩu: `123456`
* **Nhân sự mẫu:** `0901000001` / Mật khẩu: `123456`

---

## LƯU Ý KHI TREO MÁY
* **Tắt chế độ Sleep của Windows:** Vào `Settings` -> `Power & battery` -> Chuyển **Sleep** sang **Never** để máy không bị ngắt mạng khi không dùng chuột.
* **Tắt hệ thống:** Khi không dùng, chỉ cần nhấp đúp file **`stop.bat`** (Toàn bộ dữ liệu nhập vào vẫn được bảo lưu an toàn).

