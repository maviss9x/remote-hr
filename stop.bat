@echo off
chcp 65001 >nul
title Dừng Hệ Thống Remote HR

echo ===============================================================
echo            ĐANG DỪNG HỆ THỐNG REMOTE HR...
echo ===============================================================
echo.

docker compose down

echo.
echo ===============================================================
echo    Hệ thống đã dừng an toàn. Dữ liệu Database vẫn được lưu!
echo ===============================================================
echo.
pause

