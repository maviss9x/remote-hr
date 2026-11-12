@echo off
chcp 65001 >nul
title Khởi Động Hệ Thống Remote HR

echo ===============================================================
echo     KHỞI ĐỘNG HỆ THỐNG QUẢN LÝ NHÂN SỰ REMOTE HR (DOCKER)
echo ===============================================================
echo.

:: 1. Kiểm tra Docker
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [LỖI] Docker Desktop chưa được bật!
    echo Vui lòng mở ứng dụng Docker Desktop lên trước, chờ Docker báo "Engine running" rồi chạy lại file này.
    echo.
    pause
    exit /b 1
)

echo [1/3] Đang đóng gói và khởi chạy các dịch vụ (App, Database, Crawler, Tunnel)...
docker compose up -d --build

echo.
echo [2/3] Đang chờ hệ thống khởi tạo Database và thiết lập đường link Public...
timeout /t 10 /nobreak >nul

echo.
echo ===============================================================
echo     THÔNG TIN TRUY CẬP WEBSITE
echo ===============================================================
echo - Mạng nội bộ (Local): http://localhost:3000
echo.
echo - Đường link Public truy cập từ xa (Tên miền cố định Ngrok):
echo   👉 https://unbutton-finless-provided.ngrok-free.dev
echo.
docker logs webhybrid_tunnel 2>&1 | findstr /C:".loca.lt"
echo ===============================================================
echo     THÔNG TIN ĐĂNG NHẬP HỆ THỐNG
echo ===============================================================
echo   - Admin (Quản trị):    0900000001
echo   - HR (Nhân sự):        0912509317
echo   - Manager (Quản lý):   0964774572
echo   - QC (Kiểm duyệt):     0854201465
echo   - Nhân sự mẫu:         0901000001
echo.
echo   * Lưu ý bảo mật: Mật khẩu khởi tạo ban đầu là '123456'.
echo   * Vui lòng đổi ngay mật khẩu Admin/HR trong trang Quản trị sau khi đăng nhập!
echo ===============================================================
echo.
echo [XONG] Hệ thống đang chạy nền an toàn. Để tắt hệ thống, chạy file 'stop.bat'.
echo.
pause

