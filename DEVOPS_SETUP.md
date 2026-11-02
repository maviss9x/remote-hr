# HƯỚNG DẪN TRIỂN KHAI DỰ ÁN REMOTE HR (WINDOWS SERVER / IIS / MSSQL)

Tài liệu này dành cho bộ phận DevOps triển khai hệ thống Remote HR trên hạ tầng **Windows Server**, sử dụng **IIS (Reverse Proxy)** và **Microsoft SQL Server (MSSQL)** thông qua FTP/Git.

---

## 1. YÊU CẦU MÔI TRƯỜNG (PREREQUISITES)

1. **Node.js**: Phiên bản LTS `>= 20.x` (khuyến nghị Node 20 hoặc Node 22).
2. **Microsoft SQL Server**: Phiên bản 2019 hoặc 2022.
   * Đã kích hoạt **SQL Server and Windows Authentication mode**.
   * Đã kích hoạt giao thức **TCP/IP** (Port mặc định: `1433`).
   * Đã tạo sẵn một Database trống (Ví dụ: `remote_hr`).
3. **Internet Information Services (IIS)** trên Windows Server:
   * Đã cài đặt module **URL Rewrite** ([Tải về](https://www.iis.net/downloads/microsoft/url-rewrite)).
   * Đã cài đặt module **Application Request Routing (ARR)** ([Tải về](https://www.iis.net/downloads/microsoft/application-request-routing)).
   * **Bắt buộc:** Mở IIS Manager -> Chọn Server Name -> **Application Request Routing** -> **Server Proxy Settings** -> Tích chọn **Enable proxy** -> Click **Apply**.

---

## 2. QUY TRÌNH CÀI ĐẶT TỪNG BƯỚC

### Bước 1: Tải mã nguồn lên Server
Giải nén hoặc đưa toàn bộ mã nguồn của repository vào thư mục Web Root của IIS:
* Ví dụ: `C:\inetpub\wwwroot\remote-hr`

### Bước 2: Thiết lập file môi trường (`.env`)
Tại thư mục gốc của project, tạo file `.env` (copy từ `.env.example`):
```env
# Chuỗi kết nối SQL Server (sửa lại IP, Port, Database, User, Password)
DATABASE_URL="sqlserver://127.0.0.1:1433;database=remote_hr;user=sa;password=YourStrongPasswordHere;trustServerCertificate=true;encrypt=false;"

# Khóa bí mật JWT dùng để mã hóa phiên đăng nhập
JWT_SECRET="remote-hr-secret-key-change-in-production-2026"

# Tên ứng dụng hiển thị trên giao diện
NEXT_PUBLIC_APP_NAME="Remote HR"
```

> **Lưu ý:** Giữ nguyên các tham số `trustServerCertificate=true;encrypt=false;` để kết nối thông suốt với MSSQL trên Windows Server.

### Bước 3: Cài đặt thư viện & Đồng bộ Database
Mở Command Prompt (cmd) hoặc PowerShell tại thư mục dự án và chạy lần lượt các lệnh:

```cmd
:: 1. Cài đặt các gói phụ thuộc
npm install

:: 2. Khởi tạo Prisma Client
npm run prisma:generate

:: 3. Tạo toàn bộ cấu trúc bảng tự động trên SQL Server
npx prisma db push

:: 4. Nạp tài khoản Admin và cấu hình mẫu ban đầu
npm run db:seed
```

### Bước 4: Build ứng dụng cho môi trường Production
```cmd
npm run build
```

---

## 3. VẬN HÀNH ỨNG DỤNG (RUNNING SERVICE)

### Cách 1: Sử dụng PM2 (Khuyến nghị cho Windows Server)
Cài đặt PM2 để ứng dụng tự khởi động lại khi gặp sự cố hoặc khi server reboot:
```cmd
npm install -g pm2
pm2-install-windows-service

pm2 start "npm run start" --name "remote-hr"
pm2 save
```

### Cách 2: Chạy trực tiếp qua CMD
```cmd
npm run start
```
*Ứng dụng sẽ chạy tại địa chỉ: `http://127.0.0.1:3000`*

---

## 4. CẤU HÌNH IIS (REVERSE PROXY)

Dự án đã tích hợp sẵn file `web.config` tại thư mục gốc với nội dung chuyển tiếp lưu lượng từ cổng 80/443 sang cổng 3000 của Next.js:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNextJs" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="X-Forwarded-Proto" value="http" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

**Thao tác trên IIS Manager:**
1. Tạo một Site mới trong IIS (ví dụ: `RemoteHR`).
2. Trỏ **Physical path** vào chính xác thư mục chứa mã nguồn (nơi có file `web.config` và `.env`).
3. Gán Port hoặc Domain/Binding tương ứng (ví dụ: port 80 hoặc domain nội bộ).
4. Khởi động Site trên IIS -> Truy cập kiểm tra trên trình duyệt.

---

## 5. THÔNG TIN ĐĂNG NHẬP MẶC ĐỊNH SAU KHI SEED

* **Số điện thoại:** `0982000000`
* **Mật khẩu:** `Admin@2026`
* **Vai trò:** Quản trị viên tối cao (SUPER_ADMIN)
