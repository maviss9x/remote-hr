@echo off
chcp 65001 >nul
title Đóng Gói Dự Án Siêu Nhẹ (WebHybrid)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0package.ps1"

echo.
pause
